"use client";

import React, { useState, useEffect } from "react";
import { pairDisplayTerminal, DisplayApiError } from "../lib/api";
import { saveStoredCredentials, StoredDisplayCredentials } from "../lib/storage";
import { Monitor, ShieldCheck, ArrowRight, Loader2, AlertCircle, Sparkles } from "lucide-react";

interface PairingScreenProps {
  onPaired: (creds: StoredDisplayCredentials) => void;
  initialCode?: string;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({ onPaired, initialCode = "" }) => {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Check URL query parameters on mount for pre-filled pairing links (?code=... or ?pairingCode=...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlCode = urlParams.get("code") || urlParams.get("pairingCode");
      if (urlCode && !code) {
        setCode(urlCode.trim().toUpperCase());
      }
    }
  }, [code]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    // Auto-prefix VX- if staff starts typing 4 digits
    if (/^\d{1,4}$/.test(val) && !val.startsWith("VX-")) {
      val = `VX-${val}`;
    }
    setCode(val);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.replace(/\s+/g, '').toUpperCase();

    if (!cleanCode) {
      setError("Please enter the pairing code from the HR dashboard.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage("Authenticating with VorldX central attendance engine...");

    try {
      const result = await pairDisplayTerminal(cleanCode);

      setStatusMessage("Terminal authorized! Initializing dynamic QR challenge engine...");

      const storedCreds: StoredDisplayCredentials = {
        displayId: result.displayId,
        terminalId: result.terminalId,
        credential: result.credential,
        name: result.name,
        location: result.location,
        pairedAt: new Date().toISOString(),
      };

      saveStoredCredentials(storedCreds);

      // Brief delay so staff sees the success status before transitioning
      setTimeout(() => {
        onPaired(storedCreds);
      }, 700);
    } catch (err: unknown) {
      if (err instanceof DisplayApiError) {
        setError(err.message || "Failed to pair display terminal.");
      } else {
        setError("Network error: Unable to reach attendance server.");
      }
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-b from-brand-950 via-brand-900 to-slate-950 text-slate-100"
      role="main"
      aria-label="Display Terminal Pairing Interface"
    >
      <div className="w-full max-w-xl mx-auto">
        {/* Terminal Card */}
        <div className="bg-brand-900/80 border border-slate-700/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl glow-blue">
          {/* Header Branding */}
          <div className="text-center space-y-3 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wider uppercase">
              <Monitor className="w-3.5 h-3.5" />
              <span>Office Terminal Setup</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-3">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                VorldX
              </span>
              <span>QR Display</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
              Pair this physical display monitor with the organization&apos;s live attendance cluster to begin broadcasting rotating QR challenges.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="pairing-code-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2"
              >
                15-Minute Pairing Code
              </label>

              <div className="relative">
                <input
                  id="pairing-code-input"
                  type="text"
                  maxLength={10}
                  placeholder="e.g. VX-9988"
                  value={code}
                  onChange={handleCodeChange}
                  disabled={loading}
                  autoFocus
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full px-5 py-4 text-center font-mono text-2xl sm:text-3xl font-black tracking-widest rounded-2xl bg-brand-950/80 border-2 border-slate-700 text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20 transition-all uppercase"
                />
              </div>

              <p className="mt-2 text-xs text-slate-400 text-center">
                Generated by HR under <span className="text-slate-300 font-semibold">QR Displays</span> in the admin portal.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                id="pairing-error-alert"
                className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs sm:text-sm flex items-start gap-3"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Pairing Failed:</span>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Status Message */}
            {statusMessage && !error && (
              <div
                className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm flex items-center justify-center gap-2"
                role="status"
              >
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              id="pair-submit-btn"
              disabled={loading || !code.trim()}
              className="w-full py-4 px-6 rounded-2xl font-bold text-base bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 text-white hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Pair and Authorize Screen</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Note */}
          <div className="mt-8 pt-6 border-t border-slate-800 text-center flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted one-time pairing • Hardware display credential stored locally</span>
          </div>
        </div>

        {/* Demo Helper Banner */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>VorldX Enterprise Attendance Suite • Monitor & Tablet Kiosk</span>
        </div>
      </div>
    </main>
  );
};

