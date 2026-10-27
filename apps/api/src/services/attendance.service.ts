import { Types } from "mongoose";
import {
  AttendanceRecord,
  IAttendanceRecord,
  Employee,
  QrChallenge,
  User,
  WfhRequest,
  LeaveRequest,
  AuditEvent,
  ICorrectionHistoryEntry,
} from "../models";
import * as qrService from "./qr.service";
import { policyService } from "./policy.service";
import { eventEmitterService } from "./eventEmitter.service";
import { calendarService } from "./calendar.service";
import { AppError } from "../utils/AppError";
import {
  ApiErrorCode,
  ApiErrorCodeType,
  AttendanceStatus,
  getDateKey,
  addDaysToDateKey,
  isLate,
  WfhStatus,
  AttendanceFilterQuery,
  AttendanceCorrectionRequest,
  ShiftDefinition,
} from "@vorldx/shared";

export interface ScanResult {
  success: boolean;
  punchType: "CHECK_IN" | "CHECK_OUT";
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  durationMinutes: number;
  record: IAttendanceRecord;
  message: string;
}

export interface TodayAttendanceResult {
  success: boolean;
  dateKey: string;
  hasPunched: boolean;
  punchType: "CHECKED_IN" | "CHECKED_OUT" | null;
  status: AttendanceStatus;
  record: IAttendanceRecord | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

export interface AttendanceHistoryResult {
  success: boolean;
  data: IAttendanceRecord[];
  stats: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    halfDays: number;
    wfhDays: number;
    absentDays: number;
    totalWorkMinutes: number;
    attendancePercentage: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Resolves the employee document from userId or employeeId
 */
async function resolveEmployee(userId: string) {
  let employee = await Employee.findOne({ userId });
  if (!employee) {
    const user = await User.findById(userId);
    if (user?.employeeId) {
      employee = await Employee.findOne({ employeeId: user.employeeId });
    }
  }
  return employee;
}

/**
 * Core attendance scan engine:
 * 1. Authenticate employee & verify active state
 * 2. Validate QR token via QR service
 * 3. Enforce per-employee replay protection
 * 4. Derive dateKey & handle cross-midnight overnight shifts
 * 5. Apply attendance state machine (no record -> check-in, checked-in -> check-out)
 * 6. Concurrency-safe atomic upsert / findOneAndUpdate
 */
export async function scanAttendance(
  userId: string,
  params: {
    token?: string;
    qrPayload?: string;
    action?: "CHECK_IN" | "CHECK_OUT";
    simulatedNow?: Date;
  }
): Promise<ScanResult> {
  const tokenString = (params.token || params.qrPayload || "").trim();
  if (!tokenString) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_INVALID_QR_TOKEN,
      "QR token or payload string is required."
    );
  }

  // 1. Authenticate employee & check active status
  const employee = await resolveEmployee(userId);
  if (!employee) {
    throw new AppError(404, ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND, "Employee profile not found.");
  }

  if (!employee.isActive) {
    throw new AppError(
      403,
      ApiErrorCode.ERR_EMPLOYEE_INACTIVE,
      "Your employee account is inactive. Please contact HR."
    );
  }

  // 2. Validate QR token via QR service
  const qrResult = await qrService.validateQrToken(tokenString);
  if (!qrResult.isValid) {
    throw new AppError(
      400,
      (qrResult.code as ApiErrorCodeType) || ApiErrorCode.ERR_INVALID_QR_TOKEN,
      qrResult.message || "Invalid QR token."
    );
  }

  const now = params.simulatedNow || new Date();

