/**
 * Pure, deterministic time utilities for the VorldX Attendance System.
 * Handles DST-free Asia/Kolkata timezone calculations, overnight shifts,
 * punctuality, workdays, and recurring holidays.
 */
export declare const DEFAULT_TIMEZONE = "Asia/Kolkata";
/**
 * Returns YYYY-MM-DD date key in the specified timezone (default: Asia/Kolkata).
 * Correctly accounts for timezone offsets without relying on host system local time.
 */
export declare function getDateKey(date: Date | string | number, timezone?: string): string;
/**
 * Converts a local wall-clock time string (HH:mm) on a given dateKey (YYYY-MM-DD)
 * in the target timezone into an exact UTC Date instance.
 */
export declare function localTimeToUtc(dateKey: string, timeStr: string, timezone?: string): Date;
/**
 * Adds integer days to a YYYY-MM-DD date key and returns the resulting dateKey string.
 */
export declare function addDaysToDateKey(dateKey: string, days: number): string;
/**
 * Checks whether a given date or dateKey is an official working day based on policy workdays.
 * workdays array uses 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export declare function isWorkday(dateOrKey: Date | string, workdays: number[], timezone?: string): boolean;
export interface HolidaySpec {
    dateKey: string;
    isRecurring?: boolean;
}
/**
 * Checks whether a given date or dateKey matches any defined company holiday.
 * Supports exact date matches and annual recurring holidays (matching MM-DD).
 */
export declare function isHoliday(dateOrKey: Date | string, holidays: HolidaySpec[], timezone?: string): boolean;
export interface ShiftDefinition {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes?: number;
    isOvernight?: boolean;
    checkInWindowStartMinutes?: number;
    checkInWindowEndMinutes?: number;
    checkOutWindowStartMinutes?: number;
    checkOutWindowEndMinutes?: number;
}
export interface ShiftWindowResult {
    dateKey: string;
    shiftStartUtc: Date;
    shiftEndUtc: Date;
    graceEndUtc: Date;
    checkInWindowStartUtc: Date;
    checkInWindowEndUtc: Date;
    checkOutWindowStartUtc: Date;
    checkOutWindowEndUtc: Date;
    isOvernight: boolean;
    isShiftEndNextDay: boolean;
}
/**
 * Calculates exact UTC start, end, grace, and punch window bounds for a shift on a specific dateKey.
 * Accurately spans overnight shifts across midnight in the target timezone.
 */
export declare function getShiftWindow(shift: ShiftDefinition, dateKey: string, timezone?: string): ShiftWindowResult;
/**
 * Evaluates whether a check-in punch timestamp is late relative to shift start + grace period.
 * Returns { isLate: boolean, lateMinutes: number }.
 */
export declare function isLate(checkInTime: Date, shift: ShiftDefinition, dateKeyOrShiftStart: string | Date, timezone?: string): {
    isLate: boolean;
    lateMinutes: number;
};
/**
 * Validates individual shift timing constraints:
 * - Shift end must be after start unless flagged overnight
 * - Overnight shifts must have end time on next day (end <= start)
 * - Grace period must be within 0-60 minutes
 */
export declare function validateShift(shift: {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes?: number;
    isOvernight?: boolean;
}): {
    valid: boolean;
    error?: string;
};
/**
 * Validates an array of policy shifts for duplicates and overlapping windows
 */
export declare function validatePolicyShifts(shifts: {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes?: number;
    isOvernight?: boolean;
    isActive?: boolean;
}[]): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=time.d.ts.map