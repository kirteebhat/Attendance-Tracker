import React, { useState, useEffect } from "react";
import {
  useDisplays,
  useRegisterDisplay,
  useUpdateDisplayStatus,
  useAuthorizeDisplay,
  useRevokeDisplay,
  DisplayTerminalItem,
} from "../api/queries";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useSocket } from "../context/SocketContext";
import {
  Tv,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Power,
  ShieldAlert,
  Key,
  Wifi,
  WifiOff,
  Clock,
  MapPin,
  CheckCircle2,
} from "lucide-react";

export const DisplaysPage: React.FC = () => {
  const { toast } = useToast();
  const { socket } = useSocket();

  const { data: response, isLoading, refetch } = useDisplays();
  const displays = response?.data || [];

  const registerMutation = useRegisterDisplay();
  const updateStatusMutation = useUpdateDisplayStatus();
  const authorizeMutation = useAuthorizeDisplay();
  const revokeMutation = useRevokeDisplay();

  // Register Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({ name: "", location: "" });
  const [createdDisplay, setCreatedDisplay] = useState<DisplayTerminalItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Status/Revocation Confirmation Modals
  const [selectedDisplay, setSelectedDisplay] = useState<DisplayTerminalItem | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusReason, setStatusReason] = useState("");

  // Live Socket.IO Updates
  useEffect(() => {
    if (!socket) return;
    const handleDisplayStatus = (payload: { terminalId: string; status: string }) => {
      refetch();
      toast({
        title: "Display Status Changed",
        description: `Terminal ${payload.terminalId} is now ${payload.status}.`,
        type: "info",
      });
    };

    socket.on("display.status", handleDisplayStatus);
    return () => {
      socket.off("display.status", handleDisplayStatus);
    };
  }, [socket, refetch, toast]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name.trim() || !registerForm.location.trim()) {
      toast({
        title: "Validation Error",
        description: "Display name and location are required.",
        type: "error",
      });
      return;
    }

    try {
      const res = await registerMutation.mutateAsync(registerForm);
      setCreatedDisplay(res.data);
      setRegisterForm({ name: "", location: "" });
      toast({
        title: "Display Terminal Registered",
        description: "One-time pairing code generated. Connect the office screen now.",
        type: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to register display";
      toast({
        title: "Registration Failed",
        description: message,
        type: "error",
      });
    }
  };

  const handleCopyPairingCode = () => {
    if (!createdDisplay?.pairingCode) return;
    navigator.clipboard.writeText(createdDisplay.pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ title: "Copied to Clipboard", description: "Pairing code copied.", type: "info" });
  };

  const handleConfirmRevoke = async () => {
    if (!selectedDisplay) return;
    try {
      await revokeMutation.mutateAsync({
        id: selectedDisplay.terminalId || selectedDisplay.id,
        reason: revokeReason.trim() || "Administrative security revocation",
      });
      toast({
        title: "Display Terminal Revoked",
        description: `Credentials for ${selectedDisplay.name} wiped; active tokens invalidated.`,
        type: "info",
      });
      setShowRevokeModal(false);
      setSelectedDisplay(null);
      setRevokeReason("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to revoke display";
      toast({ title: "Revocation Failed", description: message, type: "error" });
    }
  };

  const handleConfirmStatusToggle = async () => {
    if (!selectedDisplay) return;
    const nextActive = !selectedDisplay.isActive;
    try {
      await updateStatusMutation.mutateAsync({
        id: selectedDisplay.terminalId || selectedDisplay.id,
        isActive: nextActive,
        reason: statusReason.trim() || undefined,
      });
      toast({
        title: nextActive ? "Display Enabled" : "Display Disabled",
        description: `Terminal ${selectedDisplay.name} is now ${nextActive ? "active" : "disabled"}.`,
        type: "info",
      });
      setShowStatusModal(false);
      setSelectedDisplay(null);
      setStatusReason("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to toggle status";
      toast({ title: "Status Update Failed", description: message, type: "error" });
    }
  };

  const handleAuthorizeNewCode = async (display: DisplayTerminalItem) => {
    try {
      const res = await authorizeMutation.mutateAsync(display.terminalId || display.id);
      setCreatedDisplay(res.data);
      setShowRegisterModal(true);
      toast({
        title: "New Pairing Code Generated",
        description: `Generated fresh 15-minute pairing code for ${display.name}.`,
        type: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reauthorize display";
      toast({ title: "Reauthorization Failed", description: message, type: "error" });
    }
  };

  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const diffMs = Date.now() - new Date(lastSeen).getTime();
    return diffMs < 90 * 1000; // 90 seconds threshold
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return "Never connected";
    const diffSec = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(lastSeen).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Office QR Display Terminals
            </h1>
            <Badge variant="primary" className="text-xs font-semibold px-2.5 py-0.5">
              Live Monitor
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage physical office kiosk pairing, dynamic rotating QR challenge generation, and remote deactivation
          </p>
        </div>

        <Button
          type="button"
          id="register-display-btn"
          variant="primary"
          onClick={() => {
            setCreatedDisplay(null);
            setShowRegisterModal(true);
          }}
          className="gap-2 shadow-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          Register Display Terminal
        </Button>
      </div>

      {/* Displays Grid / Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : displays.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Tv className="w-6 h-6 text-slate-400" />}
            title="No Display Terminals Configured"
            description="Register a physical office screen or kiosk to generate rotating QR codes for employee punches."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCreatedDisplay(null);
                  setShowRegisterModal(true);
                }}
              >
                Register First Display
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displays.map((display) => {
            const online = isOnline(display.lastSeen);
            const isRevoked = display.status === "REVOKED";
            const isDisabled = !display.isActive || display.status === "DISABLED";

            return (
              <Card
                key={display.terminalId || display.id}
                className={`p-5 flex flex-col justify-between border-slate-200 shadow-sm transition-all hover:border-slate-300 ${
                  isRevoked
                    ? "bg-red-50/20 border-red-200"
                    : isDisabled
                    ? "bg-slate-50/60 opacity-80"
                    : "bg-white"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-lg ${
                          isRevoked
                            ? "bg-red-100 text-red-700"
                            : online
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Tv className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{display.name}</h3>
                        <p className="text-[11px] font-mono text-slate-500">
                          {display.terminalId}
                        </p>
                      </div>
                    </div>

                    {isRevoked ? (
                      <Badge variant="danger">REVOKED</Badge>
                    ) : isDisabled ? (
                      <Badge variant="warning">DISABLED</Badge>
                    ) : (
                      <Badge variant="success">ACTIVE</Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{display.location}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {online ? (
                          <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>Online</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>Offline</span>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Last seen: {formatLastSeen(display.lastSeen)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Token Epoch: {display.tokenEpoch}</span>
                      <span>
                        Pairing:{" "}
                        <strong className={display.isPaired ? "text-emerald-600" : "text-amber-600"}>
                          {display.isPaired ? "Paired" : "Unpaired"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {!isRevoked && (
                      <Button
                        type="button"
                        id={`toggle-display-btn-${display.terminalId}`}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDisplay(display);
                          setStatusReason("");
                          setShowStatusModal(true);
                        }}
                        className="text-xs h-7 px-2 gap-1"
                        title={display.isActive ? "Disable Screen" : "Enable Screen"}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {display.isActive ? "Disable" : "Enable"}
                      </Button>
                    )}

                    <Button
                      type="button"
                      id={`authorize-display-btn-${display.terminalId}`}
                      size="sm"
                      variant="outline"
                      onClick={() => handleAuthorizeNewCode(display)}
                      className="text-xs h-7 px-2 gap-1 text-blue-600 hover:text-blue-700"
                      title="Generate new pairing code"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Pair Code
                    </Button>
                  </div>

                  {!isRevoked && (
                    <Button
                      type="button"
                      id={`revoke-display-btn-${display.terminalId}`}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDisplay(display);
                        setRevokeReason("");
                        setShowRevokeModal(true);
                      }}
                      className="text-xs h-7 px-2 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      title="Permanently revoke terminal credential"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Revoke
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* REGISTER DISPLAY / ONE-TIME PAIRING CODE MODAL */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => {
          setShowRegisterModal(false);
          setCreatedDisplay(null);
        }}
        title={
          createdDisplay ? "Display Terminal Pairing Code" : "Register Office QR Display Terminal"
        }
        maxWidth="md"
      >
        {createdDisplay ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">{createdDisplay.name}</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{createdDisplay.terminalId}</p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl shadow-inner max-w-xs mx-auto space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                One-Time Pairing Code
              </div>
              <div
                id="display-pairing-code-value"
                className="text-3xl font-extrabold tracking-widest text-emerald-400 font-mono"
              >
                {createdDisplay.pairingCode || "VX-READY"}
              </div>
              <button
                type="button"
                id="copy-pairing-code-btn"
                onClick={handleCopyPairingCode}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors bg-slate-800 px-3 py-1 rounded-md"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? "Copied Code" : "Copy Code"}</span>
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 text-left flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Important: </span>
                This pairing code is displayed only once and expires in 15 minutes. Enter this code on
                the physical kiosk screen at <span className="font-mono font-semibold">/terminal/display</span> to authorize the screen.
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                id="close-pairing-modal-btn"
                variant="primary"
                onClick={() => {
                  setShowRegisterModal(false);
                  setCreatedDisplay(null);
                }}
                className="w-full font-semibold"
              >
                Done / Return to Displays
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Terminal Name *
              </label>
              <Input
                id="display-name-input"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                placeholder="e.g. Ground Floor Main Entrance Kiosk"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location Description *
              </label>
              <Input
                id="display-location-input"
                value={registerForm.location}
                onChange={(e) => setRegisterForm({ ...registerForm, location: e.target.value })}
                placeholder="e.g. Tower A Lobby, Security Turnstiles"
                required
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              Registration generates a secure terminal ID and a one-time 15-minute pairing code for the kiosk.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRegisterModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                id="submit-register-display-btn"
                variant="primary"
                size="sm"
                isLoading={registerMutation.isPending}
                className="font-semibold"
              >
                Register & Generate Code
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* REVOKE CONFIRMATION MODAL */}
      <Modal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        title="Revoke Display Terminal"
        maxWidth="md"
      >
        {selectedDisplay && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Permanent Security Revocation</p>
                <p className="mt-1">
                  Revoking will permanently wipe stored credentials, advance the token epoch, and
                  instantly invalidate all active QR tokens issued by this display screen.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Revocation Reason (Recorded in Audit Trail)
              </label>
              <Input
                id="revoke-reason-input"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Decommissioned physical kiosk or security audit"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRevokeModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                id="confirm-revoke-btn"
                variant="outline"
                size="sm"
                onClick={handleConfirmRevoke}
                isLoading={revokeMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold border-transparent"
              >
                Confirm Revocation
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ENABLE / DISABLE STATUS MODAL */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={selectedDisplay?.isActive ? "Disable Display Terminal" : "Enable Display Terminal"}
        maxWidth="sm"
      >
        {selectedDisplay && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              {selectedDisplay.isActive
                ? `Disabling ${selectedDisplay.name} will temporarily prevent it from requesting new rotating QR codes.`
                : `Enabling ${selectedDisplay.name} will restore its rotating QR code generation.`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason (Optional)
              </label>
              <Input
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Temporary lobby maintenance"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                id="confirm-status-toggle-btn"
                variant="primary"
                size="sm"
                onClick={handleConfirmStatusToggle}
                isLoading={updateStatusMutation.isPending}
              >
                {selectedDisplay.isActive ? "Disable Display" : "Enable Display"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
