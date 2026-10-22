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
};
/**
 * Socket room name generator utilities
 */
exports.SocketRoom = {
    employee: (employeeId) => `employee:${employeeId}`,
    display: (displayOrTerminalId) => `display:${displayOrTerminalId}`,
    hr: () => "hr",
    hrDashboard: () => "hr:dashboard",
};
