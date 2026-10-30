import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Laptop,
  Smartphone,
  Clock,
  MapPin,
  Trash2,
  RotateCcw,
  UserX,
  History,
} from "lucide-react";
import {
  useStaffSessions,
  useRevokeSession,
  useRevokeAllSessions,
  useTrustedDevices,
  useRevokeTrustedDevice,
  useForceLogoutStaff,
  useAuditLogs,
  StaffSessionItem,
  TrustedDeviceItem,
} from "../api/queries";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { LivePulseIndicator } from "../components/ui/LivePulseIndicator";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

interface LiveSecurityEvent {
  id: string;
  type: "LOCKOUT" | "ALERT" | "FAILED" | "DISPATCH" | "FORCE_LOGOUT";
  title: string;
  description: string;
  timestamp: string;
  target?: string;
}

export const SecurityPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  const isAdmin = user?.role === "ADMIN" || user?.role === "HR_ADMIN";

  // Data Queries
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useStaffSessions();

  const {
    data: devicesData,
    isLoading: devicesLoading,
    refetch: refetchDevices,
  } = useTrustedDevices();

  const { data: auditData } = useAuditLogs({
    entityType: "AUTH",
    limit: 8,
  });

  // Mutations
  const revokeSessionMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllSessions();
  const revokeDeviceMutation = useRevokeTrustedDevice();
  const forceLogoutMutation = useForceLogoutStaff();

  // Dialog & Modal States
  const [sessionToRevoke, setSessionToRevoke] = useState<StaffSessionItem | null>(null);
  const [isRevokeAllOpen, setIsRevokeAllOpen] = useState(false);
  const [deviceToRevoke, setDeviceToRevoke] = useState<TrustedDeviceItem | null>(null);

  // Admin Force Logout Modal State
  const [isForceLogoutModalOpen, setIsForceLogoutModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [forceLogoutReason, setForceLogoutReason] = useState("");

  // Admin Live Security Events Stream
  const [liveEvents, setLiveEvents] = useState<LiveSecurityEvent[]>([]);

  // Listen to Live Security Events via Socket
  useEffect(() => {
    if (!socket || !isAdmin) return;

    const addEvent = (event: Omit<LiveSecurityEvent, "id">) => {
      setLiveEvents((prev) => [
        {
          ...event,
          id: `sec_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        },
        ...prev.slice(0, 19), // keep last 20 events
      ]);
    };

    socket.on("staff:otp_locked", (data: { mobileNumber?: string; reason?: string }) => {
      addEvent({
        type: "LOCKOUT",
        title: "Account Lockout Triggered",
        description: data.reason || "Staff account locked after consecutive failed OTP attempts.",
        timestamp: new Date().toISOString(),
        target: data.mobileNumber,
      });
    });

    socket.on("staff:otp_failed", (data: { mobileNumber?: string; remainingAttempts?: number }) => {
      addEvent({
        type: "FAILED",
        title: "Failed OTP Attempt",
        description: `Incorrect verification code. ${data.remainingAttempts ?? 0} attempt(s) remaining.`,
        timestamp: new Date().toISOString(),
        target: data.mobileNumber,
      });
    });

    socket.on("staff:security_alert", (data: { reason?: string; action?: string; targetMobile?: string }) => {
      addEvent({
        type: "ALERT",
        title: data.action || "Security Alert",
        description: data.reason || "Suspicious authentication activity detected.",
        timestamp: new Date().toISOString(),
        target: data.targetMobile,
      });
    });

    socket.on("staff:force_logout", (data: { targetUserId?: string; reason?: string }) => {
      addEvent({
        type: "FORCE_LOGOUT",
        title: "Staff Account Forced Logout",
        description: data.reason || "All sessions terminated by administrator.",
        timestamp: new Date().toISOString(),
        target: data.targetUserId,
      });
    });

    return () => {
      socket.off("staff:otp_locked");
      socket.off("staff:otp_failed");
      socket.off("staff:security_alert");
      socket.off("staff:force_logout");
    };
  }, [socket, isAdmin]);

  const sessions = sessionsData?.data || [];
  const devices = devicesData?.data || [];
  const auditLogs = auditData?.data || [];

  // Handlers
  const handleConfirmRevokeSession = async () => {
    if (!sessionToRevoke) return;
    try {
      await revokeSessionMutation.mutateAsync(sessionToRevoke.id);
      toast({
        type: "success",
        title: "Session Terminated",
        description: "The selected session was successfully revoked.",
      });
    } catch {
      toast({
        type: "error",
        title: "Revoke Failed",
        description: "Unable to revoke session. Please try again.",
      });
    } finally {
      setSessionToRevoke(null);
    }
  };

  const handleConfirmRevokeAll = async () => {
    try {
      await revokeAllMutation.mutateAsync();
      toast({
        type: "success",
        title: "All Other Sessions Revoked",
        description: "All other active sessions have been securely terminated.",
      });
    } catch {
      toast({
        type: "error",
        title: "Action Failed",
        description: "Unable to revoke sessions. Please try again.",
      });
    } finally {
      setIsRevokeAllOpen(false);
    }
  };

  const handleConfirmRevokeDevice = async () => {
    if (!deviceToRevoke) return;
    try {
      await revokeDeviceMutation.mutateAsync(deviceToRevoke._id);
      toast({
        type: "success",
        title: "Device Trust Revoked",
        description: `${deviceToRevoke.deviceName} will require full OTP verification on next login.`,
      });
    } catch {
      toast({
        type: "error",
        title: "Revoke Failed",
        description: "Unable to revoke trusted status for this device.",
      });
    } finally {
      setDeviceToRevoke(null);
    }
  };

  const handleExecuteForceLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId.trim()) {
      toast({
        type: "error",
        title: "User ID Required",
        description: "Please specify the staff user ID or employee ID to terminate.",
      });
      return;
    }

    try {
      await forceLogoutMutation.mutateAsync({
        userId: targetUserId.trim(),
        reason: forceLogoutReason.trim() || "Security compliance credential rotation",
      });
      toast({
        type: "success",
        title: "Forced Logout Dispatched",
        description: `All active sessions for user ${targetUserId} have been evicted immediately.`,
      });
      setIsForceLogoutModalOpen(false);
      setTargetUserId("");
      setForceLogoutReason("");
      refetchSessions();
    } catch {
      toast({
        type: "error",
        title: "Force Logout Failed",
        description: "Failed to terminate staff sessions. Check target user identifier.",
      });
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const getPlatformIcon = (platform?: string, ua?: string) => {
    const text = `${platform || ""} ${ua || ""}`.toLowerCase();
    if (text.includes("mobile") || text.includes("android") || text.includes("iphone")) {
      return Smartphone;
    }
    return Laptop;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Security & Sessions
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsForceLogoutModalOpen(true)}
              className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <UserX className="w-4 h-4 mr-1.5" />
              <span>Admin Force Logout</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchSessions();
              refetchDevices();
            }}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADMIN-ONLY LIVE SECURITY EVENTS PANEL                                    */}
      {/* ========================================================================= */}
      {isAdmin && (
        <Card className="p-5 border-blue-500/30 bg-blue-50/20 dark:bg-slate-900/60 dark:border-blue-500/20">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <LivePulseIndicator variant="live" size="sm" label="Real-Time Admin Channel" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Live Staff Security Stream
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Listening to socket events
            </span>
          </div>

          {liveEvents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              No security anomalies detected in this session. Real-time OTP requests, brute-force lockouts, and forced logouts will appear here instantly.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {liveEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex items-start justify-between gap-3 text-xs shadow-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        evt.type === "LOCKOUT"
                          ? "bg-rose-500"
                          : evt.type === "ALERT"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {evt.title}
                        </span>
                        {evt.target && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {evt.target}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5">{evt.description}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {formatRelativeTime(evt.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ACTIVE SESSIONS SECTION                                                  */}
      {/* ========================================================================= */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Active Sessions</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Devices and browsers currently logged into this staff account.
            </p>
          </div>

          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeAllOpen(true)}
              className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Revoke All Other Sessions</span>
            </Button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Active Sessions"
            description="No active sessions detected for your account."
          />
        ) : (
          <div className="space-y-3">
            {sessions.map((sess) => {
              const Icon = getPlatformIcon(sess.device?.platform, sess.userAgent);
              return (
                <div
                  key={sess.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    sess.isCurrent
                      ? "bg-blue-50/40 dark:bg-slate-800/80 border-blue-300 dark:border-blue-500/40 shadow-xs ring-1 ring-blue-500/20"
                      : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        sess.isCurrent
                          ? "bg-blue-600 text-white shadow-xs shadow-blue-500/30"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {sess.device?.deviceName || "Standard Web Browser"}
                        </span>
                        {sess.isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            This Device / Current
                          </span>
                        )}
                        {sess.device?.platform && (
                          <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                            {sess.device.platform}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{sess.ipAddress || "127.0.0.1"}</span>
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Active {formatRelativeTime(sess.lastActivityAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSessionToRevoke(sess)}
                      className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 self-end sm:self-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      <span>Revoke</span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* TRUSTED HARDWARE DEVICES SECTION                                         */}
      {/* ========================================================================= */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Trusted Hardware Devices</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Devices registered with extended 30-day trust for passwordless OTP elevation.
          </p>
        </div>

        {devicesLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : devices.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No Trusted Devices"
            description="When signing in, check 'Remember this device for 30 days' to whitelist your hardware."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {devices.map((dev) => (
              <div
                key={dev._id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-start justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                      {dev.deviceName}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {dev.platform}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    FP: {dev.deviceFingerprint}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Trusted until:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(dev.trustedUntil).toLocaleDateString()}
                    </span>
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeviceToRevoke(dev)}
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-2"
                  title="Remove Device Trust"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* LOGIN HISTORY & AUDIT TRAIL                                              */}
      {/* ========================================================================= */}
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Recent Staff Authentication History</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable log of login attempts, session establishments, and security verifications.
          </p>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No recent authentication logs.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {auditLogs.map((log) => (
              <div key={log._id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      log.action.includes("FAILED") || log.action.includes("LOCKED")
                        ? "bg-rose-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <div className="truncate">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.action}
                    </span>
                    <span className="text-slate-400 ml-2">
                      {log.reason || "Staff Authentication"}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-mono shrink-0">
                  {formatRelativeTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* MODALS & CONFIRMATION DIALOGS                                             */}
      {/* ========================================================================= */}

      {/* Revoke Single Session Dialog */}
      <ConfirmDialog
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={handleConfirmRevokeSession}
        title="Revoke Staff Session"
        message={`Are you sure you want to terminate the active session on ${
          sessionToRevoke?.device?.deviceName || "this device"
        }? This client will be immediately signed out.`}
        confirmText="Revoke Session"
        variant="danger"
        isLoading={revokeSessionMutation.isPending}
      />

      {/* Revoke All Sessions Dialog */}
      <ConfirmDialog
        isOpen={isRevokeAllOpen}
        onClose={() => setIsRevokeAllOpen(false)}
        onConfirm={handleConfirmRevokeAll}
        title="Revoke All Other Sessions"
        message="This will immediately terminate all active sessions across all devices except this one. Continue?"
        confirmText="Revoke All Others"
        variant="danger"
        isLoading={revokeAllMutation.isPending}
      />

      {/* Revoke Trusted Device Dialog */}
      <ConfirmDialog
        isOpen={!!deviceToRevoke}
        onClose={() => setDeviceToRevoke(null)}
        onConfirm={handleConfirmRevokeDevice}
        title="Remove Trusted Hardware"
        message={`Revoke hardware trust for "${deviceToRevoke?.deviceName}"? The device will require multi-factor OTP verification on subsequent logins.`}
        confirmText="Remove Trust"
        variant="danger"
        isLoading={revokeDeviceMutation.isPending}
      />

      {/* Admin Force Logout Modal */}
      <Modal
        isOpen={isForceLogoutModalOpen}
        onClose={() => setIsForceLogoutModalOpen(false)}
        title="Administrative Force Logout"
      >
        <form onSubmit={handleExecuteForceLogout} className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Terminate all active sessions for a target staff account instantly. The user will be evicted in real time via WebSockets.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Staff User ID or Employee ID *
            </label>
            <input
              type="text"
              required
              placeholder="HR-001 or MongoDB ObjectId"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Termination Reason / Security Audit Note
            </label>
            <textarea
              rows={2}
              placeholder="Reason for termination..."
              value={forceLogoutReason}
              onChange={(e) => setForceLogoutReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsForceLogoutModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={forceLogoutMutation.isPending}
            >
              <UserX className="w-4 h-4 mr-1.5" />
              <span>Evict & Force Logout</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
