import React, { useState, useEffect } from "react";
import { ShieldCheck, Users, ChevronDown, CheckCircle2 } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { SocketEvent } from "@vorldx/shared";

interface OnlineHrUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  employeeId?: string;
}

interface HROnlineIndicatorProps {
  className?: string;
  variant?: "pill" | "compact" | "badge";
}

export const HROnlineIndicator: React.FC<HROnlineIndicatorProps> = ({
  className = "",
  variant = "pill",
}) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [onlineUsers, setOnlineUsers] = useState<OnlineHrUser[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Fetch initial presence via REST
  useEffect(() => {
    let isMounted = true;
    api
      .get<{ success: boolean; data: { count: number; users: OnlineHrUser[] } }>("/api/presence/hr")
      .then((res) => {
        if (!isMounted) return;
        if (res?.success && res.data) {
          const count = Math.max(res.data.count, 1);
          setOnlineCount(count);
          setOnlineUsers(res.data.users || []);
        }
      })
      .catch(() => {
        // Fallback: at least the currently logged-in user is online
        if (user) {
          setOnlineCount(1);
          setOnlineUsers([
            {
              userId: user.employeeId,
              email: user.email,
              name: user.name || user.email.split("@")[0],
              role: user.role,
              employeeId: user.employeeId,
            },
          ]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Listen for real-time presence events from socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handlePresence = (data: { count: number; users: OnlineHrUser[] }) => {
      if (data && typeof data.count === "number") {
        const count = Math.max(data.count, 1);
        setOnlineCount(count);
        if (Array.isArray(data.users)) {
          setOnlineUsers(data.users);
        }
      }
    };

    socket.on(SocketEvent.HR_PRESENCE, handlePresence);
    socket.on("hr:presence", handlePresence);

    // Request initial presence on socket connect
    socket.emit("hr:get_presence", {}, (res: { count: number; users: OnlineHrUser[] }) => {
      if (res && typeof res.count === "number") {
        handlePresence(res);
      }
    });

    return () => {
      socket.off(SocketEvent.HR_PRESENCE, handlePresence);
      socket.off("hr:presence", handlePresence);
    };
  }, [socket, isConnected]);

  // Fallback user display if list is empty
  const displayUsers =
    onlineUsers.length > 0
      ? onlineUsers
      : user
      ? [
          {
            userId: user.employeeId,
            email: user.email,
            name: user.name || user.email.split("@")[0],
            role: user.role,
            employeeId: user.employeeId,
          },
        ]
      : [];

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 ${className}`}
        title={`${onlineCount} HR staff online`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>{onlineCount} HR</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 transition-colors shadow-2xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`${onlineCount} HR personnel currently active`}
        aria-expanded={isOpen}
      >
        {/* Pulsing Beacon Indicator */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>

        <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-semibold">
          {onlineCount} {onlineCount === 1 ? "HR Online" : "HR Online"}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu showing online HR staff */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150"
          role="dialog"
          aria-label="Online HR Staff Directory"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Active HR Presence
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {onlineCount} active
            </span>
          </div>

          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {displayUsers.map((hr, idx) => (
              <div
                key={hr.userId || idx}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                    {(hr.name || hr.email || "HR")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {hr.name || hr.email.split("@")[0]}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate font-mono">
                      {hr.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] uppercase font-bold text-slate-400">
                    {hr.role === "ADMIN" ? "Admin" : "HR"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
            Synced in real time via WebSockets
          </div>
        </div>
      )}
    </div>
  );
};
