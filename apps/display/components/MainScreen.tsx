"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { io, Socket } from "socket.io-client";
import { StoredDisplayCredentials, clearStoredCredentials } from "../lib/storage";
import { fetchRotatingChallenge, DisplayApiError, QrTokenResponse, checkDisplayUpdate } from "../lib/api";
import { CountdownRing } from "./CountdownRing";
import { AnnouncementTicker } from "./AnnouncementTicker";
import {
  Wifi,
  WifiOff,
  ShieldAlert,
  Clock,
  RotateCw,
  LogOut,
  Sparkles,
  AlertTriangle,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { SocketEvent, TerminalStatus } from "@vorldx/shared";

interface MainScreenProps {
  creds: StoredDisplayCredentials;
  onUnpair: () => void;
}

type TerminalState = "ACTIVE" | "DISABLED" | "REVOKED" | "EXPIRED" | "INITIALIZING";

export const MainScreen: React.FC<MainScreenProps> = ({ creds, onUnpair }) => {
  const [tokenData, setTokenData] = useState<QrTokenResponse | null>(null);
  const [terminalState, setTerminalState] = useState<TerminalState>("INITIALIZING");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");
  const [pendingUpdate, setPendingUpdate] = useState<{ version: string; notes?: string } | null>(null);
  const [isQuietUpdating, setIsQuietUpdating] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const tokenDataRef = useRef<QrTokenResponse | null>(null);
  const lastPunchRef = useRef<number>(Date.now());
  tokenDataRef.current = tokenData;

  // Live wall-clock updater
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
          weekday: "long",
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

  // Fetch rotating challenge from backend
  const requestNewChallenge = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const response = await fetchRotatingChallenge(creds);

      setIsRotating(true);
      setTokenData(response);
      setTerminalState("ACTIVE");
      setStatusMessage("");

      // Smooth rotation animation reset
      setTimeout(() => setIsRotating(false), 500);
    } catch (err: unknown) {
      if (err instanceof DisplayApiError) {
        if (
          err.code === "ERR_DISPLAY_REVOKED" ||
          err.code === "ERR_TERMINAL_UNAUTHORIZED" ||
          err.status === 401
        ) {
          clearStoredCredentials();
          setTokenData(null);
          setTerminalState("REVOKED");
          setStatusMessage("This display terminal has been revoked by an administrator.");
        } else if (err.code === "ERR_DISPLAY_DISABLED") {
          setTokenData(null);
          setTerminalState("DISABLED");
          setStatusMessage("This display terminal is currently disabled by HR.");
        }
      } else {
        // Network error: will retry
        console.warn("Challenge fetch network error:", err);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [creds]);

  // Proactive countdown and refresh loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (!tokenDataRef.current?.expiresAt) return;

      const expiresTime = new Date(tokenDataRef.current.expiresAt).getTime();
      const diffMs = expiresTime - Date.now();
      const secondsLeft = Math.max(0, diffMs / 1000);

      setRemainingSeconds(secondsLeft);

      // Proactively fetch next challenge 5 seconds before current one expires
      if (secondsLeft <= 5 && !isFetchingRef.current && terminalState === "ACTIVE") {
        requestNewChallenge();
      }

      // If token expired and no replacement arrived yet
      if (secondsLeft <= 0 && terminalState === "ACTIVE") {
        setTerminalState("EXPIRED");
      }
    }, 150);

    return () => clearInterval(timer);
  }, [requestNewChallenge, terminalState]);

  // Socket.IO Integration
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
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // Resync on connection/reconnection
      socket.emit(SocketEvent.RESYNC, { type: "display" });
      requestNewChallenge();
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    // Handle token rotation broadcast
    const handleQrRotated = (data: QrTokenResponse) => {
      if (data && (data.token || data.qrPayload)) {
        setIsRotating(true);
        setTokenData(data);
        setTerminalState("ACTIVE");
        setStatusMessage("");
        setTimeout(() => setIsRotating(false), 500);
      }
    };

    socket.on(SocketEvent.QR_ROTATED, handleQrRotated);
    socket.on(SocketEvent.QR_TOKEN_ROTATE, handleQrRotated);

    // Handle display status changes (Disabled / Revoked / Activated)
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
        setTokenData(null);
        setTerminalState("REVOKED");
        setStatusMessage(data.message || "Display terminal revoked. All tokens invalidated.");
      } else if (!data.isActive || data.status === TerminalStatus.DISABLED || data.status === "DISABLED") {
        setTokenData(null);
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

    // Heartbeat every 30s
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit(SocketEvent.DISPLAY_HEARTBEAT, { terminalId: creds.terminalId });
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [creds, requestNewChallenge]);

  // Periodic Display Version Poll
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

  // Safe Quiet-Moment Auto-Reload Evaluator
  useEffect(() => {
    if (!pendingUpdate || isQuietUpdating) return;

    const quietInterval = setInterval(() => {
      const idleSeconds = (Date.now() - lastPunchRef.current) / 1000;
      // Quiet moment: terminal is ACTIVE and idle without any punch for at least 30s
      if (idleSeconds >= 30 && terminalState === "ACTIVE") {
        setIsQuietUpdating(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }, 5000);

    return () => clearInterval(quietInterval);
  }, [pendingUpdate, isQuietUpdating, terminalState]);

  // Initial fetch on mount
  useEffect(() => {
    requestNewChallenge();
  }, [requestNewChallenge]);

  const handleManualUnpair = () => {
    if (confirm("Are you sure you want to unpair this display monitor?")) {
      clearStoredCredentials();
      onUnpair();
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-8 md:p-10 bg-brand-950 text-slate-100 select-none overflow-hidden relative"
      role="region"
      aria-label="VorldX Attendance Kiosk"
    >
      {/* Background Ambience Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP TELEMETRY BAR */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        {/* Left: Branding & Terminal Info */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <QrCode className="w-6 h-6 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                VORLDX
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold tracking-widest uppercase">
                KIOSK
              </span>
            </div>

            <p id="display-terminal-name" className="text-xs sm:text-sm text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
              {creds.name} • <span className="text-slate-500">{creds.location}</span>
            </p>
          </div>
        </div>

        {/* Right: Live Clock & Network Indicator */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Live Clock */}
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-base sm:text-lg font-mono font-bold text-white tracking-wide">
              {currentTime}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">{currentDate}</span>
          </div>

          {/* Connection Status Pill */}
          <div
            id="connection-status-pill"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
              isConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : isReconnecting
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-3.5 h-3.5" />
                <span>Connected</span>
              </>
            ) : isReconnecting ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Unpair / Settings Button */}
          <button
            type="button"
            id="unpair-kiosk-btn"
            onClick={handleManualUnpair}
            title="Unpair Display Terminal"
            className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CENTER STAGE */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center my-6 sm:my-8 text-center">
        {/* STATE 1: ACTIVE (Normal Operation) */}
        {terminalState === "ACTIVE" && tokenData?.qrPayload ? (
          <div className="flex flex-col items-center space-y-6 sm:space-y-8 animate-fade-in">
            {/* Primary Instruction Header */}
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Scan to Record Attendance
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-slate-400 max-w-lg">
                Hold phone camera steadily in front of the screen using the VorldX Mobile App
              </p>
            </div>

            {/* QR Card & Countdown Ring Container */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10">
              {/* Very Large High-Contrast QR Code Card */}
              <div
                id="active-qr-container"
                className={`p-5 sm:p-7 bg-white rounded-3xl shadow-2xl transition-all duration-300 glow-cyan ${
                  isRotating ? "scale-[0.98] opacity-80" : "scale-100 opacity-100"
                }`}
              >
                <QRCodeSVG
                  id="vorldx-dynamic-qr-code"
                  value={tokenData.qrPayload}
                  size={300}
                  level="Q" // 25% Error Correction for screen scanning
                  includeMargin={false}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] md:w-[320px] md:h-[320px] transition-transform"
                />
              </div>

              {/* Side Countdown Ring & Instructions */}
              <div className="flex flex-col items-center md:items-start space-y-4">
                <CountdownRing
                  ttlSeconds={tokenData.ttlSeconds || 30}
                  remainingSeconds={remainingSeconds}
                  size={120}
                  strokeWidth={8}
                />

                <div className="text-center md:text-left space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cryptographic Dynamic Challenge</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Nonce Epoch #{tokenData.ttlSeconds}s • Replay Protected
                  </p>
                </div>
              </div>
            </div>

            {/* Instruction Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Auto-Toggles Check-In / Check-Out
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Server-Controlled Timestamps
              </span>
            </div>
          </div>
        ) : null}

        {/* STATE 2: DISABLED BY HR */}
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

        {/* STATE 3: REVOKED */}
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

        {/* STATE 4: EXPIRED / RECONNECTING */}
        {(terminalState === "EXPIRED" || terminalState === "INITIALIZING") && (
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <RotateCw className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">Refreshing Attendance Challenge</h3>
              <p className="text-xs text-slate-400">
                Fetching next cryptographic rotating token from attendance cluster...
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Optional Slim Announcement Ticker at the Bottom */}
      <AnnouncementTicker />

      {/* BOTTOM TELEMETRY & PRIVACY GUARANTEE */}
      <footer className="relative z-10 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-medium text-slate-400">
            Privacy Guaranteed: This display terminal never stores or displays any personal employee data.
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>VorldX High-Contrast Display Engine v1.0.0</span>
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
    </div>
  );
};

