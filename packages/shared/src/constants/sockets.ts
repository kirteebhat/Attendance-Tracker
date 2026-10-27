/**
 * Real-time Socket.io event name constants
 */
export const SocketEvent = {
  // Primary Canonical Event Names (assignment requirement)
  ATTENDANCE_UPDATED: "attendance.updated",
  WFH_DECIDED: "wfh.decided",
  WFH_CREATED: "wfh.created",
  EMPLOYEE_REGISTERED: "employee.registered",
  POLICY_UPDATED: "policy.updated",
  QR_ROTATED: "qr.rotated",
  DISPLAY_STATUS: "display.status",

  // Resync & Inbound events
  RESYNC: "resync",
  RESYNC_SUCCESS: "resync.success",

  // Display terminal events (docs/SOCKET_EVENTS.md)
  QR_TOKEN_ROTATE: "qr:token_rotate",
  TERMINAL_STATUS_CHANGED: "terminal:status_changed",
  DISPLAY_REQUEST_TOKEN: "display:request_token",
  DISPLAY_HEARTBEAT: "display:heartbeat",

  // Employee events
  ATTENDANCE_PUNCHED: "attendance:punched",
  WFH_STATUS_UPDATED: "wfh:status_updated",

  // HR / Admin portal events
  ATTENDANCE_FEED_ITEM: "attendance:feed_item",
  STATS_DAILY_UPDATED: "stats:daily_updated",
  WFH_NEW_REQUEST: "wfh:new_request",

  // Leave module events
  LEAVE_REQUESTED: "leave.requested",
  LEAVE_DECIDED: "leave.decided",
  LEAVE_BALANCE_UPDATED: "leave.balance_updated",

  // Calendar & holiday events
  CALENDAR_EVENT_CREATED: "calendar.event_created",
  CALENDAR_EVENT_UPDATED: "calendar.event_updated",
  CALENDAR_EVENT_DELETED: "calendar.event_deleted",

  // Announcement events
  ANNOUNCEMENT_PUBLISHED: "announcement.published",
  ANNOUNCEMENT_PINNED: "announcement.pinned",

  // Enquiry & support ticket events
  ENQUIRY_CREATED: "enquiry.created",
  ENQUIRY_MESSAGE_RECEIVED: "enquiry.message_received",
  ENQUIRY_STATUS_UPDATED: "enquiry.status_updated",

  // Staff security & session events
  STAFF_SESSION_REVOKED: "staff.session_revoked",

  // App Release & OTA events
  APP_RELEASE_PUBLISHED: "app_release.published",

  // Notification events
  NOTIFICATION_NEW: "notification.new",
  NOTIFICATION_READ: "notification.read",
} as const;

export type SocketEventType = (typeof SocketEvent)[keyof typeof SocketEvent];

/**
 * Socket room name generator utilities
 */
export const SocketRoom = {
  employee: (employeeId: string) => `employee:${employeeId}`,
  display: (displayOrTerminalId: string) => `display:${displayOrTerminalId}`,
  hr: () => "hr",
  hrDashboard: () => "hr:dashboard",
} as const;

export interface AttendanceUpdatedPayload {
  recordId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  designation?: string;
  dateKey: string;
  punchType: "CHECK_IN" | "CHECK_OUT" | "CORRECTION" | "WFH_AUTO_CREDIT" | "ABSENT" | "INCOMPLETE";
  status: string;
  isLate: boolean;
  lateMinutes?: number;
  timestamp: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  durationMinutes: number;
  message?: string;
}

export interface WfhCreatedPayload {
  requestId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  dateKey: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface WfhDecidedPayload {
  requestId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  dateKey: string;
  status: string;
  reviewedBy?: string;
  reviewerRemarks?: string | null;
  reviewedAt: string;
}

export interface EmployeeRegisteredPayload {
  employeeId: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  registeredAt: string;
}

export interface PolicyUpdatedPayload {
  policyId: string;
  version: number;
  name: string;
  timezone: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface QrRotatedPayload {
  terminalId: string;
  displayId: string;
  token: string;
  qrPayload?: string;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  serverTime: number;
}

export interface DisplayStatusPayload {
  terminalId: string;
  displayId: string;
  name?: string;
  isActive: boolean;
  status: string;
  message: string;
}

export interface ResyncRequestPayload {
  type?: "all" | "attendance" | "summary" | "display";
}

export interface ResyncResponsePayload {
  success: boolean;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
}