  // 3. Per-employee replay protection: atomic insert into QrChallenge
  try {
    await QrChallenge.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      qrNonce: tokenString,
      terminalId: qrResult.terminalId || "UNKNOWN",
      redeemedAt: now,
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_QR_REPLAY_DETECTED,
        "You have already scanned this specific QR code token."
      );
    }
    throw err;
  }

  // 4. Timezone & dateKey derivation from active policy
  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  const todayDateKey = getDateKey(now, timezone);

  // Find assigned shift
  let shift: ShiftDefinition | undefined;

  if (employee.shiftId) {
    const shiftIdStr = employee.shiftId.toString();
    const matchedShift = policy.shifts.find(
      (s) => s._id.toString() === shiftIdStr || s.name === shiftIdStr
    );
    if (matchedShift) {
      shift = {
        name: matchedShift.name,
        startTime: matchedShift.startTime,
        endTime: matchedShift.endTime,
        graceMinutes: matchedShift.graceMinutes,
        isOvernight: matchedShift.isOvernight,
      };
    }
  }
  if (!shift && policy.shifts.length > 0) {
    // If night shift exists and current hour is >= 20:00 or <= 07:00, pick overnight shift
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(now),
      10
    );

    const nightShift = policy.shifts.find((s) => s.isOvernight);
    const chosen = nightShift && (localHour >= 20 || localHour < 8) ? nightShift : policy.shifts[0];
    shift = {
      name: chosen.name,
      startTime: chosen.startTime,
      endTime: chosen.endTime,
      graceMinutes: chosen.graceMinutes,
      isOvernight: chosen.isOvernight,
    };
  }

  // Fallback default shift
  const defaultShift: ShiftDefinition = shift || {
    name: "General Day Shift",
    startTime: "09:00",
    endTime: "18:00",
    isOvernight: false,
    graceMinutes: policy.defaultGraceMinutes || 15,
  };

  // 5. Cross-Midnight Overnight Shift Matching:
  // Check if there is an open check-in session from yesterday (for overnight shifts)
  const yesterdayDateKey = addDaysToDateKey(todayDateKey, -1);
  const openSession = await AttendanceRecord.findOne({
    employee: employee._id,
    dateKey: yesterdayDateKey,
    checkOutTime: null,
  });

  let effectiveDateKey = todayDateKey;
  let recordToProcess: IAttendanceRecord | null = null;

  if (openSession) {
    // If the shift was overnight, or if punch is early morning before 12:00 PM
    effectiveDateKey = yesterdayDateKey;
    recordToProcess = openSession;
  } else {
    // Otherwise look for today's record
    recordToProcess = await AttendanceRecord.findOne({
      employee: employee._id,
      dateKey: todayDateKey,
    });
  }

  // 6. Apply Attendance State Machine Transitions
  if (recordToProcess) {
    // Case A: Record exists with active check-in -> Process CHECK-OUT
    if (recordToProcess.checkInTime && !recordToProcess.checkOutTime) {
      if (params.action === "CHECK_IN") {
        throw new AppError(
          409,
          ApiErrorCode.ERR_ALREADY_CHECKED_IN,
          "Employee is already checked in for today. Your next scan will be processed as Check-Out."
        );
      }

      // Calculate work duration
      const durationMinutes = Math.max(
        0,
        Math.round((now.getTime() - recordToProcess.checkInTime.getTime()) / 60000)
      );

      // Determine final status based on company policy thresholds
      const fullDayThreshold = (policy.minFullDayHours || 8) * 60;
      const halfDayThreshold = (policy.minHalfDayHours || 4) * 60;

      let finalStatus: AttendanceStatus;
      if (durationMinutes >= fullDayThreshold) {
        finalStatus = AttendanceStatus.CHECKED_OUT;
      } else if (durationMinutes >= halfDayThreshold) {
        finalStatus = AttendanceStatus.HALF_DAY;
      } else {
        // Under half day: status remains present/late or checked_out with incomplete duration
        finalStatus = AttendanceStatus.CHECKED_OUT;
      }

      // Concurrency guard: atomic update conditioned on checkOutTime remaining null
      const updatedRecord = await AttendanceRecord.findOneAndUpdate(
        {
          _id: recordToProcess._id,
          checkOutTime: null,
        },
        {
          $set: {
            checkOutTime: now,
            durationMinutes,
            status: finalStatus,
          },
        },
        { new: true }
      );

      if (!updatedRecord) {
        throw new AppError(
          409,
          ApiErrorCode.ERR_ALREADY_CHECKED_IN,
          "You have already checked out for today. Attendance session closed."
        );
      }

      eventEmitterService.emitAttendanceUpdated({
        recordId: updatedRecord._id.toString(),
        employeeId: employee.employeeId,
        employeeName: employee.name,
        department: employee.department,
        designation: employee.designation,
        dateKey: effectiveDateKey,
        punchType: "CHECK_OUT",
        status: finalStatus,
        isLate: updatedRecord.isLate,
        lateMinutes: updatedRecord.lateMinutes,
        timestamp: now.toISOString(),
        checkInTime: updatedRecord.checkInTime ? updatedRecord.checkInTime.toISOString() : null,
        checkOutTime: now.toISOString(),
        durationMinutes,
        message: `Check-out successful. Total duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m.`,
      });

      return {
        success: true,
        punchType: "CHECK_OUT",
        status: finalStatus,
        isLate: updatedRecord.isLate,
        lateMinutes: updatedRecord.lateMinutes,
        durationMinutes,
        record: updatedRecord,
        message: `Check-out successful. Total duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m.`,
      };
    }

    // Case B: Record exists and is already checked out
    if (recordToProcess.checkOutTime) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ALREADY_CHECKED_IN,
        "You have already checked out for today. Your daily attendance session is completed."
      );
    }

    // Case C: WFH approved record exists
    if (recordToProcess.status === AttendanceStatus.WFH_APPROVED) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ALREADY_WFH_APPROVED,
        "Attendance already recorded as Work From Home for today. Contact HR if you wish to revoke WFH."
      );
    }

    // Case D: Absent record exists
    if (recordToProcess.status === AttendanceStatus.ABSENT) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_ATTENDANCE_WINDOW_CLOSED,
        "The attendance window for this date has closed. Please contact HR for a manual correction."
      );
    }
  }

  // Case E: No record exists for today -> Process CHECK-IN
  if (params.action === "CHECK_OUT") {
    throw new AppError(
      400,
      ApiErrorCode.ERR_NO_ACTIVE_CHECKIN,
      "Cannot check out. No active check-in session found for this employee today."
    );
  }

  // Evaluate late status relative to shift start + grace period
  const lateEvaluation = isLate(now, defaultShift, effectiveDateKey, timezone);
  const initialStatus = lateEvaluation.isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

  // Concurrency-safe atomic insert/upsert guarded by unique compound index { employee: 1, dateKey: 1 }
  try {
    const upsertResult = await AttendanceRecord.findOneAndUpdate(
      { employee: employee._id, dateKey: effectiveDateKey },
      {
        $setOnInsert: {
          employee: employee._id,
          employeeId: employee.employeeId,
          department: employee.department,
          dateKey: effectiveDateKey,
          checkInTime: now,
          checkOutTime: null,
          durationMinutes: 0,
          status: initialStatus,
          isLate: lateEvaluation.isLate,
          lateMinutes: lateEvaluation.lateMinutes,
          isWfh: false,
          isMissingCheckout: false,
          isManuallyCorrected: false,
          policyId: policy._id,
          policyVersion: policy.version,
          terminalId: qrResult.terminalId,
        },
      },
      { upsert: true, new: true, rawResult: true }
    );

    const createdRecord =
      (upsertResult as { value?: IAttendanceRecord }).value ||
      (upsertResult as unknown as IAttendanceRecord);
    const updatedExisting = (upsertResult as { lastErrorObject?: { updatedExisting?: boolean } })
      .lastErrorObject?.updatedExisting;

    if (updatedExisting) {
      // A concurrent request won the race and created the check-in first
      throw new AppError(
        409,
        ApiErrorCode.ERR_ALREADY_CHECKED_IN,
        "Employee is already checked in for today."
      );
    }

    eventEmitterService.emitAttendanceUpdated({
      recordId: createdRecord._id.toString(),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      designation: employee.designation,
      dateKey: effectiveDateKey,
      punchType: "CHECK_IN",
      status: initialStatus,
      isLate: lateEvaluation.isLate,
      lateMinutes: lateEvaluation.lateMinutes,
      timestamp: now.toISOString(),
      checkInTime: now.toISOString(),
      checkOutTime: null,
      durationMinutes: 0,
      message: lateEvaluation.isLate
        ? `Check-in recorded (Late by ${lateEvaluation.lateMinutes} minutes).`
        : "Check-in successful. Welcome to VorldX!",
    });

    return {
      success: true,
      punchType: "CHECK_IN",
      status: initialStatus,
      isLate: lateEvaluation.isLate,
      lateMinutes: lateEvaluation.lateMinutes,
      durationMinutes: 0,
      record: createdRecord,
      message: lateEvaluation.isLate
        ? `Check-in recorded (Late by ${lateEvaluation.lateMinutes} minutes).`
        : "Check-in successful. Welcome to VorldX!",
    };
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ALREADY_CHECKED_IN,
        "Employee is already checked in for today."
      );
    }
    throw err;
  }
}

