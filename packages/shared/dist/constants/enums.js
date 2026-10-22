"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkType = exports.TerminalStatus = exports.WfhStatus = exports.PunchType = exports.AttendanceStatus = exports.UserRole = void 0;
/**
 * User roles in the VorldX Attendance System
 */
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["HR"] = "HR";
    UserRole["EMPLOYEE"] = "EMPLOYEE";
    UserRole["HR_ADMIN"] = "HR_ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
/**
 * Deterministic attendance statuses
 */
var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["NOT_PUNCHED"] = "NOT_PUNCHED";
    AttendanceStatus["PRESENT"] = "PRESENT";
    AttendanceStatus["LATE"] = "LATE";
    AttendanceStatus["HALF_DAY"] = "HALF_DAY";
    AttendanceStatus["CHECKED_OUT"] = "CHECKED_OUT";
    AttendanceStatus["WFH_PENDING"] = "WFH_PENDING";
    AttendanceStatus["WFH_APPROVED"] = "WFH_APPROVED";
    AttendanceStatus["WFH_REJECTED"] = "WFH_REJECTED";
    AttendanceStatus["ABSENT"] = "ABSENT";
    AttendanceStatus["WEEKEND"] = "WEEKEND";
    AttendanceStatus["HOLIDAY"] = "HOLIDAY";
    AttendanceStatus["INCOMPLETE"] = "INCOMPLETE";
})(AttendanceStatus || (exports.AttendanceStatus = AttendanceStatus = {}));
/**
 * Daily punch direction
 */
var PunchType;
(function (PunchType) {
    PunchType["CHECK_IN"] = "CHECK_IN";
    PunchType["CHECK_OUT"] = "CHECK_OUT";
})(PunchType || (exports.PunchType = PunchType = {}));
/**
 * Work From Home (WFH) request review status
 */
var WfhStatus;
(function (WfhStatus) {
    WfhStatus["PENDING"] = "PENDING";
    WfhStatus["APPROVED"] = "APPROVED";
    WfhStatus["REJECTED"] = "REJECTED";
    WfhStatus["CANCELLED"] = "CANCELLED";
})(WfhStatus || (exports.WfhStatus = WfhStatus = {}));
/**
 * Office QR Display terminal pairing and availability state
 */
var TerminalStatus;
(function (TerminalStatus) {
    TerminalStatus["ACTIVE"] = "ACTIVE";
    TerminalStatus["INACTIVE"] = "INACTIVE";
    TerminalStatus["UNPAIRED"] = "UNPAIRED";
    TerminalStatus["REVOKED"] = "REVOKED";
    TerminalStatus["DISABLED"] = "DISABLED";
})(TerminalStatus || (exports.TerminalStatus = TerminalStatus = {}));
/**
 * Employee work type classifications
 */
var WorkType;
(function (WorkType) {
    WorkType["FULL_TIME"] = "FULL_TIME";
    WorkType["PART_TIME"] = "PART_TIME";
    WorkType["CONTRACT"] = "CONTRACT";
    WorkType["INTERN"] = "INTERN";
})(WorkType || (exports.WorkType = WorkType = {}));
