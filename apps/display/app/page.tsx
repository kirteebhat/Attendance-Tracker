"use client";

import React, { useState, useEffect } from "react";
import { getStoredCredentials, StoredDisplayCredentials } from "../lib/storage";
import { PairingScreen } from "../components/PairingScreen";
import { MainScreen } from "../components/MainScreen";
import { Loader2 } from "lucide-react";

export default function DisplayKioskRoot() {
  const [creds, setCreds] = useState<StoredDisplayCredentials | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    const existing = getStoredCredentials();
    if (existing) {
      setCreds(existing);
    }
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen w-full bg-brand-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Initializing Terminal Hardware...
        </span>
      </div>
    );
  }

  if (!creds) {
    return <PairingScreen onPaired={(newCreds) => setCreds(newCreds)} />;
  }

  return (
    <MainScreen
      creds={creds}
      onUnpair={() => {
        setCreds(null);
      }}
    />
  );
}