/**
 * Retrieves today's current attendance state for the authenticated employee
 */
export async function getTodayAttendance(
  userId: string,
  simulatedNow?: Date
): Promise<TodayAttendanceResult> {
  const employee = await resolveEmployee(userId);
  if (!employee) {
    throw new AppError(404, ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND, "Employee profile not found.");
  }

  const now = simulatedNow || new Date();
  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  const todayDateKey = getDateKey(now, timezone);

  // Check for open cross-midnight session from yesterday
  const yesterdayKey = addDaysToDateKey(todayDateKey, -1);
  const openYesterday = await AttendanceRecord.findOne({
    employee: employee._id,
    dateKey: yesterdayKey,
    checkOutTime: null,
  });

  const record =
    openYesterday ||
    (await AttendanceRecord.findOne({
      employee: employee._id,
      dateKey: todayDateKey,
    }));

  if (!record) {
    return {
      success: true,
      dateKey: todayDateKey,
      hasPunched: false,
      punchType: null,
      status: AttendanceStatus.NOT_PUNCHED,
      record: null,
      canCheckIn: true,
      canCheckOut: false,
    };
  }

  const punchType = record.checkOutTime ? "CHECKED_OUT" : "CHECKED_IN";

  return {
    success: true,
    dateKey: record.dateKey,
    hasPunched: true,
    punchType,
    status: record.status,
    record,
    canCheckIn: false,
    canCheckOut: !record.checkOutTime,
  };
}

