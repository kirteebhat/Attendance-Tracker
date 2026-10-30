import React, { useState } from "react";
import { Radio, Pause, Play, ArrowDownRight, ArrowUpRight, Clock, AlertTriangle } from "lucide-react";
import { LiveScanFeedItem, AttendanceStatus } from "@vorldx/shared";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

interface LiveScanFeedProps {
  scans: LiveScanFeedItem[];
  isLive?: boolean;
}

export const LiveScanFeed: React.FC<LiveScanFeedProps> = ({ scans = [], isLive = true }) => {
  const [filter, setFilter] = useState<"ALL" | "CHECK_IN" | "CHECK_OUT" | "LATE">("ALL");
  const [isPaused, setIsPaused] = useState(false);

  const filteredScans = scans.filter((s) => {
    if (filter === "CHECK_IN") return s.punchType === "CHECK_IN";
    if (filter === "CHECK_OUT") return s.punchType === "CHECK_OUT";
    if (filter === "LATE") return s.isLate || s.status === AttendanceStatus.LATE;
    return true;
  });

  const getStatusBadge = (item: LiveScanFeedItem) => {
    if (item.isLate || item.status === AttendanceStatus.LATE) {
      return (
        <Badge variant="warning" size="sm" className="gap-1 shrink-0">
          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>Late (+{item.lateMinutes || 15}m)</span>
        </Badge>
      );
    }
    if (item.punchType === "CHECK_OUT") {
      return (
        <Badge variant="neutral" size="sm" className="gap-1 shrink-0">
          <ArrowUpRight className="w-3 h-3 text-slate-500" />
          <span>Check-Out</span>
        </Badge>
      );
    }
    if (item.status === AttendanceStatus.WFH_APPROVED) {
      return (
        <Badge variant="info" size="sm" className="shrink-0">
          Remote (WFH)
        </Badge>
      );
    }
    return (
      <Badge variant="success" size="sm" className="gap-1 shrink-0">
        <ArrowDownRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        <span>On-Time In</span>
      </Badge>
    );
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 10) return "Just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Recently";
    }
  };

  return (
    <Card className="p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Live Scan Stream
              </h3>
              {isLive && !isPaused ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  STREAMING
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  PAUSED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Instantaneous QR arrivals and departures
            </p>
          </div>
        </div>

        {/* Controls: Pause / Resume Stream */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 px-2.5 text-xs gap-1.5"
            title={isPaused ? "Resume live streaming" : "Pause live streaming"}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                <span className="hidden sm:inline">Pause</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 py-3 border-b border-slate-100 dark:border-slate-800 text-xs overflow-x-auto">
        <button
          onClick={() => setFilter("ALL")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            filter === "ALL"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Scans ({scans.length})
        </button>
        <button
          onClick={() => setFilter("CHECK_IN")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            filter === "CHECK_IN"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Check-Ins
        </button>
        <button
          onClick={() => setFilter("CHECK_OUT")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            filter === "CHECK_OUT"
              ? "bg-blue-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Check-Outs
        </button>
        <button
          onClick={() => setFilter("LATE")}
          className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
            filter === "LATE"
              ? "bg-amber-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Late Only
        </button>
      </div>

      {/* Feed List Container */}
      <div
        className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-slate-800/80 pr-1 mt-1"
        aria-live="polite"
        role="log"
        aria-label="Live stream of attendance scans"
      >
        {filteredScans.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No recent scans match the current filter.</p>
          </div>
        ) : (
          filteredScans.map((item, index) => {
            // First item gets slide-in animation if stream is live
            const isLatest = index === 0 && !isPaused;

            return (
              <article
                key={item.id || `${item.employeeId}_${item.scanTime}`}
                className={`py-3 px-2.5 rounded-xl transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between gap-3 ${
                  isLatest
                    ? "animate-in fade-in slide-in-from-top-3 duration-500 bg-gradient-to-r from-emerald-50/50 via-cyan-50/30 to-transparent dark:from-emerald-950/30 dark:via-cyan-950/20 dark:to-transparent ring-1 ring-emerald-400/40 dark:ring-emerald-500/30 shadow-sm"
                    : ""
                }`}
              >
                {/* Employee Info & Avatar */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {item.employeeName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    {isLatest && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-slate-900" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate">
                        {item.employeeName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {item.employeeId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      <span>{item.department}</span>
                      {item.terminalId && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px]">{item.terminalId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Status Badge & Time */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {getStatusBadge(item)}
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatRelativeTime(item.scanTime)}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </Card>
  );
};

