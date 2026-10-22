/**
 * User roles in the VorldX Attendance System
 */
export declare enum UserRole {
    ADMIN = "ADMIN",
    HR = "HR",
    EMPLOYEE = "EMPLOYEE",
    HR_ADMIN = "HR_ADMIN"
}
/**
 * Deterministic attendance statuses
 */
export declare enum AttendanceStatus {
    NOT_PUNCHED = "NOT_PUNCHED",
    PRESENT = "PRESENT",
    LATE = "LATE",
    HALF_DAY = "HALF_DAY",
    CHECKED_OUT = "CHECKED_OUT",
    WFH_PENDING = "WFH_PENDING",
    WFH_APPROVED = "WFH_APPROVED",
    WFH_REJECTED = "WFH_REJECTED",
    ABSENT = "ABSENT",
    WEEKEND = "WEEKEND",
    HOLIDAY = "HOLIDAY",
    INCOMPLETE = "INCOMPLETE"
}
/**
 * Daily punch direction
 */
export declare enum PunchType {
    CHECK_IN = "CHECK_IN",
    CHECK_OUT = "CHECK_OUT"
}
/**
 * Work From Home (WFH) request review status
 */
export declare enum WfhStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED"
}
/**
 * Office QR Display terminal pairing and availability state
 */
export declare enum TerminalStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    UNPAIRED = "UNPAIRED",
    REVOKED = "REVOKED",
    DISABLED = "DISABLED"
}
/**
 * Employee work type classifications
 */
export declare enum WorkType {
    FULL_TIME = "FULL_TIME",
    PART_TIME = "PART_TIME",
    CONTRACT = "CONTRACT",
    INTERN = "INTERN"
}
//# sourceMappingURL=enums.d.ts.map