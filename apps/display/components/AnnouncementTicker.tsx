"use client";

import React, { useState, useEffect } from "react";
import { Megaphone, Sparkles, AlertTriangle, AlertCircle, Pin, X } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface DisplayAnnouncement {
  _id: string;
  title: string;
  body: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  pinned: boolean;
  source?: "manual" | "auto";
  isAuto?: boolean;
  startsAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const AnnouncementTicker: React.FC = () => {
  const [announcements, setAnnouncements] = useState<DisplayAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Fetch initial public announcements
  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/announcements/public?limit=8`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAnnouncements(json.data);
        }
      }
    } catch {
      // Ignore network errors on ticker
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    // Connect to Socket.IO for real-time delivery
    let socket: Socket | null = null;
    try {
      socket = io(API_BASE, {
        transports: ["websocket", "polling"],
        reconnection: true,
      });

      socket.on("announcement.published", () => {
        fetchAnnouncements();
      });

      socket.on("announcement.pinned", () => {
        fetchAnnouncements();
      });
    } catch {
      // socket init error
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Cycle announcements every 7 seconds if multiple exist
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [announcements.length]);

  if (!isVisible || announcements.length === 0) {
    return null;
  }

  const current = announcements[currentIndex] || announcements[0];
  const isUrgent = current.priority === "URGENT";
  const isHigh = current.priority === "HIGH";
  const isAuto = current.source === "auto" || Boolean(current.isAuto);

  return (
    <div
      id="display-announcement-ticker"
      className="w-full transition-all duration-500 ease-in-out my-2"
    >
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2 rounded-xl border backdrop-blur-md shadow-lg ${
          isUrgent
            ? "bg-rose-950/70 border-rose-500/50 text-rose-200"
            : isHigh
            ? "bg-amber-950/70 border-amber-500/50 text-amber-200"
            : "bg-slate-900/80 border-slate-700/80 text-cyan-200"
        }`}
      >
        {/* Left Badge & Icon */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className={`p-1.5 rounded-lg ${
              isUrgent
                ? "bg-rose-500 text-white animate-pulse"
                : isHigh
                ? "bg-amber-500 text-slate-950"
                : "bg-cyan-500/20 text-cyan-400"
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-4 h-4" />
            ) : isHigh ? (
              <AlertCircle className="w-4 h-4" />
            ) : isAuto ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Megaphone className="w-4 h-4" />
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                isUrgent
                  ? "bg-rose-500/30 text-rose-300 border border-rose-500/40"
                  : isHigh
                  ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              }`}
            >
              {isUrgent ? "URGENT NOTICE" : isHigh ? "IMPORTANT" : isAuto ? "NOTICE" : "ANNOUNCEMENT"}
            </span>

            {current.pinned && (
              <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Pin className="w-2.5 h-2.5" />
                PINNED
              </span>
            )}
          </div>
        </div>

        {/* Center Scrolling / Cycling Text */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
          <span className="text-xs font-bold text-white truncate shrink-0">
            {current.title}:
          </span>
          <span className="text-xs text-slate-300 truncate">
            {current.body}
          </span>
        </div>

        {/* Counter indicator and dismiss */}
        <div className="shrink-0 flex items-center gap-2 text-[10px] font-mono text-slate-400">
          {announcements.length > 1 && (
            <span>
              {currentIndex + 1}/{announcements.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            title="Hide ticker"
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