/**
 * Retrieves historical attendance records and calculated summary stats for an employee
 */
export async function getMyAttendanceHistory(
  userId: string,
  query: {
    month?: string; // YYYY-MM
    dateKey?: string; // YYYY-MM-DD
    status?: AttendanceStatus;
    page?: number;
    limit?: number;
  }
): Promise<AttendanceHistoryResult> {
  const employee = await resolveEmployee(userId);
  if (!employee) {
    throw new AppError(404, ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND, "Employee profile not found.");
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { employee: employee._id };

  if (query.dateKey) {
    filter.dateKey = query.dateKey;
  } else if (query.month) {
    filter.dateKey = new RegExp(`^${query.month}`);
  }

  if (query.status) {
    filter.status = query.status;
  }

  const [records, total, allFilteredRecords] = await Promise.all([
    AttendanceRecord.find(filter).sort({ dateKey: -1 }).skip(skip).limit(limit),
    AttendanceRecord.countDocuments(filter),
    AttendanceRecord.find(filter),
  ]);

  // Aggregate statistics across matching records
  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let wfhDays = 0;
  let absentDays = 0;
  let totalWorkMinutes = 0;

  for (const r of allFilteredRecords) {
    if (r.isLate) lateDays++;
    if (r.status === AttendanceStatus.HALF_DAY) halfDays++;
    if (r.isWfh || r.status === AttendanceStatus.WFH_APPROVED) wfhDays++;
    if (r.status === AttendanceStatus.ABSENT) absentDays++;

    if (
      [
        AttendanceStatus.PRESENT,
        AttendanceStatus.LATE,
        AttendanceStatus.HALF_DAY,
        AttendanceStatus.CHECKED_OUT,
      ].includes(r.status)
    ) {
      presentDays++;
    }

    totalWorkMinutes += r.durationMinutes || 0;
  }

  const totalDays = allFilteredRecords.length;
  const attendancePercentage =
    totalDays > 0 ? Math.round(((presentDays + wfhDays) / totalDays) * 100) : 0;

  return {
    success: true,
    data: records,
    stats: {
      totalDays,
      presentDays,
      lateDays,
      halfDays,
      wfhDays,
      absentDays,
      totalWorkMinutes,
      attendancePercentage,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * HR/Admin: Lists attendance records across the organization with multi-field filters, search, and pagination
 */
export async function listAttendanceRecords(query: AttendanceFilterQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  // Date range filtering
  const startDate = query.startDate || query.from;
  const endDate = query.endDate || query.to;

  if (startDate && endDate) {
    filter.dateKey = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.dateKey = { $gte: startDate };
  } else if (endDate) {
    filter.dateKey = { $lte: endDate };
  } else if (query.dateKey) {
    filter.dateKey = query.dateKey;
  }

  // Department
  if (query.department) {
    filter.department = query.department;
  }

  // Status
  if (query.status) {
    filter.status = query.status;
  }

  // Employee (ID or ObjectId)
  const empTarget = query.employeeId || query.employee;
  if (empTarget) {
    if (Types.ObjectId.isValid(empTarget)) {
      filter.$or = [{ employee: new Types.ObjectId(empTarget) }, { employeeId: empTarget }];
    } else {
      filter.employeeId = empTarget.trim().toUpperCase();
    }
  }

  // Work Type filter (query Employee collection)
  if (query.workType) {
    const matchingWorkTypeEmployees = await Employee.find({ workType: query.workType }).select(
      "_id"
    );
    const empIds = matchingWorkTypeEmployees.map((e) => e._id);
    filter.employee = { $in: empIds };
  }

  // Search filter (name, employeeId, department)
  if (query.search && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    const matchingEmployees = await Employee.find({
      $or: [{ name: searchRegex }, { employeeId: searchRegex }, { department: searchRegex }],
    }).select("_id");
    const empIds = matchingEmployees.map((e) => e._id);

    filter.$or = [
      { employee: { $in: empIds } },
      { employeeId: searchRegex },
      { department: searchRegex },
    ];
  }

  const sortField = query.sortBy || "dateKey";
  const sortOrder = query.sortOrder === "asc" ? 1 : -1;
  const sortOption: Record<string, 1 | -1> = { [sortField]: sortOrder };
  if (sortField !== "createdAt") {
    sortOption.createdAt = -1;
  }

  const [records, total] = await Promise.all([
    AttendanceRecord.find(filter)
      .populate("employee", "name email department designation workType")
      .populate("correctedBy", "email employeeId")
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    AttendanceRecord.countDocuments(filter),
  ]);

  return {
    success: true,
    data: records,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * HR/Admin: Administrative correction of an attendance record
 * - Mandatory justification reason (min 5 chars)
 * - Validates checkOutTime > checkInTime
 * - Preserves original pre-correction values in originalValues & corrections history array
 * - Recomputes duration, late flag, and state machine status
 * - Records an immutable AuditEvent
 */
export async function correctAttendanceRecord(
  recordId: string,
  data: AttendanceCorrectionRequest,
  actor: { userId: string; employeeId?: string; role?: string }
) {
  if (!Types.ObjectId.isValid(recordId)) {
    throw new AppError(400, ApiErrorCode.ERR_BAD_REQUEST, "Invalid attendance record ID format.");
  }

  if (!data.reason || data.reason.trim().length < 5) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_CORRECTION_REASON_REQUIRED,
      "A justification reason of at least 5 characters is required for administrative corrections."
    );
  }

  const record = await AttendanceRecord.findById(recordId);
  if (!record) {
    throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, "Attendance record not found.");
  }

  const finalCheckIn =
    data.checkInTime !== undefined
      ? data.checkInTime
        ? new Date(data.checkInTime)
        : null
      : record.checkInTime;

  const finalCheckOut =
    data.checkOutTime !== undefined
      ? data.checkOutTime
        ? new Date(data.checkOutTime)
        : null
      : record.checkOutTime;

  // Validate checkOut is strictly after checkIn
  if (finalCheckIn && finalCheckOut) {
    if (finalCheckOut.getTime() <= finalCheckIn.getTime()) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_BAD_REQUEST,
        "Check-out time must be strictly after check-in time."
      );
    }
  }

  // Preserve original pre-correction values on the first correction
  if (!record.originalValues) {
    record.originalValues = {
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      status: record.status,
      durationMinutes: record.durationMinutes,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
    };
  }

  const previousSnapshot = {
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime,
    status: record.status,
    durationMinutes: record.durationMinutes,
    isLate: record.isLate,
    lateMinutes: record.lateMinutes,
    isMissingCheckout: record.isMissingCheckout,
  };

  // Recompute duration
  let durationMinutes = 0;
  if (finalCheckIn && finalCheckOut) {
    durationMinutes = Math.round((finalCheckOut.getTime() - finalCheckIn.getTime()) / (1000 * 60));
  } else if (
    data.status === AttendanceStatus.WFH_APPROVED ||
    record.status === AttendanceStatus.WFH_APPROVED
  ) {
    durationMinutes = 480;
  }

  // Recompute late
  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  let isLateVal = false;
  let lateMinutesVal = 0;

  if (data.isLate !== undefined) {
    isLateVal = data.isLate;
  } else if (finalCheckIn) {
    const employee = await Employee.findById(record.employee);
    const shift =
      (employee?.shiftId ? policy.shifts.id(employee.shiftId) : null) ||
      policy.shifts.find((s) => s.isActive) ||
      policy.shifts[0];
    if (shift) {
      const lateResult = isLate(
        finalCheckIn,
        shift as unknown as ShiftDefinition,
        record.dateKey,
        timezone
      );
      isLateVal = lateResult.isLate;
      lateMinutesVal = lateResult.lateMinutes;
    }
  }

  // Recompute status
  let finalStatus = record.status;
  if (data.status !== undefined) {
    finalStatus = data.status;
  } else {
    if (!finalCheckIn && !finalCheckOut) {
      finalStatus =
        record.isWfh || record.status === AttendanceStatus.WFH_APPROVED
          ? AttendanceStatus.WFH_APPROVED
          : AttendanceStatus.ABSENT;
    } else if (finalCheckIn && finalCheckOut) {
      const minFullDay = (policy.minFullDayHours || 8) * 60;
      const minHalfDay = (policy.minHalfDayHours || 4) * 60;
      if (durationMinutes >= minFullDay) {
        finalStatus = AttendanceStatus.CHECKED_OUT;
      } else if (durationMinutes >= minHalfDay) {
        finalStatus = AttendanceStatus.HALF_DAY;
      } else {
        finalStatus = AttendanceStatus.INCOMPLETE;
      }
    } else if (finalCheckIn && !finalCheckOut) {
      if (data.isMissingCheckout) {
        finalStatus = AttendanceStatus.INCOMPLETE;
      } else {
        finalStatus = isLateVal ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      }
    }
  }

  const isMissingCheckoutVal =
    data.isMissingCheckout !== undefined
      ? data.isMissingCheckout
      : finalCheckIn && !finalCheckOut
        ? true
        : false;

  const now = new Date();
  const adminUserId = new Types.ObjectId(actor.userId);

  const correctionEntry: ICorrectionHistoryEntry = {
    correctionReason: data.reason.trim(),
    correctedBy: adminUserId,
    correctedAt: now,
    previousValues: previousSnapshot,
    newValues: {
      checkInTime: finalCheckIn,
      checkOutTime: finalCheckOut,
      status: finalStatus,
      durationMinutes,
      isLate: isLateVal,
      lateMinutes: lateMinutesVal,
      isMissingCheckout: isMissingCheckoutVal,
    },
  };

  record.corrections = record.corrections || [];
  record.corrections.push(correctionEntry);

  record.checkInTime = finalCheckIn;
  record.checkOutTime = finalCheckOut;
  record.durationMinutes = durationMinutes;
  record.status = finalStatus;
  record.isLate = isLateVal;
  record.lateMinutes = lateMinutesVal;
  record.isMissingCheckout = isMissingCheckoutVal;
  record.isManuallyCorrected = true;
  record.correctionReason = data.reason.trim();
  record.correctedBy = adminUserId;
  record.correctedAt = now;

  await record.save();

  // Write immutable AuditEvent
  await AuditEvent.create({
    entityType: "ATTENDANCE_RECORD",
    entityId: record._id.toString(),
    performedBy: adminUserId,
    performedByEmployeeId: actor.employeeId || "ADMIN",
    action: "CORRECTION",
    previousValue: previousSnapshot,
    newValue: correctionEntry.newValues,
    reason: data.reason.trim(),
    timestamp: now,
    metadata: { actorRole: actor.role || "HR" },
  });

  eventEmitterService.emitAttendanceUpdated({
    recordId: record._id.toString(),
    employeeId: record.employeeId,
    dateKey: record.dateKey,
    punchType: "CORRECTION",
    status: record.status,
    isLate: record.isLate,
    lateMinutes: record.lateMinutes,
    timestamp: now.toISOString(),
    checkInTime: record.checkInTime ? record.checkInTime.toISOString() : null,
    checkOutTime: record.checkOutTime ? record.checkOutTime.toISOString() : null,
    durationMinutes: record.durationMinutes,
    message: "Attendance record successfully corrected by HR.",
  });

  return {
    success: true,
    message: "Attendance record successfully corrected.",
    record,
  };
}

/**
 * Scheduled job & manual demo trigger:
 * Evaluates absentees and incomplete check-outs for a target dateKey:
 * 1. Never marks absent before the policy cutoff time for today (unless force=true)
 * 2. Excludes non-working days (weekends) and official holidays
 * 3. Excludes employees with approved WFH or existing attendance records
 * 4. Marks employees who checked in without checkout as "INCOMPLETE"
 * 5. Strictly idempotent: running multiple times yields the exact same state without duplicate records
 */
export async function evaluateAbsenceAndIncompleteJob(
  targetDateKey?: string,
  options?: {
    force?: boolean;
    simulatedNow?: Date;
  }
) {
  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  const now = options?.simulatedNow || new Date();
  const todayDateKey = getDateKey(now, timezone);
  const dateKey = targetDateKey || todayDateKey;

  // 1. Cutoff verification: never mark absent for today before the policy cutoff
  if (dateKey === todayDateKey && !options?.force) {
    const cutoffTime = policy.absenceEvaluationCutoffTime || "23:59";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentLocalTime = formatter.format(now);

    if (currentLocalTime < cutoffTime) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_CUTOFF_NOT_REACHED,
        `Cannot evaluate absences before the daily policy cutoff time (${cutoffTime}). Current local time is ${currentLocalTime}.`
      );
    }
  }

  // 2. Unified Calendar Check: exclude weekly-off, public holidays, and company off-days
  const dayType = await calendarService.getDayType(dateKey, timezone, policy.workdays);
  if (dayType !== "workday") {
    const isHoliday = dayType === "public-holiday" || dayType === "company-off-day";
    return {
      evaluatedDateKey: dateKey,
      absenteesMarked: 0,
      incompleteMarked: 0,
      skipped: true,
      message: isHoliday
        ? `Target date ${dateKey} is an official company holiday. No absentees marked.`
        : `Target date ${dateKey} is a non-working weekend day. No absentees marked.`,
    };
  }

  // 4. Retrieve all active employees
  const activeEmployees = await Employee.find({ isActive: true });
  let absenteesMarked = 0;
  let incompleteMarked = 0;

  for (const emp of activeEmployees) {
    // Check if employee has an approved WFH request for this date
    const approvedWfh = await WfhRequest.findOne({
      employee: emp._id,
      dateKey,
      status: WfhStatus.APPROVED,
    });

    // Check if employee has an approved Leave request covering this date
    const dateStart = new Date(`${dateKey}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateKey}T23:59:59.999Z`);
    const approvedLeave = await LeaveRequest.findOne({
      employee: emp._id,
      status: "APPROVED",
      startDate: { $lte: dateEnd },
      endDate: { $gte: dateStart },
    });

    const existingRecord = await AttendanceRecord.findOne({
      employee: emp._id,
      dateKey,
    });

    if (existingRecord) {
      // If already marked as ON_LEAVE, skip absence evaluation
      if (existingRecord.status === AttendanceStatus.ON_LEAVE) {
        continue;
      }

      // Mark forgotten check-outs as "INCOMPLETE"
      if (
        existingRecord.checkInTime &&
        !existingRecord.checkOutTime &&
        !existingRecord.isMissingCheckout
      ) {
        existingRecord.status = AttendanceStatus.INCOMPLETE;
        existingRecord.isMissingCheckout = true;
        existingRecord.systemNotes = existingRecord.systemNotes
          ? `${existingRecord.systemNotes} | Marked INCOMPLETE by scheduled absence cutoff job`
          : "Marked INCOMPLETE by scheduled absence cutoff job";
        await existingRecord.save();
        incompleteMarked++;

        eventEmitterService.emitAttendanceUpdated({
          recordId: existingRecord._id.toString(),
          employeeId: emp.employeeId,
          dateKey,
          punchType: "INCOMPLETE",
          status: AttendanceStatus.INCOMPLETE,
          isLate: existingRecord.isLate,
          lateMinutes: existingRecord.lateMinutes,
          timestamp: new Date().toISOString(),
          checkInTime: existingRecord.checkInTime ? existingRecord.checkInTime.toISOString() : null,
          checkOutTime: null,
          durationMinutes: existingRecord.durationMinutes || 0,
          message: "Marked as incomplete checkout by daily cutoff job.",
        });
      }
    } else if (!approvedWfh && !approvedLeave) {
      // No check-in punch, no approved WFH, and no approved leave -> Mark as ABSENT
      // Concurrency-safe atomic upsert with $setOnInsert guarantees idempotency
      const result = await AttendanceRecord.updateOne(
        { employee: emp._id, dateKey },
        {
          $setOnInsert: {
            employee: emp._id,
            employeeId: emp.employeeId,
            department: emp.department,
            dateKey,
            checkInTime: null,
            checkOutTime: null,
            durationMinutes: 0,
            status: AttendanceStatus.ABSENT,
            isLate: false,
            lateMinutes: 0,
            isWfh: false,
            isMissingCheckout: false,
            isManuallyCorrected: false,
            systemNotes: "System automated absence evaluation",
            policyId: policy._id,
            policyVersion: policy.version,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        absenteesMarked++;

        eventEmitterService.emitAttendanceUpdated({
          recordId: result.upsertedId ? result.upsertedId.toString() : "",
          employeeId: emp.employeeId,
          dateKey,
          punchType: "ABSENT",
          status: AttendanceStatus.ABSENT,
          isLate: false,
          lateMinutes: 0,
          timestamp: new Date().toISOString(),
          checkInTime: null,
          checkOutTime: null,
          durationMinutes: 0,
          message: "Marked absent by daily cutoff job.",
        });
      }
    }
  }

  return {
    evaluatedDateKey: dateKey,
    absenteesMarked,
    incompleteMarked,
    skipped: false,
    message: `Absence evaluation completed for ${dateKey}. Marked ${absenteesMarked} absentee(s) and ${incompleteMarked} incomplete checkout(s).`,
  };
}
