import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "./api";
import { tokenStorage } from "./storage";

let socketInstance: Socket | null = null;
type SocketEventCallback = (payload: unknown) => void;
const eventSubscribers = new Map<string, Set<SocketEventCallback>>();
const resyncSubscribers = new Set<() => void>();

/**
 * Connects or returns existing Socket.io client instance authenticated with the user's JWT.
 */
export async function getMobileSocket(): Promise<Socket | null> {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  const token = await tokenStorage.getAccessToken();
  if (!token) {
    disconnectMobileSocket();
    return null;
  }

  const baseUrl = getApiBaseUrl();

  if (!socketInstance) {
    socketInstance = io(baseUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      // Reconnected: trigger authoritative data resync across all active listeners
      resyncSubscribers.forEach((cb) => {
        try {
          cb();
        } catch {
          // Ignore subscriber errors
        }
      });
    });

    // Central listener dispatch
    const handledEvents = [
      "attendance.updated",
      "wfh.decided",
      "wfh.created",
      "policy.updated",
      "announcement.published",
      "enquiry.created",
      "enquiry.message_received",
      "enquiry.status_updated",
      "enquiry.assigned",
      "enquiry.typing",
      "app_release.published",
      "leave.requested",
      "leave.decided",
      "leave.balance_updated",
    ];

    handledEvents.forEach((eventName) => {
      socketInstance?.on(eventName, (data) => {
        const subs = eventSubscribers.get(eventName);
        if (subs) {
          subs.forEach((cb) => {
            try {
              cb(data);
            } catch {
              // Ignore subscriber errors
            }
          });
        }
      });
    });
  } else {
    // Update auth token if socket was already created
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }

  return socketInstance;
}

/**
 * Disconnects the socket when the user signs out
 */
export function disconnectMobileSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Subscribes to a real-time event from the backend (e.g. attendance.updated, wfh.decided)
 */
export function subscribeToSocketEvent(
  eventName: string,
  callback: SocketEventCallback
): () => void {
  if (!eventSubscribers.has(eventName)) {
    eventSubscribers.set(eventName, new Set());
  }
  eventSubscribers.get(eventName)!.add(callback);

  // Ensure socket is initialized
  getMobileSocket().catch(() => {});

  return () => {
    eventSubscribers.get(eventName)?.delete(callback);
  };
}

/**
 * Emits an event through the mobile socket
 */
export async function emitMobileSocketEvent(eventName: string, payload: unknown): Promise<void> {
  const socket = await getMobileSocket();
  if (socket && socket.connected) {
    socket.emit(eventName, payload);
  }
}

/**
 * Subscribes to the reconnect/resync trigger to refresh authoritative state
 */
export function subscribeToResync(callback: () => void): () => void {
  resyncSubscribers.add(callback);
  return () => {
    resyncSubscribers.delete(callback);
  };
}

