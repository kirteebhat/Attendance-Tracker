import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { io as ioClient, Socket } from "socket.io-client";
import {
  Building2,
  Lock,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Info,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Clock,
  Laptop,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { OtpInput } from "../components/auth/OtpInput";
import { LivePulseIndicator } from "../components/ui/LivePulseIndicator";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)", flag: "🇮🇳" },
  { code: "+1", label: "US/Canada (+1)", flag: "🇺🇸" },
  { code: "+44", label: "UK (+44)", flag: "🇬🇧" },
  { code: "+971", label: "UAE (+971)", flag: "🇦🇪" },
  { code: "+65", label: "Singapore (+65)", flag: "🇸🇬" },
];

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormData = z.infer<typeof loginSchema>;

type SocketAuthStatus =
  | "IDLE"
  | "SENDING"
  | "SENT"
  | "VERIFYING"
  | "VERIFIED"
  | "FAILED"
  | "LOCKED";

export const LoginPage: React.FC = () => {
  const { login, requestStaffOtp, verifyStaffOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: "OTP" (primary staff mobile login) | "PASSWORD" (legacy credentials)
  const [authMode, setAuthMode] = useState<"OTP" | "PASSWORD">("OTP");

  // OTP Step: "ENTER_MOBILE" | "ENTER_OTP"
  const [otpStep, setOtpStep] = useState<"ENTER_MOBILE" | "ENTER_OTP">("ENTER_MOBILE");

  // Mobile & Country Code
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [mobileNumber, setMobileNumber] = useState<string>("9876543210");
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);

  // OTP State
  const [otpValue, setOtpValue] = useState<string>("");
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);

  // Timers: Cooldown (60s) and Expiry (300s)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [expiryRemaining, setExpiryRemaining] = useState<number>(0);

  // Feedback & Loading
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [socketStatus, setSocketStatus] = useState<SocketAuthStatus>("IDLE");
  const [socketStatusDetail, setSocketStatusDetail] = useState<string>(
    "Awaiting staff verification request"
  );

  const socketRef = useRef<Socket | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const reasonParam = searchParams.get("reason");
  const sessionExpired = reasonParam === "session_expired";
  const sessionRevoked = reasonParam === "session_revoked";
  const forcedLogout = reasonParam === "forced_logout";
  const redirectTarget = searchParams.get("redirect") || "/";

  // Password Form
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors: passwordErrors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "admin@vorldx.demo",
      password: "Admin@VorldX2026!",
    },
  });

  // Real-Time Socket Connection for Login Channel
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_API_URL || undefined;
    const socket = ioClient(wsUrl, {
      auth: { type: "staff_login", channel: "staff_login" },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      // Connected as guest to staff login channel
    });

    socket.on("staff:otp_requested", () => {
      setSocketStatus("SENDING");
      setSocketStatusDetail("Generating cryptographic challenge...");
    });

    socket.on("staff:otp_sent", () => {
      setSocketStatus("SENT");
      setSocketStatusDetail("Verification code dispatched via SMS!");
    });

    socket.on("staff:otp_verified", () => {
      setSocketStatus("VERIFIED");
      setSocketStatusDetail("Authentication confirmed! Establishing session...");
    });

    socket.on("staff:otp_failed", (data: { remainingAttempts?: number }) => {
      setSocketStatus("FAILED");
      const attempts = data?.remainingAttempts ?? 0;
      setSocketStatusDetail(
        attempts > 0
          ? `Code incorrect. ${attempts} attempt(s) remaining.`
          : "Code incorrect. Verification failed."
      );
    });

    socket.on("staff:otp_locked", () => {
      setSocketStatus("LOCKED");
      setSocketStatusDetail("Account locked! Consecutive failed attempts exceeded.");
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Cooldown Countdown Interval
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  // Expiry Countdown Interval
  useEffect(() => {
    if (expiryRemaining <= 0) return;
    const timer = setInterval(() => {
      setExpiryRemaining((prev) => {
        if (prev <= 1) {
          setServerError("Verification code has expired. Please request a new code.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [expiryRemaining]);

  // Handle Mobile OTP Request
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setServerError(null);
    setServerNotice(null);

    const fullMobile = `${countryCode}${mobileNumber.trim().replace(/^0+/, "")}`;
    if (!/^\+\d{10,15}$/.test(fullMobile)) {
      setServerError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsSubmitting(true);
    setSocketStatus("SENDING");
    setSocketStatusDetail("Dispatching SMS verification code...");

    try {
      const res = await requestStaffOtp({ mobileNumber: fullMobile });
      setOtpStep("ENTER_OTP");
      setCooldownRemaining(res.cooldownSeconds || 60);
      setExpiryRemaining(res.expiresInSeconds || 300);

      if (res.simulatedDemoOtp) {
        setSimulatedOtp(res.simulatedDemoOtp);
      }

      setServerNotice(res.message);
      setSocketStatus("SENT");
      setSocketStatusDetail("Code dispatched to your mobile device.");
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setServerError(errorObj.message || "Unable to request verification code.");
      setSocketStatus("FAILED");
      setSocketStatusDetail("Request failed. Please verify the mobile number.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP Submission
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setServerError(null);

    if (otpValue.length !== 6) {
      setServerError("Please enter the complete 6-digit verification code.");
      return;
    }

    const fullMobile = `${countryCode}${mobileNumber.trim().replace(/^0+/, "")}`;
    setIsSubmitting(true);
    setSocketStatus("VERIFYING");
    setSocketStatusDetail("Verifying code & device fingerprint...");

    try {
      await verifyStaffOtp({
        mobileNumber: fullMobile,
        otp: otpValue,
        purpose: "LOGIN",
        rememberDevice,
      });

      setSocketStatus("VERIFIED");
      setSocketStatusDetail("Verified! Establishing staff session...");

      setTimeout(() => {
        navigate(redirectTarget, { replace: true });
      }, 300);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setServerError(errorObj.message || "Invalid or expired verification code.");
      setSocketStatus("FAILED");
      setSocketStatusDetail("Verification failed. Please re-check the 6-digit code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Legacy Password Submission
  const onPasswordSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await login(data);
      navigate(redirectTarget, { replace: true });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setServerError(errorObj.message || "Invalid credentials. Please verify and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoFill = (identifier: string) => {
    setValue("identifier", identifier);
    if (identifier.includes("admin")) {
      setValue("password", "Admin@VorldX2026!");
    } else {
      setValue("password", "Hr@VorldX2026!");
    }
    setServerError(null);
  };

  const handleStaffDemoMobile = (mobile: string) => {
    setMobileNumber(mobile.replace(/^\+91/, ""));
    setServerError(null);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-slate-900">
      {/* Background Decorative Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[520px] bg-gradient-to-tr from-blue-600/25 via-indigo-600/20 to-cyan-500/25 rounded-full blur-3xl opacity-75" />
      </div>

      <div className="relative w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 items-center justify-center text-white shadow-xl shadow-blue-500/25 mb-1 ring-4 ring-white/10">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>Vorld</span>
            <span className="text-cyan-400">X</span>
            <span className="font-light text-slate-300">Staff Portal</span>
          </h1>
          <p className="text-xs text-slate-400">
            Enterprise Attendance & Biometric QR Infrastructure
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex items-center p-1 bg-slate-800/80 backdrop-blur-md rounded-xl border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setAuthMode("OTP");
              setServerError(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              authMode === "OTP"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Staff Mobile OTP</span>
            <span className="text-[10px] bg-blue-500/30 text-cyan-200 px-1.5 py-0.2 rounded font-mono">
              2.0
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("PASSWORD");
              setServerError(null);
            }}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              authMode === "PASSWORD"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password Sign In</span>
          </button>
        </div>

        {/* Main Card */}
        <Card className="p-6 sm:p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl transition-colors">
          {/* Notifications & Reason Banners */}
          {sessionExpired && (
            <div className="mb-5 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-amber-900 dark:text-amber-300">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">Session Expired</span>
                Your authentication session has expired. Please sign in to resume.
              </div>
            </div>
          )}

          {sessionRevoked && (
            <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-900 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">Session Terminated</span>
                Your session was revoked from security settings or another device.
              </div>
            </div>
          )}

          {forcedLogout && (
            <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-900 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">Administrative Force Logout</span>
                An administrator has terminated your staff session.
              </div>
            </div>
          )}

          {serverNotice && !serverError && (
            <div className="mb-5 p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-2.5 text-blue-900 dark:text-blue-300">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs font-medium">{serverNotice}</div>
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start justify-between gap-2.5 text-rose-900 dark:text-rose-300"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <div className="text-xs font-medium">{serverError}</div>
              </div>
              {otpStep === "ENTER_MOBILE" && authMode === "OTP" && (
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep("ENTER_OTP");
                    setServerError(null);
                    if (!expiryRemaining) setExpiryRemaining(300);
                  }}
                  className="px-2 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shrink-0 transition-colors"
                >
                  Enter OTP
                </button>
              )}
            </div>
          )}

          {/* Real-Time Socket Status Line */}
          <div className="mb-5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <LivePulseIndicator
                variant={
                  socketStatus === "LOCKED" || socketStatus === "FAILED"
                    ? "warning"
                    : socketStatus === "VERIFYING" || socketStatus === "SENDING"
                    ? "syncing"
                    : socketStatus === "VERIFIED"
                    ? "live"
                    : "offline"
                }
                size="sm"
                showLabel={false}
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                {socketStatusDetail}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400 shrink-0">
              {socketStatus}
            </span>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: STAFF MOBILE OTP FLOW                                             */}
          {/* ========================================================================= */}
          {authMode === "OTP" && (
            <div>
              {otpStep === "ENTER_MOBILE" && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Registered Staff Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-28 px-2.5 py-2.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit number"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                        maxLength={12}
                        className="flex-1 px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      Enter the mobile number linked to your Admin or HR account.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full font-semibold shadow-md shadow-blue-600/20 mt-2"
                    isLoading={isSubmitting}
                  >
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Have an OTP code already?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("ENTER_OTP");
                        setServerError(null);
                        if (!expiryRemaining) setExpiryRemaining(300);
                      }}
                      className="text-blue-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>Enter 6-digit OTP directly</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}

              {otpStep === "ENTER_OTP" && (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="text-center space-y-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Code dispatched to{" "}
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {countryCode} {mobileNumber}
                      </span>
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <Clock className="w-3.5 h-3.5 text-cyan-500" />
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        Code expires in:{" "}
                        <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400">
                          {formatTimer(expiryRemaining)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Six-box OTP Input */}
                  <div className="py-2">
                    <OtpInput
                      value={otpValue}
                      onChange={(val) => {
                        setOtpValue(val);
                        setServerError(null);
                      }}
                      disabled={isSubmitting}
                      hasError={!!serverError}
                    />
                  </div>

                  {/* Remember Device Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="rememberDevice"
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-700 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="rememberDevice"
                      className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5 select-none"
                    >
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      <span>Remember this device for 30 days</span>
                    </label>
                  </div>

                  {/* Simulated Demo OTP Banner */}
                  <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-cyan-900 dark:text-cyan-200">
                      <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />
                      <div>
                        <span className="font-semibold block">
                          {simulatedOtp ? "Generated Demo Code:" : "Demo Staff OTP Code:"}
                        </span>
                        <span className="font-mono text-base font-bold tracking-widest text-cyan-600 dark:text-cyan-400">
                          {simulatedOtp || "123456"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtpValue(simulatedOtp || "123456")}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors shrink-0"
                    >
                      Auto-fill
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center">
                    Note: Telecom SMS is simulated. Use the code above or click <span className="font-semibold text-cyan-400">Auto-fill</span> to test.
                  </p>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full font-semibold shadow-md shadow-blue-600/20"
                      isLoading={isSubmitting}
                      disabled={otpValue.length !== 6}
                    >
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                      <span>Verify & Sign In</span>
                    </Button>

                    <div className="flex items-center justify-between pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep("ENTER_MOBILE");
                          setOtpValue("");
                          setServerError(null);
                        }}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                      >
                        Change number
                      </button>

                      <button
                        type="button"
                        disabled={cooldownRemaining > 0 || isSubmitting}
                        onClick={() => handleRequestOtp()}
                        className={`font-medium transition-colors flex items-center gap-1 ${
                          cooldownRemaining > 0
                            ? "text-slate-400 cursor-not-allowed"
                            : "text-blue-600 dark:text-cyan-400 hover:underline"
                        }`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>
                          {cooldownRemaining > 0
                            ? `Resend in ${cooldownRemaining}s`
                            : "Resend Code"}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Demo Staff Number Switcher */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Demo Staff Mobile Switcher</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleStaffDemoMobile("9876543210")}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors text-left flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <div className="truncate">
                      <span className="block font-semibold">Admin Staff</span>
                      <span className="font-mono text-[10px] text-slate-400">+91 9876543210</span>
                      <span className="font-mono text-[10px] text-cyan-500 dark:text-cyan-400 font-semibold block">Code: 123456</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStaffDemoMobile("9876543211")}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors text-left flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-600 shrink-0" />
                    <div className="truncate">
                      <span className="block font-semibold">HR Staff</span>
                      <span className="font-mono text-[10px] text-slate-400">+91 9876543211</span>
                      <span className="font-mono text-[10px] text-cyan-500 dark:text-cyan-400 font-semibold block">Code: 123456</span>
                    </div>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5 text-center leading-relaxed">
                  💡 <span className="font-semibold text-slate-300">Staff OTP Demo Code:</span>{" "}
                  <span className="font-mono font-bold text-cyan-400">123456</span>. Real SMS requires paid telecom gateway credits; use <span className="font-mono font-semibold">123456</span> to sign in.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PASSWORD SIGN IN FLOW                                              */}
          {/* ========================================================================= */}
          {authMode === "PASSWORD" && (
            <div>
              <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
                <div>
                  <Input
                    label="Email or Employee ID"
                    placeholder="e.g. admin@vorldx.demo or ADM-001"
                    autoComplete="username"
                    error={passwordErrors.identifier?.message}
                    {...register("identifier")}
                  />
                </div>

                <div>
                  <Input
                    type="password"
                    label="Password"
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    error={passwordErrors.password?.message}
                    {...register("password")}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2 font-semibold shadow-md shadow-blue-600/20"
                  isLoading={isSubmitting}
                >
                  <Lock className="w-4 h-4 mr-1.5" />
                  Sign In with Password
                </Button>
              </form>

              {/* Quick Demo Credentials Autofill */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Demo Quick Switcher</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleDemoFill("admin@vorldx.demo")}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors text-left flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>Demo Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoFill("hr@vorldx.demo")}
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors text-left flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-600" />
                    <span>Demo HR</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          VorldX Industries &copy; 2026. Zero-Trust Hardware & Multi-Factor Staff Portal.
        </p>
      </div>
    </div>
  );
};
