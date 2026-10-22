import {
  SocketEvent,
  SocketRoom,
  AttendanceUpdatedPayload,
  WfhCreatedPayload,
  WfhDecidedPayload,
  EmployeeRegisteredPayload,
  PolicyUpdatedPayload,
  QrRotatedPayload,
  DisplayStatusPayload,
} from "@vorldx/shared";
import { getSocketServer } from "../sockets/socketServer";
import { logger } from "../utils/logger";

/**
 * Central event emitter service.
 * Business logic calls this single service rather than interacting with raw sockets.
 * Events are dispatched only to scoped rooms (e.g. employee:{id}, hr, display:{id}).
 */
export class EventEmitterService {
  /**
   * Generic event dispatcher that maps known events to their scoped room handlers.
   * Can be called as a single function from business code:
   * eventEmitterService.emit("attendance.updated", payload)
   */
  public emit(event: string, payload: unknown): void {
    const io = getSocketServer();
    if (!io) {
      return;
    }

    try {
      switch (event) {
        case SocketEvent.ATTENDANCE_UPDATED:
          this.emitAttendanceUpdated(payload as AttendanceUpdatedPayload);
          break;
        case SocketEvent.WFH_CREATED:
          this.emitWfhCreated(payload as WfhCreatedPayload);
          break;
        case SocketEvent.WFH_DECIDED:
          this.emitWfhDecided(payload as WfhDecidedPayload);
          break;
        case SocketEvent.EMPLOYEE_REGISTERED:
          this.emitEmployeeRegistered(payload as EmployeeRegisteredPayload);
          break;
        case SocketEvent.POLICY_UPDATED:
          this.emitPolicyUpdated(payload as PolicyUpdatedPayload);
          break;
        case SocketEvent.QR_ROTATED:
          this.emitQrRotated(payload as QrRotatedPayload);
          break;
        case SocketEvent.DISPLAY_STATUS:
          this.emitDisplayStatus(payload as DisplayStatusPayload);
          break;
        default:
          io.emit(event, payload);
          break;
      }
    } catch (err) {
      logger.error(`Error emitting socket event ${event}:`, err);
    }
  }

