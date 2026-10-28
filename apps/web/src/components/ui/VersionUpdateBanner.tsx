import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, X, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { useCheckAppUpdate } from "../../api/queries";
import { useSocket } from "../../context/SocketContext";
import { Button } from "./Button";
import { Badge } from "./Badge";

export const CURRENT_WEB_VERSION = "1.2.0";

export const VersionUpdateBanner: React.FC = () => {
  const { data: updateData, refetch } = useCheckAppUpdate("WEB", CURRENT_WEB_VERSION);
  const { socket } = useSocket();
  const [dismissed, setDismissed] = useState(false);
  const [liveRelease, setLiveRelease] = useState<{
    version: string;
    notes?: string;
    forceUpdate?: boolean;
  } | null>(null);

  // Listen to realtime socket release announcements
  useEffect(() => {
    if (!socket) return;

    const handleReleasePublished = (data: {
      platform: string;
      version: string;
      forceUpdate: boolean;
      notes: string;
    }) => {
      if (data.platform === "WEB" || data.platform === "ALL") {
        setLiveRelease({
          version: data.version,
          notes: data.notes,
          forceUpdate: data.forceUpdate,
        });
        setDismissed(false);
        refetch();
      }
    };

    socket.on("app_release.published", handleReleasePublished);
    return () => {
      socket.off("app_release.published", handleReleasePublished);
    };
  }, [socket, refetch]);

  const hasUpdate = liveRelease ? true : !!updateData?.updateAvailable;
  const isForced = liveRelease?.forceUpdate ?? !!updateData?.forceUpdate;
  const targetVersion = liveRelease?.version || updateData?.latestVersion || "1.3.0";
  const notes = liveRelease?.notes || updateData?.notes;

  if (!hasUpdate) return null;

  // Blocking overlay if update is mandatory
  if (isForced) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-rose-500/30 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Mandatory Update Required
              </h2>
              <Badge variant="danger" size="sm">
                v{targetVersion}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your active session is running on an outdated version (v{CURRENT_WEB_VERSION}). A required
              update has been deployed to guarantee security, protocol alignment, and data consistency.
            </p>
          </div>

          {notes && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold block mb-1">Release Highlights:</span>
              <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{notes}</p>
            </div>
          )}

          <Button
            variant="primary"
            className="w-full justify-center bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/30"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Application to v{targetVersion}
          </Button>
        </div>
      </div>
    );
  }

  // Non-blocking banner
  if (dismissed) return null;

  return (
    <aside aria-label="Update notification" className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs md:text-sm animate-in slide-in-from-top">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="p-1 rounded-md bg-white/20 text-white shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="truncate">
          <span className="font-bold">New Version Available (v{targetVersion}):</span>{" "}
          <span className="opacity-90">{notes || "Enhancements and feature upgrades are ready."}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1 bg-white text-blue-700 font-semibold rounded-md shadow-xs hover:bg-blue-50 transition-colors text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          title="Dismiss for now"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

