import React, { createContext, useContext, useEffect, useState } from "react";
import { io as ioClient, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { tokenStorage } from "../api/client";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/ui/Toast";
import { SocketEvent } from "@vorldx/shared";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isReconnecting: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = tokenStorage.getAccessToken();
    if (!token) return;

    // Connect to WebSocket server
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const wsUrl =
      import.meta.env.VITE_API_URL ||
      import.meta.env.NEXT_PUBLIC_API_URL ||
      (isLocalhost ? undefined : "https://attendance-tracker-56du.onrender.com");

    const client = ioClient(wsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    client.on("connect", () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // On reconnect, trigger state resync with backend
      client.emit(SocketEvent.RESYNC, {}, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    });

    client.on("reconnect_attempt", () => {
      setIsReconnecting(true);
    });

    client.on("disconnect", () => {
      setIsConnected(false);
    });

    // Real-Time Event Handlers
    client.on(
      SocketEvent.ATTENDANCE_UPDATED,
      (data: { employeeName?: string; punchType?: string; status?: string }) => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        const punchName = data.employeeName || "Employee";
        toast({
          type: "success",
          title: "Attendance Punch Recorded",
          description: `${punchName} clocked ${data.punchType || "punch"} (${data.status}).`,
        });
      }
    );

    client.on(SocketEvent.WFH_CREATED, (data: { employeeName?: string; dateKey?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({
        type: "info",
        title: "New WFH Request Submitted",
        description: `${data.employeeName || "An employee"} requested WFH for ${data.dateKey}.`,
      });
    });

    client.on(SocketEvent.WFH_DECIDED, (data: { employeeName?: string; status?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({
        type: "info",
        title: "WFH Request Decided",
        description: `Request for ${data.employeeName || "Employee"} was ${data.status}.`,
      });
    });

    client.on(SocketEvent.EMPLOYEE_REGISTERED, (data: { name?: string; employeeId?: string }) => {
      toast({
        type: "info",
        title: "New Employee Self-Registered",
        description: `${data.name || data.employeeId} has created their account.`,
      });
    });

    client.on(SocketEvent.POLICY_UPDATED, (data: { version?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({
        type: "info",
        title: "Attendance Policy Updated",
        description: `Active policy updated to version ${data.version}.`,
      });
    });

    client.on(SocketEvent.DISPLAY_STATUS, (data: { terminalId?: string; status?: string }) => {
      toast({
        type: "info",
        title: "Display Terminal Status Changed",
        description: `Terminal ${data.terminalId} is now ${data.status}.`,
      });
    });

    // Real-Time Leave Module Handlers
    client.on(
      SocketEvent.LEAVE_REQUESTED,
      (data: {
        employeeName?: string;
        employeeId?: string;
        typeName?: string;
        workingDays?: number;
      }) => {
        queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
        queryClient.invalidateQueries({ queryKey: ["all-leave-balances"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        toast({
          type: "info",
          title: "New Leave Application",
          description: `${data.employeeName || data.employeeId || "An employee"} applied for ${
            data.typeName || "leave"
          } (${data.workingDays || 1} day${(data.workingDays || 1) > 1 ? "s" : ""}).`,
        });
      }
    );

    client.on(
      SocketEvent.LEAVE_DECIDED,
      (data: {
        employeeName?: string;
        employeeId?: string;
        status?: string;
      }) => {
        queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
        queryClient.invalidateQueries({ queryKey: ["all-leave-balances"] });
        queryClient.invalidateQueries({ queryKey: ["employee-leave-balances"] });
        queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        queryClient.invalidateQueries({ queryKey: ["attendance"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });

        toast({
          type: data.status === "APPROVED" ? "success" : "info",
          title: `Leave ${data.status === "APPROVED" ? "Approved" : data.status === "CANCELLED" ? "Cancelled" : "Rejected"}`,
          description: `Leave for ${data.employeeName || data.employeeId || "Employee"} was marked ${data.status?.toLowerCase()}.`,
        });
      }
    );

    client.on(
      SocketEvent.LEAVE_BALANCE_UPDATED,
      () => {
        queryClient.invalidateQueries({ queryKey: ["all-leave-balances"] });
        queryClient.invalidateQueries({ queryKey: ["employee-leave-balances"] });
        queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      }
    );

    // Real-Time Enquiry & Helpdesk Event Handlers
    client.on(
      "enquiry.created",
      (data: { ticketNumber?: string; subject?: string; category?: string }) => {
        queryClient.invalidateQueries({ queryKey: ["enquiries"] });
        toast({
          type: "info",
          title: `New Enquiry ${data.ticketNumber || ""}`,
          description: `[${data.category || "General"}] ${data.subject || "New enquiry received"}`,
        });
      }
    );

    client.on(
      "enquiry.message_received",
      (data: { enquiryId?: string; ticketNumber?: string; senderRole?: string; message?: string }) => {
        queryClient.invalidateQueries({ queryKey: ["enquiries"] });
        if (data.enquiryId) {
          queryClient.invalidateQueries({ queryKey: ["enquiry-details", data.enquiryId] });
        }
        if (data.senderRole === "EMPLOYEE") {
          toast({
            type: "info",
            title: `Reply on ${data.ticketNumber || "Enquiry"}`,
            description: `${data.message ? (data.message.length > 60 ? data.message.slice(0, 57) + "..." : data.message) : "New message in thread"}`,
          });
        }
      }
    );

    client.on(
      "enquiry.status_updated",
      (data: { enquiryId?: string; ticketNumber?: string; status?: string }) => {
        queryClient.invalidateQueries({ queryKey: ["enquiries"] });
        if (data.enquiryId) {
          queryClient.invalidateQueries({ queryKey: ["enquiry-details", data.enquiryId] });
        }
      }
    );

    client.on(
      "enquiry.assigned",
      (data: { enquiryId?: string; ticketNumber?: string; assigneeName?: string }) => {
        queryClient.invalidateQueries({ queryKey: ["enquiries"] });
        if (data.enquiryId) {
          queryClient.invalidateQueries({ queryKey: ["enquiry-details", data.enquiryId] });
        }
      }
    );

    // Real-Time Staff Security & Session Eviction Handlers
    const handleSessionRevocation = (data: {
      userId?: string;
      sessionId?: string;
      reason?: string;
    }) => {
      const currentSessionId = tokenStorage.getSessionId();
      const isCurrentSession = data.sessionId && currentSessionId && data.sessionId === currentSessionId;
      const isTargetUser = !data.sessionId && data.userId && user && (data.userId === user.id || data.userId === (user as any)._id);

      if (isCurrentSession || isTargetUser) {
        toast({
          type: "error",
          title: "Session Terminated",
          description: data.reason || "Your staff session has been revoked. Redirecting...",
        });
        tokenStorage.clearTokens();
        setTimeout(() => {
          window.location.href = "/login?reason=session_revoked";
        }, 800);
      }
    };

    client.on("staff.session_revoked", handleSessionRevocation);
    client.on(SocketEvent.STAFF_SESSION_REVOKED, handleSessionRevocation);

    client.on(
      "staff:force_logout",
      (data: { userId?: string; targetUserId?: string; reason?: string }) => {
        const targetId = data.targetUserId || data.userId;
        const matchesUser = targetId && user && (targetId === user.id || targetId === (user as any)._id);
        if (matchesUser) {
          toast({
            type: "error",
            title: "Administrative Forced Logout",
            description: data.reason || "An administrator has terminated your access.",
          });
          tokenStorage.clearTokens();
          setTimeout(() => {
            window.location.href = "/login?reason=forced_logout";
          }, 800);
        }
      }
    );

    client.on(
      SocketEvent.STAFF_SECURITY_ALERT,
      (data: { action?: string; reason?: string; targetMobile?: string }) => {
        toast({
          type: "info",
          title: "Staff Security Alert",
          description: `${data.reason || "Security violation detected"}${
            data.targetMobile ? ` (${data.targetMobile})` : ""
          }`,
        });
      }
    );

    setSocket(client);

    return () => {
      client.disconnect();
    };
  }, [isAuthenticated, queryClient]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
