"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { io, Socket } from "socket.io-client";
import { StoredDisplayCredentials, clearStoredCredentials } from "../lib/storage";
import { fetchRotatingChallenge, DisplayApiError, QrTokenResponse, checkDisplayUpdate } from "../lib/api";
import { AnnouncementTicker } from "./AnnouncementTicker";
import { VORLDX_LOGO_URI } from "../lib/logo";
import {
  Wifi,
  ShieldAlert,
  Clock,
  RotateCw,
  LogOut,
  Sparkles,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { SocketEvent, TerminalStatus } from "@vorldx/shared";

interface MainScreenProps {
  creds: StoredDisplayCredentials;
  onUnpair: () => void;
}

type TerminalState = "ACTIVE" | "DISABLED" | "REVOKED" | "INITIALIZING";

// 15-second rotation cadence for opaque dynamic challenge issuance
const ROTATION_CADENCE_SECONDS = 15;

export const MainScreen: React.FC<MainScreenProps> = ({ creds, onUnpair }) => {
  const [tokenData, setTokenData] = useState<QrTokenResponse | null>(null);
  const [terminalState, setTerminalState] = useState<TerminalState>("INITIALIZING");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [showUnpairConfirm, setShowUnpairConfirm] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(ROTATION_CADENCE_SECONDS);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [pendingUpdate, setPendingUpdate] = useState<{ version: string; notes?: string } | null>(null);
  const [isQuietUpdating, setIsQuietUpdating] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const tokenDataRef = useRef<QrTokenResponse | null>(null);
  const lastPunchRef = useRef<number>(Date.now());
  const cycleStartRef = useRef<number>(Date.now());
  tokenDataRef.current = tokenData;

  // 1. Screen Wake Lock API (keeps kiosk screen awake without screensaver or dimming)
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      try {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // Wake lock might be unavailable or denied in non-secure local previews
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === "function") {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // 2. Live wall-clock updater (Subtle clock & date)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Challenge Fetcher (15-second rotation cadence)
  const requestNewChallenge = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = await fetchRotatingChallenge(creds);

      setIsRotating(true);
      setTokenData(response);
      setTerminalState("ACTIVE");
      setStatusMessage("");
      cycleStartRef.current = Date.now();
      setRemainingSeconds(ROTATION_CADENCE_SECONDS);

      // Smooth visual rotation transition
      setTimeout(() => setIsRotating(false), 300);
    } catch (err: unknown) {
      if (err instanceof DisplayApiError) {
        if (
          err.code === "ERR_DISPLAY_REVOKED" ||
          err.code === "ERR_TERMINAL_UNAUTHORIZED" ||
          err.status === 401
        ) {
          clearStoredCredentials();
          setTokenData(null); // Blank QR immediately
          setTerminalState("REVOKED");
          setStatusMessage("This display terminal has been revoked by an administrator.");
        } else if (err.code === "ERR_DISPLAY_DISABLED") {
          setTokenData(null); // Blank QR immediately
          setTerminalState("DISABLED");
          setStatusMessage("This display terminal is currently disabled by HR.");
        }
      } else {
        // Network failure during challenge fetch: triggers calm reconnecting state
        setIsReconnecting(true);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [creds]);

  // 4. Proactive 15-second rotation cadence loop (ring is invisible; process is encrypted & opaque)
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsedMs = Date.now() - cycleStartRef.current;
      const secondsLeft = Math.max(0, ROTATION_CADENCE_SECONDS - elapsedMs / 1000);
      setRemainingSeconds(secondsLeft);

      // Proactively fetch next challenge 3s before current 15s epoch ends
      if (secondsLeft <= 3 && !isFetchingRef.current && isConnected && terminalState === "ACTIVE") {
        requestNewChallenge();
      }

      // If epoch expires while active, refresh immediately
      if (secondsLeft <= 0 && terminalState === "ACTIVE") {
        if (isConnected && !isFetchingRef.current) {
          requestNewChallenge();
        }
      }
    }, 150);

    return () => clearInterval(timer);
  }, [requestNewChallenge, terminalState, isConnected]);

  // 5. Socket.IO Integration with auto-reconnection and event isolation
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

    const socket = io(wsUrl, {
      auth: {
        terminalId: creds.terminalId || creds.displayId,
        displayId: creds.displayId || creds.terminalId,
        credential: creds.credential,
        terminalSecret: creds.credential,
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // Resync and retrieve clean challenge on reconnection
      socket.emit(SocketEvent.RESYNC, { type: "display" });
      requestNewChallenge();
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      setIsReconnecting(true);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    // Handle token rotation broadcast from backend
    const handleQrRotated = (data: QrTokenResponse) => {
      if (data && (data.token || data.qrPayload)) {
        setIsRotating(true);
        setTokenData(data);
        setTerminalState("ACTIVE");
        setStatusMessage("");
        cycleStartRef.current = Date.now();
        setRemainingSeconds(ROTATION_CADENCE_SECONDS);
        setTimeout(() => setIsRotating(false), 300);
      }
    };

    socket.on(SocketEvent.QR_ROTATED, handleQrRotated);
    socket.on(SocketEvent.QR_TOKEN_ROTATE, handleQrRotated);

    // Handle display status changes (Disabled / Revoked / Activated)
    // RULE: Revoked or disabled state blanks the QR immediately
    const handleDisplayStatus = (data: {
      terminalId: string;
      isActive: boolean;
      status: string;
      message?: string;
    }) => {
      const isOurTerminal =
        data.terminalId === creds.terminalId || data.terminalId === creds.displayId;
      if (!isOurTerminal) return;

      if (data.status === TerminalStatus.REVOKED || data.status === "REVOKED") {
        clearStoredCredentials();
        setTokenData(null); // Blanks QR immediately
        setTerminalState("REVOKED");
        setStatusMessage(data.message || "Display terminal revoked. All issued challenges invalidated.");
      } else if (!data.isActive || data.status === TerminalStatus.DISABLED || data.status === "DISABLED") {
        setTokenData(null); // Blanks QR immediately
        setTerminalState("DISABLED");
        setStatusMessage(
          data.message || "Display temporarily disabled by administrator. Contact HR to re-enable."
        );
      } else if (data.isActive && (data.status === TerminalStatus.ACTIVE || data.status === "ACTIVE")) {
        setTerminalState("ACTIVE");
        setStatusMessage("");
        requestNewChallenge();
      }
    };

    socket.on(SocketEvent.DISPLAY_STATUS, handleDisplayStatus);
    socket.on(SocketEvent.TERMINAL_STATUS_CHANGED, handleDisplayStatus);

    const handleReleasePublished = (data: { platform: string; version: string; notes?: string }) => {
      if (data.platform === "DISPLAY" || data.platform === "ALL") {
        setPendingUpdate({ version: data.version, notes: data.notes });
      }
    };
    socket.on(SocketEvent.APP_RELEASE_PUBLISHED, handleReleasePublished);
    socket.on(SocketEvent.ATTENDANCE_PUNCHED, () => {
      lastPunchRef.current = Date.now();
    });
    socket.on(SocketEvent.ATTENDANCE_UPDATED, () => {
      lastPunchRef.current = Date.now();
    });

    // Heartbeat every 25s
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit(SocketEvent.DISPLAY_HEARTBEAT, { terminalId: creds.terminalId });
      }
    }, 25000);

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [creds, requestNewChallenge]);

  // 6. Periodic Display Version Poll
  useEffect(() => {
    let isMounted = true;
    const checkVersion = async () => {
      const res = await checkDisplayUpdate("1.0.0");
      if (isMounted && res.updateAvailable && res.latestVersion) {
        setPendingUpdate({ version: res.latestVersion, notes: res.notes });
      }
    };
    checkVersion();
    const interval = setInterval(checkVersion, 1000 * 60 * 2);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 7. Safe Quiet-Moment Auto-Reload (reloads only when idle >= 30s with zero punch activity)
  useEffect(() => {
    if (!pendingUpdate || isQuietUpdating) return;

    const quietInterval = setInterval(() => {
      const idleSeconds = (Date.now() - lastPunchRef.current) / 1000;
      if (idleSeconds >= 30 && terminalState === "ACTIVE") {
        setIsQuietUpdating(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }, 5000);

    return () => clearInterval(quietInterval);
  }, [pendingUpdate, isQuietUpdating, terminalState]);

  // Initial challenge fetch
  useEffect(() => {
    requestNewChallenge();
  }, [requestNewChallenge]);

  const handleManualUnpair = () => {
    setShowUnpairConfirm(true);
  };

  const confirmUnpair = () => {
    setShowUnpairConfirm(false);
    clearStoredCredentials();
    onUnpair();
  };

  // Calm Reconnecting State Logic:
  // - If disconnected, keep the last valid QR visible until remainingSeconds reaches 0.
  // - Once expired while still disconnected, blur the QR and show a gentle animated message.
  const isDisconnected = !isConnected || isReconnecting;
  const isTokenExpired = remainingSeconds <= 0;
  const showCalmReconnectingOverlay = isDisconnected && isTokenExpired && terminalState !== "REVOKED" && terminalState !== "DISABLED";
  const shouldRenderQR = Boolean(tokenData?.qrPayload && terminalState !== "REVOKED" && terminalState !== "DISABLED");

  // Optional slim announcement ticker flag (defaults to true unless explicitly disabled)
  const isAnnouncementTickerEnabled = process.env.NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_TICKER !== "false";

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-brand-950 text-slate-100 select-none overflow-hidden relative"
      role="region"
      aria-label="VorldX Attendance Kiosk"
    >
      {/* Background Ambience Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP TELEMETRY BAR: Display Name, Subtle Clock, Small Authorization Badge & Live Connection */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        {/* Left: Branding & Display Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <QrCode className="w-5 h-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                VORLDX
              </span>
              {/* Small Authorization Badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide uppercase">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Authorized Kiosk</span>
              </span>
            </div>

            <p id="display-terminal-name" className="text-xs text-slate-400 font-medium truncate max-w-xs sm:max-w-md mt-0.5">
              {creds.name || "Office Display"} • <span className="text-slate-500">{creds.location || "Office Lobby"}</span>
            </p>
          </div>
        </div>

        {/* Right: Subtle Clock, Date & Calm Network Status Indicator */}
        <div className="flex items-center gap-4">
          {/* Subtle Clock and Date */}
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-mono font-bold text-slate-300 tracking-wider tabular-nums">
              {currentTime}
            </span>
            <span className="text-[11px] text-slate-500 font-medium tracking-wide">
              {currentDate}
            </span>
          </div>

          {/* Connection Status Pill */}
          <div
            id="connection-status-pill"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              isConnected && !isReconnecting
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
            }`}
          >
            {isConnected && !isReconnecting ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Syncing</span>
              </>
            )}
          </div>

          {/* Unpair Trigger Button */}
          <button
            type="button"
            id="unpair-kiosk-btn"
            onClick={handleManualUnpair}
            title="Unpair Display Terminal"
            aria-label="Unpair this terminal"
            className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CENTER STAGE: Very Large High-Contrast QR Code with Centered Company Logo */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center my-4 sm:my-6 text-center">
        {/* STATE 1: ACTIVE OR CALM RECONNECTING (QR is kept mounted) */}
        {shouldRenderQR && (
          <div className="flex flex-col items-center space-y-4 sm:space-y-6 animate-fade-in">
            {/* Header Instructions */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Scan to Record Attendance
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Hold phone camera steadily in front of the QR code using the VorldX Mobile App
              </p>
            </div>

            {/* VERY LARGE HIGH-CONTRAST QR CODE WITH CENTERED VORLDX LOGO */}
            {/* Error correction level H allows 30% recovery; logo is 16.8% (64px on 380px) on white padded cutout */}
            <div className="relative group">
              <div
                id="active-qr-container"
                className={`p-6 sm:p-7 md:p-8 bg-white rounded-3xl shadow-2xl transition-all duration-300 border-4 border-slate-100 glow-cyan ${
                  isRotating ? "scale-[0.99] opacity-90" : "scale-100 opacity-100"
                } ${showCalmReconnectingOverlay ? "filter blur-md opacity-25 select-none pointer-events-none" : ""}`}
              >
                <QRCodeSVG
                  id="vorldx-dynamic-qr-code"
                  value={tokenData?.qrPayload || ""}
                  size={380}
                  level="H" // High error correction level (30% recovery)
                  includeMargin={false}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  imageSettings={{
                    src: VORLDX_LOGO_URI,
                    height: 60, // 15.8% of QR size on 380px canvas (optimal within 15-18% range)
                    width: 60,
                    excavate: true, // Clean white padded cutout ensuring finder patterns and modules are preserved
                  }}
                  className="w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] md:w-[380px] md:h-[380px] lg:w-[420px] lg:h-[420px] transition-transform"
                />
              </div>

              {/* CALM RECONNECTING OVERLAY: Gently blurs expired QR, no harsh error screen, silent recovery */}
              {showCalmReconnectingOverlay && (
                <div
                  id="calm-reconnecting-overlay"
                  className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-brand-950/70 rounded-3xl backdrop-blur-sm animate-fade-in text-center space-y-3 z-20 border border-slate-700/60 shadow-2xl"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
                    <RotateCw className="w-7 h-7 animate-spin text-cyan-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-bold text-white tracking-tight">Syncing Terminal</h2>
                    <p className="text-xs text-slate-300 max-w-xs leading-relaxed mx-auto">
                      Reconnecting securely to the attendance network. A fresh challenge will appear automatically once synced.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Auto-recovering...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Subtle Sub-Badge & Information */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto Check-In & Check-Out</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 font-medium">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Server-Controlled Timestamps</span>
              </span>
            </div>
          </div>
        )}

        {/* INITIALIZING STATE */}
        {!shouldRenderQR && terminalState === "INITIALIZING" && (
          <div className="flex flex-col items-center space-y-4 text-center max-w-md p-8 rounded-3xl bg-brand-900/60 border border-slate-800/80 backdrop-blur-md animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg">
              <RotateCw className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white tracking-tight">Starting Kiosk Feed</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Initializing cryptographic challenge generator and synchronizing with attendance cluster...
              </p>
            </div>
          </div>
        )}

        {/* STATE 2: DISABLED BY HR (QR is immediately blanked) */}
        {terminalState === "DISABLED" && (
          <div
            id="display-disabled-screen"
            className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-brand-900/90 border-2 border-amber-500/40 text-center space-y-5 shadow-2xl backdrop-blur-xl glow-amber animate-fade-in"
            role="alert"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-white">Display Temporarily Disabled</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {statusMessage ||
                  "This lobby screen has been disabled by the HR administrator. Please scan on an alternate office terminal or check in with human resources."}
              </p>
            </div>

            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Awaiting administrative re-enablement...</span>
              </div>
            </div>
          </div>
        )}

        {/* STATE 3: REVOKED BY HR (QR is immediately blanked) */}
        {terminalState === "REVOKED" && (
          <div
            id="display-revoked-screen"
            className="max-w-md w-full p-8 sm:p-10 rounded-3xl bg-brand-900/90 border-2 border-rose-500/40 text-center space-y-5 shadow-2xl backdrop-blur-xl glow-rose animate-fade-in"
            role="alert"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-white">Display Terminal Revoked</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {statusMessage ||
                  "Terminal credentials have been permanently revoked and all issued challenges were invalidated. This hardware must be reauthorized with a new pairing code."}
              </p>
            </div>

            <button
              type="button"
              id="re-pair-screen-btn"
              onClick={onUnpair}
              className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:opacity-90 font-bold text-sm text-white shadow-lg transition-all"
            >
              Pair New Terminal
            </button>
          </div>
        )}
      </main>

      {/* Optional Slim Announcement Ticker at the Bottom (flagged) */}
      {isAnnouncementTickerEnabled && <AnnouncementTicker />}

      {/* BOTTOM TELEMETRY & PRIVACY GUARANTEE */}
      <footer className="relative z-10 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-medium text-slate-400">
            Privacy Guaranteed: This display terminal never stores or displays any personal employee data.
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>VorldX High-Contrast Display Engine v1.1.0</span>
          {pendingUpdate && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] animate-pulse">
              <RotateCw className="w-2.5 h-2.5 animate-spin" />
              <span>v{pendingUpdate.version} ready (auto-reload at quiet interval)</span>
            </span>
          )}
        </div>
      </footer>

      {/* QUIET MOMENT RE-LOAD OVERLAY */}
      {isQuietUpdating && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <RotateCw className="w-8 h-8 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold text-white">Quiet Interval Detected</h3>
            <p className="text-xs text-slate-400">
              Safely reloading kiosk to apply update v{pendingUpdate?.version || "latest"}...
            </p>
          </div>
        </div>
      )}

      {/* ACCESSIBLE UNPAIR CONFIRMATION DIALOG */}
      {showUnpairConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="region"
          aria-label="Confirmation overlay"
        >
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setShowUnpairConfirm(false)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unpair-dialog-title"
            aria-describedby="unpair-dialog-desc"
            className="relative w-full max-w-md rounded-2xl bg-brand-900 border border-slate-700/80 p-6 shadow-2xl z-10 text-slate-100"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl p-3 bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h3 id="unpair-dialog-title" className="text-lg font-bold text-white tracking-tight">
                  Unpair Display Terminal?
                </h3>
                <p id="unpair-dialog-desc" className="mt-2 text-sm text-slate-300 leading-relaxed">
                  This will disconnect the kiosk monitor from the active challenge feed. To reconnect, the display will need to be re-paired with an admin registration code.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowUnpairConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Keep Paired
              </button>
              <button
                type="button"
                onClick={confirmUnpair}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shadow-sm"
              >
                Unpair Monitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
