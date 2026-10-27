"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketRoom = exports.SocketEvent = void 0;
/**
 * Real-time Socket.io event name constants
 */
exports.SocketEvent = {
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
    CALENDAR_UPDATED: "calendar.updated",
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
    STAFF_OTP_REQUESTED: "staff:otp_requested",
    STAFF_OTP_SENT: "staff:otp_sent",
    STAFF_OTP_VERIFIED: "staff:otp_verified",
    STAFF_OTP_FAILED: "staff:otp_failed",
    STAFF_OTP_LOCKED: "staff:otp_locked",
    STAFF_SECURITY_ALERT: "staff:security_alert",
    STAFF_FORCE_LOGOUT: "staff:force_logout",
    // App Release & OTA events
    APP_RELEASE_PUBLISHED: "app_release.published",
    // Notification events
    NOTIFICATION_NEW: "notification.new",
    NOTIFICATION_READ: "notification.read",
};
/**
 * Socket room name generator utilities
 */
exports.SocketRoom = {
    employee: (employeeId) => `employee:${employeeId}`,
    user: (userId) => `user:${userId}`,
    display: (displayOrTerminalId) => `display:${displayOrTerminalId}`,
    hr: () => "hr",
    hrDashboard: () => "hr:dashboard",
};
