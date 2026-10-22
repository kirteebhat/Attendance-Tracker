/**
 * Pure, deterministic time utilities for the VorldX Attendance System.
 * Handles DST-free Asia/Kolkata timezone calculations, overnight shifts,
 * punctuality, workdays, and recurring holidays.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Returns YYYY-MM-DD date key in the specified timezone (default: Asia/Kolkata).
 * Correctly accounts for timezone offsets without relying on host system local time.
 */
export function getDateKey(date: Date | string | number, timezone = DEFAULT_TIMEZONE): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to getDateKey: ${date}`);
  }

  // Fast-path for Asia/Kolkata (Fixed UTC+05:30 with no Daylight Saving Time)
  if (timezone === "Asia/Kolkata") {
    const istTime = new Date(d.getTime() + 330 * 60 * 1000);
    const y = istTime.getUTCFullYear();
    const m = String(istTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(istTime.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // General timezone support using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Converts a local wall-clock time string (HH:mm) on a given dateKey (YYYY-MM-DD)
 * in the target timezone into an exact UTC Date instance.
 */
export function localTimeToUtc(
  dateKey: string,
  timeStr: string,
  timezone = DEFAULT_TIMEZONE
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid dateKey (${dateKey}) or timeStr (${timeStr})`);
  }

  // Fast-path for Asia/Kolkata (+05:30 -> subtract 330 minutes to get UTC)
  if (timezone === "Asia/Kolkata") {
    const utcMillis = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - 330 * 60 * 1000;
    return new Date(utcMillis);
  }

  // General timezone translation
  const approximateUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(approximateUtc);
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);

  const localYear = getPart("year");
  const localMonth = getPart("month");
  const localDay = getPart("day");
  let localHour = getPart("hour");
  if (localHour === 24) localHour = 0;
  const localMin = getPart("minute");

  const formattedAsUtc = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMin, 0, 0);
  const offsetMillis = formattedAsUtc - approximateUtc.getTime();

  return new Date(approximateUtc.getTime() - offsetMillis);
}

/**
 * Adds integer days to a YYYY-MM-DD date key and returns the resulting dateKey string.
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Checks whether a given date or dateKey is an official working day based on policy workdays.
 * workdays array uses 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function isWorkday(
  dateOrKey: Date | string,
  workdays: number[],
  timezone = DEFAULT_TIMEZONE
): boolean {
  let dateKey: string;
  if (typeof dateOrKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrKey)) {
    dateKey = dateOrKey;
  } else {
    dateKey = getDateKey(dateOrKey, timezone);
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = d.getUTCDay();

  return workdays.includes(dayOfWeek);
}

export interface HolidaySpec {
  dateKey: string; // YYYY-MM-DD
  isRecurring?: boolean;
}

/**
 * Checks whether a given date or dateKey matches any defined company holiday.
 * Supports exact date matches and annual recurring holidays (matching MM-DD).
 */
export function isHoliday(
  dateOrKey: Date | string,
  holidays: HolidaySpec[],
  timezone = DEFAULT_TIMEZONE
): boolean {
  const targetKey =
    typeof dateOrKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrKey)
      ? dateOrKey
      : getDateKey(dateOrKey, timezone);

  const targetMonthDay = targetKey.slice(5); // "MM-DD"

  return holidays.some((h) => {
    if (h.dateKey === targetKey) return true;
    if (h.isRecurring && h.dateKey.slice(5) === targetMonthDay) return true;
    return false;
  });
}