  /**
   * Emits attendance update event to the specific employee and HR dashboard.
   * Only the affected employee and HR portal receive this; other employees do not.
   * Database write must be completed before calling this.
   */
  public emitAttendanceUpdated(payload: AttendanceUpdatedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      // 1. Scoped room for this specific employee
      io.to(SocketRoom.employee(payload.employeeId)).emit(SocketEvent.ATTENDANCE_UPDATED, payload);
      io.to(SocketRoom.employee(payload.employeeId)).emit(SocketEvent.ATTENDANCE_PUNCHED, payload);

      // 2. Scoped rooms for HR / Admins
      io.to(SocketRoom.hr()).emit(SocketEvent.ATTENDANCE_UPDATED, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.ATTENDANCE_UPDATED, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.ATTENDANCE_FEED_ITEM, payload);

      logger.debug(
        `[Socket] Emitted attendance.updated for employee ${payload.employeeId} to employee & hr rooms`
      );
    } catch (err) {
      logger.error(`Failed to emit attendance.updated for ${payload.employeeId}:`, err);
    }
  }

  /**
   * Emits WFH created event to HR review queue and the requesting employee.
   * Database write must be completed before calling this.
   */
  public emitWfhCreated(payload: WfhCreatedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      io.to(SocketRoom.hr()).emit(SocketEvent.WFH_CREATED, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.WFH_CREATED, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.WFH_NEW_REQUEST, payload);

      io.to(SocketRoom.employee(payload.employeeId)).emit(SocketEvent.WFH_CREATED, payload);

      logger.debug(`[Socket] Emitted wfh.created for employee ${payload.employeeId}`);
    } catch (err) {
      logger.error(`Failed to emit wfh.created for ${payload.employeeId}:`, err);
    }
  }

  /**
   * Emits WFH decision (approval/rejection) to the requesting employee and HR.
   * Database write must be completed before calling this.
   */
  public emitWfhDecided(payload: WfhDecidedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      io.to(SocketRoom.employee(payload.employeeId)).emit(SocketEvent.WFH_DECIDED, payload);
      io.to(SocketRoom.employee(payload.employeeId)).emit(SocketEvent.WFH_STATUS_UPDATED, payload);

      io.to(SocketRoom.hr()).emit(SocketEvent.WFH_DECIDED, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.WFH_DECIDED, payload);

      logger.debug(
        `[Socket] Emitted wfh.decided for employee ${payload.employeeId} (${payload.status})`
      );
    } catch (err) {
      logger.error(`Failed to emit wfh.decided for ${payload.employeeId}:`, err);
    }
  }

  /**
   * Emits employee self-registration completion event to HR and the employee.
   * Database write must be completed before calling this.
   */
  public emitEmployeeRegistered(payload: EmployeeRegisteredPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      io.to(SocketRoom.hr()).emit(SocketEvent.EMPLOYEE_REGISTERED, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.EMPLOYEE_REGISTERED, payload);
      io.to(SocketRoom.employee(payload.employeeId)).emit(SocketEvent.EMPLOYEE_REGISTERED, payload);

      logger.debug(`[Socket] Emitted employee.registered for ${payload.employeeId}`);
    } catch (err) {
      logger.error(`Failed to emit employee.registered for ${payload.employeeId}:`, err);
    }
  }

  /**
   * Emits policy update to all connected clients.
   * Database write must be completed before calling this.
   */
  public emitPolicyUpdated(payload: PolicyUpdatedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      io.emit(SocketEvent.POLICY_UPDATED, payload);
      logger.debug(`[Socket] Broadcast policy.updated version ${payload.version}`);
    } catch (err) {
      logger.error(`Failed to emit policy.updated:`, err);
    }
  }

  /**
   * Emits rotating dynamic QR token to the specific display screen room.
   * Database write must be completed before calling this.
   */
  public emitQrRotated(payload: QrRotatedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      if (payload.displayId) {
        io.to(SocketRoom.display(payload.displayId)).emit(SocketEvent.QR_ROTATED, payload);
        io.to(SocketRoom.display(payload.displayId)).emit(SocketEvent.QR_TOKEN_ROTATE, payload);
      }
      if (payload.terminalId && payload.terminalId !== payload.displayId) {
        io.to(SocketRoom.display(payload.terminalId)).emit(SocketEvent.QR_ROTATED, payload);
        io.to(SocketRoom.display(payload.terminalId)).emit(SocketEvent.QR_TOKEN_ROTATE, payload);
      }

      logger.debug(
        `[Socket] Emitted qr.rotated for terminal ${payload.terminalId || payload.displayId}`
      );
    } catch (err) {
      logger.error(`Failed to emit qr.rotated:`, err);
    }
  }

  /**
   * Emits display terminal status change to that display screen and HR portal.
   * Database write must be completed before calling this.
   */
  public emitDisplayStatus(payload: DisplayStatusPayload): void {
    const io = getSocketServer();
    if (!io) return;

    try {
      if (payload.displayId) {
        io.to(SocketRoom.display(payload.displayId)).emit(SocketEvent.DISPLAY_STATUS, payload);
        io.to(SocketRoom.display(payload.displayId)).emit(
          SocketEvent.TERMINAL_STATUS_CHANGED,
          payload
        );
      }
      if (payload.terminalId && payload.terminalId !== payload.displayId) {
        io.to(SocketRoom.display(payload.terminalId)).emit(SocketEvent.DISPLAY_STATUS, payload);
        io.to(SocketRoom.display(payload.terminalId)).emit(
          SocketEvent.TERMINAL_STATUS_CHANGED,
          payload
        );
      }

      io.to(SocketRoom.hr()).emit(SocketEvent.DISPLAY_STATUS, payload);
      io.to(SocketRoom.hrDashboard()).emit(SocketEvent.DISPLAY_STATUS, payload);

      logger.debug(
        `[Socket] Emitted display.status for terminal ${payload.terminalId || payload.displayId}`
      );
    } catch (err) {
      logger.error(`Failed to emit display.status:`, err);
    }
  }
}

export const eventEmitterService = new EventEmitterService();
