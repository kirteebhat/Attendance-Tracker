import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { TokenPayload } from "../services/auth.service";
import * as qrService from "../services/qr.service";
import { UserRole, SocketEvent, SocketRoom, AttendanceStatus } from "@vorldx/shared";
import { AttendanceRecord, Employee, QrDisplay } from "../models";
import * as dashboardService from "../services/dashboard.service";

let ioInstance: SocketIOServer | null = null;

export interface AuthenticatedSocketData {
  type: "user" | "display" | "guest";
  user?: TokenPayload;
  display?: {
    terminalId: string;
    displayId: string;
    _id: string;
    name: string;
  };
}

/**
 * Initializes and configures the Socket.IO server with JWT & display authentication,
 * scoped room partitions, and resync handlers.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());

  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // 1. Connection Authentication Middleware
  ioInstance.use(async (socket: Socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const headers = socket.handshake.headers || {};

      // Option A: JWT Token (Employee or HR/Admin user)
      const rawToken =
        auth.token ||
        (headers.authorization ? headers.authorization.replace(/^Bearer\s+/i, "") : null);

      if (rawToken && typeof rawToken === "string" && rawToken.trim().length > 0) {
        try {
          const decoded = jwt.verify(rawToken.trim(), env.JWT_SECRET) as TokenPayload;
          socket.data = {
            type: "user",
            user: decoded,
          } as AuthenticatedSocketData;
          return next();
        } catch {
          return next(new Error("ERR_UNAUTHORIZED: Invalid or expired JWT token"));
        }
      }

      // Option B: Display Terminal Credentials
      const displayId =
        auth.terminalId || auth.displayId || headers["x-terminal-id"] || headers["x-display-id"];
      const credential =
        auth.terminalSecret ||
        auth.credential ||
        headers["x-terminal-secret"] ||
        headers["x-display-credential"];

      if (displayId && credential) {
        try {
          const displayDoc = await qrService.authenticateDisplay(
            String(displayId).trim(),
            String(credential).trim()
          );

          socket.data = {
            type: "display",
            display: {
              terminalId: displayDoc.terminalId,
              displayId: displayDoc.terminalId,
              _id: displayDoc._id.toString(),
              name: displayDoc.name,
            },
          } as AuthenticatedSocketData;
          return next();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "ERR_TERMINAL_UNAUTHORIZED";
          return next(new Error(`ERR_TERMINAL_UNAUTHORIZED: ${message}`));
        }
      }

      // Option C: Staff Login Public Channel (for real-time OTP status line on login page)
      if (auth.type === "staff_login" || auth.channel === "staff_login" || auth.guest === true) {
        socket.data = {
          type: "guest",
        } as AuthenticatedSocketData;
        return next();
      }

      // No valid credentials provided
      return next(new Error("ERR_UNAUTHORIZED: Authentication credentials required"));
    } catch (err) {
      logger.error("Socket authentication error:", err);
      return next(new Error("ERR_UNAUTHORIZED: Authentication failed"));
    }
  });

  // 2. Connection Event Handler & Room Management
  ioInstance.on("connection", (socket: Socket) => {
    const data = socket.data as AuthenticatedSocketData;

    if (data.type === "user" && data.user) {
      const { user } = data;

      // Scoped Room: employee:{employeeId}
      socket.join(SocketRoom.employee(user.employeeId));
      if (user.userId && user.userId !== user.employeeId) {
        socket.join(SocketRoom.employee(user.userId));
      }

      // Scoped Room: hr and hr:dashboard for HR and ADMIN users
      if (
        user.role === UserRole.HR ||
        user.role === UserRole.ADMIN ||
        user.role === ("HR_ADMIN" as unknown)
      ) {
        socket.join(SocketRoom.hr());
        socket.join(SocketRoom.hrDashboard());
        logger.info(
          `[Socket] User ${user.email} (${user.role}) connected -> joined rooms: employee:${user.employeeId}, hr, hr:dashboard`
        );
      } else {
        logger.info(
          `[Socket] Employee ${user.employeeId} connected -> joined room: employee:${user.employeeId}`
        );
      }

      // Enquiry thread room joining & typing indicators
      socket.on("enquiry.join", (enquiryId: string) => {
        if (enquiryId) {
          socket.join(`enquiry:${enquiryId}`);
        }
      });

      socket.on("enquiry.leave", (enquiryId: string) => {
        if (enquiryId) {
          socket.leave(`enquiry:${enquiryId}`);
        }
      });

      socket.on("enquiry.typing", (payload: { enquiryId: string; isTyping: boolean; userName?: string }) => {
        if (payload?.enquiryId) {
          socket.to(`enquiry:${payload.enquiryId}`).emit("enquiry.typing", {
            ...payload,
            userId: user.userId,
            employeeId: user.employeeId,
            role: user.role,
          });
          socket.broadcast.emit("enquiry.typing", {
            ...payload,
            userId: user.userId,
            employeeId: user.employeeId,
            role: user.role,
          });
        }
      });

      // Resync Handler: Allows clients to request authoritative data on reconnection
      socket.on(
        SocketEvent.RESYNC,
        async (
          _resyncReq: { type?: string } = {},
          callback?: (response: Record<string, unknown>) => void
        ) => {
          try {
            logger.debug(`[Socket] Received resync request from user ${user.employeeId}`);

            if (user.role === UserRole.HR || user.role === UserRole.ADMIN) {
              const summary = await dashboardService.getDashboardSummary();
              const responseData = {
                success: true,
                timestamp: new Date().toISOString(),
                type: "summary",
                data: summary,
              };
              socket.emit(SocketEvent.RESYNC_SUCCESS, responseData);
              if (typeof callback === "function") callback(responseData);
            } else {
              // Employee resync: fetch today's attendance
              const today = new Date().toISOString().slice(0, 10);
              const employeeDoc = await Employee.findOne({ employeeId: user.employeeId });
              const record = employeeDoc
                ? await AttendanceRecord.findOne({
                    employee: employeeDoc._id,
                    dateKey: today,
                  })
                : null;

              const responseData = {
                success: true,
                timestamp: new Date().toISOString(),
                type: "attendance",
                data: record
                  ? {
                      recordId: record._id.toString(),
                      employeeId: user.employeeId,
                      dateKey: record.dateKey,
                      status: record.status,
                      punchType: record.checkOutTime ? "CHECK_OUT" : "CHECK_IN",
                      checkInTime: record.checkInTime?.toISOString() || null,
                      checkOutTime: record.checkOutTime?.toISOString() || null,
                      durationMinutes: record.durationMinutes || 0,
                    }
                  : {
                      employeeId: user.employeeId,
                      status: AttendanceStatus.NOT_PUNCHED,
                      recordId: null,
                    },
              };

              socket.emit(SocketEvent.RESYNC_SUCCESS, responseData);
              if (typeof callback === "function") callback(responseData);
            }
          } catch (err) {
            logger.error(`[Socket] Resync error for ${user.employeeId}:`, err);
            const errResponse = { success: false, message: "Resync failed" };
            if (typeof callback === "function") callback(errResponse);
          }
        }
      );
    } else if (data.type === "display" && data.display) {
      const { display } = data;

      // Scoped Room: display:{terminalId} and display:{displayId}
      socket.join(SocketRoom.display(display.terminalId));
      if (display._id && display._id !== display.terminalId) {
        socket.join(SocketRoom.display(display._id));
      }

      logger.info(
        `[Socket] Display ${display.terminalId} connected -> joined room: display:${display.terminalId}`
      );

      // Inbound: display:request_token (Refetches rotating QR token without page reload)
      socket.on(
        SocketEvent.DISPLAY_REQUEST_TOKEN,
        async (
          _req: Record<string, unknown> = {},
          callback?: (response: Record<string, unknown>) => void
        ) => {
          try {
            // Find display doc and generate challenge
            const displayDoc = await QrDisplay.findOne({ terminalId: display.terminalId });
            if (displayDoc && displayDoc.isActive) {
              const challenge = await qrService.requestRotatingChallenge(
                displayDoc.terminalId,
                displayDoc.terminalSecret || ""
              );
              socket.emit(SocketEvent.QR_ROTATED, challenge);
              socket.emit(SocketEvent.QR_TOKEN_ROTATE, challenge);
              if (typeof callback === "function") callback({ ...challenge });
            }
          } catch (err) {
            logger.error(`[Socket] Error generating token for display ${display.terminalId}:`, err);
            if (typeof callback === "function")
              callback({ success: false, message: "Token request failed" });
          }
        }
      );

      // Inbound: display:heartbeat (Updates uptime and lastSeen)
      socket.on(SocketEvent.DISPLAY_HEARTBEAT, async () => {
        try {
          await QrDisplay.updateOne(
            { terminalId: display.terminalId },
            { $set: { lastSeen: new Date(), lastHeartbeat: new Date() } }
          );
        } catch (err) {
          logger.error(`[Socket] Heartbeat update error for display ${display.terminalId}:`, err);
        }
      });

      // Inbound: resync for displays
      socket.on(
        SocketEvent.RESYNC,
        async (
          _req: Record<string, unknown> = {},
          callback?: (response: Record<string, unknown>) => void
        ) => {
          try {
            const displayDoc = await QrDisplay.findOne({ terminalId: display.terminalId });
            const responseData = {
              success: true,
              timestamp: new Date().toISOString(),
              type: "display",
              data: {
                terminalId: display.terminalId,
                isActive: displayDoc ? displayDoc.isActive : false,
                status: displayDoc ? displayDoc.status : "UNKNOWN",
              },
            };
            socket.emit(SocketEvent.RESYNC_SUCCESS, responseData);
            if (typeof callback === "function") callback(responseData);
          } catch (err) {
            logger.error(`[Socket] Display resync error for ${display.terminalId}:`, err);
            if (typeof callback === "function")
              callback({ success: false, message: "Resync failed" });
          }
        }
      );
    }

    socket.on("disconnect", (reason) => {
      logger.debug(`[Socket] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  return ioInstance;
}

/**
 * Returns the active Socket.IO server instance
 */
export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Sets the active Socket.IO server instance (useful for testing)
 */
export function setSocketServer(server: SocketIOServer | null): void {
  ioInstance = server;
}

/**
 * Closes the active Socket.IO server instance cleanly
 */
export async function closeSocketServer(): Promise<void> {
  if (ioInstance) {
    await new Promise<void>((resolve) => {
      ioInstance?.close(() => {
        ioInstance = null;
        resolve();
      });
    });
  }
}
