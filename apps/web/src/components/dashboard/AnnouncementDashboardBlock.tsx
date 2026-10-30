import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Megaphone,
  Pin,
  CheckCircle2,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import {
  useAnnouncements,
  useMarkAnnouncementRead,
} from "../../api/queries";
import { useSocket } from "../../context/SocketContext";
import { Skeleton } from "../ui/Skeleton";

const DISMISSED_KEY = "vorldx_dismissed_announcements";

export const AnnouncementDashboardBlock: React.FC = () => {
  const { data: response, isLoading, refetch } = useAnnouncements({ limit: 10 });
  const markReadMutation = useMarkAnnouncementRead();
  const { socket } = useSocket();

  // Track locally dismissed announcement IDs
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Listen to live socket events
  useEffect(() => {
    if (!socket) return;

    const handleAnnouncement = () => {
      refetch();
    };

    socket.on("announcement.published", handleAnnouncement);
    socket.on("announcement.pinned", handleAnnouncement);

    return () => {
      socket.off("announcement.published", handleAnnouncement);
      socket.off("announcement.pinned", handleAnnouncement);
    };
  }, [socket, refetch]);

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage error
    }
    // Also mark as read in background if unread
    markReadMutation.mutate(id);
  };

  const handleMarkRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    markReadMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 bg-white/60 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  const allAnnouncements = Array.isArray(response?.data) ? response.data : [];
  // Filter out dismissed announcements
  const visibleAnnouncements = allAnnouncements.filter(
    (item) => !dismissedIds.includes(item._id)
  );

  if (allAnnouncements.length === 0) {
    return (
      <div
        id="dashboard-announcements-empty"
        className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-cyan-400">
            <Megaphone className="w-4 h-4" />
          </div>
          <span>No active broadcasts at the moment. Publish company notices or configure automated calendar alerts.</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/announcements"
            className="px-3 py-1.5 font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            + Post Announcement
          </Link>
        </div>
      </div>
    );
  }

  if (visibleAnnouncements.length === 0) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>All recent announcements dismissed from your dashboard view.</span>
        </div>
        <Link to="/announcements" className="text-blue-600 dark:text-cyan-400 font-semibold hover:underline">
          View All ({allAnnouncements.length}) →
        </Link>
      </div>
    );
  }

  // Priority metadata helper
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return {
          icon: AlertTriangle,
          badgeBg: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
          cardBorder: "border-l-4 border-l-red-500 border-slate-200 dark:border-slate-800",
          cardBg: "bg-gradient-to-r from-red-50/70 via-white to-white dark:from-red-950/20 dark:via-slate-900 dark:to-slate-900",
          iconColor: "text-red-600 dark:text-red-400",
        };
      case "HIGH":
        return {
          icon: AlertCircle,
          badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
          cardBorder: "border-l-4 border-l-amber-500 border-slate-200 dark:border-slate-800",
          cardBg: "bg-gradient-to-r from-amber-50/60 via-white to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900",
          iconColor: "text-amber-600 dark:text-amber-400",
        };
      case "LOW":
        return {
          icon: Bell,
          badgeBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300",
          cardBorder: "border-l-4 border-l-slate-400 border-slate-200 dark:border-slate-800",
          cardBg: "bg-white dark:bg-slate-900",
          iconColor: "text-slate-500 dark:text-slate-400",
        };
      case "MEDIUM":
      default:
        return {
          icon: Info,
          badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
          cardBorder: "border-l-4 border-l-blue-500 border-slate-200 dark:border-slate-800",
          cardBg: "bg-gradient-to-r from-blue-50/50 via-white to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900",
          iconColor: "text-blue-600 dark:text-blue-400",
        };
    }
  };

  return (
    <div className="space-y-3" id="dashboard-announcements-block">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          <Megaphone className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
          <span>Company Announcements & Alerts</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            {visibleAnnouncements.length}
          </span>
        </div>
        <Link
          to="/announcements"
          className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
        >
          <span>All Announcements</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2.5">
        {visibleAnnouncements.slice(0, 3).map((item) => {
          const config = getPriorityConfig(item.priority);
          const PriorityIcon = config.icon;
          const isAuto = item.source === "auto" || Boolean(item.isAuto);

          return (
            <div
              key={item._id}
              className={`p-4 rounded-xl border shadow-xs transition-all ${config.cardBorder} ${config.cardBg}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`mt-0.5 p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 shadow-xs shrink-0 ${config.iconColor}`}>
                    <PriorityIcon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Badges strip */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {item.pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
                          PINNED
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold border ${config.badgeBg}`}
                      >
                        {item.priority}
                      </span>

                      {isAuto && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                          <Sparkles className="w-3 h-3 text-cyan-500" />
                          AUTO
                        </span>
                      )}

                      {item.audience?.scope && item.audience.scope !== "all" && (
                        <span className="px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {item.audience.scope.toUpperCase()}
                        </span>
                      )}

                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Unread" />
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </h4>

                    {/* Body */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                      {item.body}
                    </p>
                  </div>
                </div>

                {/* Quick Action Buttons: Read & Dismiss */}
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(item._id, e)}
                      title="Mark as Read"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDismiss(item._id, e)}
                    title="Dismiss Announcement"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

