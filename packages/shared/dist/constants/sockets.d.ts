/**
 * Real-time Socket.io event name constants
 */
export declare const SocketEvent: {
    readonly ATTENDANCE_UPDATED: "attendance.updated";
    readonly WFH_DECIDED: "wfh.decided";
    readonly WFH_CREATED: "wfh.created";
    readonly EMPLOYEE_REGISTERED: "employee.registered";
    readonly POLICY_UPDATED: "policy.updated";
    readonly QR_ROTATED: "qr.rotated";
    readonly DISPLAY_STATUS: "display.status";
    readonly RESYNC: "resync";
    readonly RESYNC_SUCCESS: "resync.success";
    readonly QR_TOKEN_ROTATE: "qr:token_rotate";
    readonly TERMINAL_STATUS_CHANGED: "terminal:status_changed";
    readonly DISPLAY_REQUEST_TOKEN: "display:request_token";
    readonly DISPLAY_HEARTBEAT: "display:heartbeat";
    readonly ATTENDANCE_PUNCHED: "attendance:punched";
    readonly WFH_STATUS_UPDATED: "wfh:status_updated";
    readonly ATTENDANCE_FEED_ITEM: "attendance:feed_item";
    readonly STATS_DAILY_UPDATED: "stats:daily_updated";
    readonly WFH_NEW_REQUEST: "wfh:new_request";
    readonly LEAVE_REQUESTED: "leave.requested";
    readonly LEAVE_DECIDED: "leave.decided";
    readonly LEAVE_BALANCE_UPDATED: "leave.balance_updated";
    readonly CALENDAR_UPDATED: "calendar.updated";
    readonly CALENDAR_EVENT_CREATED: "calendar.event_created";
    readonly CALENDAR_EVENT_UPDATED: "calendar.event_updated";
    readonly CALENDAR_EVENT_DELETED: "calendar.event_deleted";
    readonly ANNOUNCEMENT_PUBLISHED: "announcement.published";
    readonly ANNOUNCEMENT_PINNED: "announcement.pinned";
    readonly ENQUIRY_CREATED: "enquiry.created";
    readonly ENQUIRY_MESSAGE_RECEIVED: "enquiry.message_received";
    readonly ENQUIRY_STATUS_UPDATED: "enquiry.status_updated";
    readonly STAFF_SESSION_REVOKED: "staff.session_revoked";
    readonly STAFF_OTP_REQUESTED: "staff:otp_requested";
    readonly STAFF_OTP_SENT: "staff:otp_sent";
    readonly STAFF_OTP_VERIFIED: "staff:otp_verified";
    readonly STAFF_OTP_FAILED: "staff:otp_failed";
    readonly STAFF_OTP_LOCKED: "staff:otp_locked";
    readonly STAFF_SECURITY_ALERT: "staff:security_alert";
    readonly STAFF_FORCE_LOGOUT: "staff:force_logout";
    readonly APP_RELEASE_PUBLISHED: "app_release.published";
    readonly NOTIFICATION_NEW: "notification.new";
    readonly NOTIFICATION_READ: "notification.read";
};
export type SocketEventType = (typeof SocketEvent)[keyof typeof SocketEvent];
/**
 * Socket room name generator utilities
 */
export declare const SocketRoom: {
    readonly employee: (employeeId: string) => string;
    readonly user: (userId: string) => string;
    readonly display: (displayOrTerminalId: string) => string;
    readonly hr: () => string;
    readonly hrDashboard: () => string;
};
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
//# sourceMappingURL=sockets.d.ts.map