export interface ShiftDefinition {
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
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
export function getShiftWindow(
  shift: ShiftDefinition,
  dateKey: string,
  timezone = DEFAULT_TIMEZONE
): ShiftWindowResult {
  const graceMinutes = shift.graceMinutes ?? 15;
  const isOvernight = Boolean(shift.isOvernight);
  const checkInStartMin = shift.checkInWindowStartMinutes ?? 60;
  const checkInEndMin = shift.checkInWindowEndMinutes ?? 180;
  const checkOutStartMin = shift.checkOutWindowStartMinutes ?? 60;
  const checkOutEndMin = shift.checkOutWindowEndMinutes ?? 180;

  const shiftStartUtc = localTimeToUtc(dateKey, shift.startTime, timezone);

  // If overnight, end time falls onto the next day in the local calendar
  const endDateKey = isOvernight ? addDaysToDateKey(dateKey, 1) : dateKey;
  const shiftEndUtc = localTimeToUtc(endDateKey, shift.endTime, timezone);

  const graceEndUtc = new Date(shiftStartUtc.getTime() + graceMinutes * 60 * 1000);
  const checkInWindowStartUtc = new Date(shiftStartUtc.getTime() - checkInStartMin * 60 * 1000);
  const checkInWindowEndUtc = new Date(shiftStartUtc.getTime() + checkInEndMin * 60 * 1000);
  const checkOutWindowStartUtc = new Date(shiftEndUtc.getTime() - checkOutStartMin * 60 * 1000);
  const checkOutWindowEndUtc = new Date(shiftEndUtc.getTime() + checkOutEndMin * 60 * 1000);

  return {
    dateKey,
    shiftStartUtc,
    shiftEndUtc,
    graceEndUtc,
    checkInWindowStartUtc,
    checkInWindowEndUtc,
    checkOutWindowStartUtc,
    checkOutWindowEndUtc,
    isOvernight,
    isShiftEndNextDay: isOvernight,
  };
}

/**
 * Evaluates whether a check-in punch timestamp is late relative to shift start + grace period.
 * Returns { isLate: boolean, lateMinutes: number }.
 */
export function isLate(
  checkInTime: Date,
  shift: ShiftDefinition,
  dateKeyOrShiftStart: string | Date,
  timezone = DEFAULT_TIMEZONE
): { isLate: boolean; lateMinutes: number } {
  let shiftStartUtc: Date;
  let graceEndUtc: Date;

  if (dateKeyOrShiftStart instanceof Date) {
    shiftStartUtc = dateKeyOrShiftStart;
    const graceMinutes = shift.graceMinutes ?? 15;
    graceEndUtc = new Date(shiftStartUtc.getTime() + graceMinutes * 60 * 1000);
  } else {
    const window = getShiftWindow(shift, dateKeyOrShiftStart, timezone);
    shiftStartUtc = window.shiftStartUtc;
    graceEndUtc = window.graceEndUtc;
  }

  if (checkInTime.getTime() > graceEndUtc.getTime()) {
    const lateMinutes = Math.max(
      1,
      Math.round((checkInTime.getTime() - shiftStartUtc.getTime()) / (60 * 1000))
    );
    return { isLate: true, lateMinutes };
  }

  return { isLate: false, lateMinutes: 0 };
}

/**
 * Validates individual shift timing constraints:
 * - Shift end must be after start unless flagged overnight
 * - Overnight shifts must have end time on next day (end <= start)
 * - Grace period must be within 0-60 minutes
 */
export function validateShift(shift: {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes?: number;
  isOvernight?: boolean;
}): { valid: boolean; error?: string } {
  const [startH, startM] = shift.startTime.split(":").map(Number);
  const [endH, endM] = shift.endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  if (shift.graceMinutes !== undefined) {
    if (shift.graceMinutes < 0 || shift.graceMinutes > 60) {
      return { valid: false, error: "Grace period must be between 0 and 60 minutes" };
    }
  }

  if (!shift.isOvernight) {
    if (endMin <= startMin) {
      return {
        valid: false,
        error: `Shift '${shift.name}' end time (${shift.endTime}) must be after start time (${shift.startTime}) unless flagged as an overnight shift`,
      };
    }
  } else {
    if (endMin > startMin) {
      return {
        valid: false,
        error: `Shift '${shift.name}' is flagged overnight but end time (${shift.endTime}) is after start time (${shift.startTime}) on the same day`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates an array of policy shifts for duplicates and overlapping windows
 */
export function validatePolicyShifts(
  shifts: {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes?: number;
    isOvernight?: boolean;
    isActive?: boolean;
  }[]
): { valid: boolean; error?: string } {
  const names = new Set<string>();

  for (const shift of shifts) {
    const lowerName = shift.name.trim().toLowerCase();
    if (names.has(lowerName)) {
      return { valid: false, error: `Duplicate shift name '${shift.name}' found in policy` };
    }
    names.add(lowerName);

    const shiftValidation = validateShift(shift);
    if (!shiftValidation.valid) {
      return shiftValidation;
    }
  }

  // Check overlapping active shifts if both are standard daytime shifts
  const activeDayShifts = shifts.filter((s) => s.isActive !== false && !s.isOvernight);
  for (let i = 0; i < activeDayShifts.length; i++) {
    for (let j = i + 1; j < activeDayShifts.length; j++) {
      const s1 = activeDayShifts[i];
      const s2 = activeDayShifts[j];
      const [s1StartH, s1StartM] = s1.startTime.split(":").map(Number);
      const [s1EndH, s1EndM] = s1.endTime.split(":").map(Number);
      const [s2StartH, s2StartM] = s2.startTime.split(":").map(Number);
      const [s2EndH, s2EndM] = s2.endTime.split(":").map(Number);

      const s1Start = s1StartH * 60 + s1StartM;
      const s1End = s1EndH * 60 + s1EndM;
      const s2Start = s2StartH * 60 + s2StartM;
      const s2End = s2EndH * 60 + s2EndM;

      if (s1Start === s2Start && s1End === s2End) {
        return {
          valid: false,
          error: `Shifts '${s1.name}' and '${s2.name}' have identical operating hours (${s1.startTime} - ${s1.endTime})`,
        };
      }
    }
  }

  return { valid: true };
}
