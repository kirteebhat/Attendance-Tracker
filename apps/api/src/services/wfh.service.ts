import { Types } from "mongoose";
import {
  WfhRequest,
  IWfhRequest,
  Employee,
  AttendanceRecord,
  AuditEvent,
} from "../models";
import { policyService } from "./policy.service";
import { calendarService } from "./calendar.service";
import { eventEmitterService } from "./eventEmitter.service";
import { AppError } from "../utils/AppError";
import {
  ApiErrorCode,
  WfhStatus,
  AttendanceStatus,
  WorkType,
  getDateKey,
  addDaysToDateKey,
  WfhFilterQuery,
} from "@vorldx/shared";

export interface WfhEligibilityResult {
  isEligible: boolean;
  employeeId: string;
  department: string;
  workType: string;
  monthlyQuota: number;
  usedDays: number;
  remainingQuota: number;
  advanceNoticeDays: number;
  allowedDaysPerWeek: number;
  rules: string;
  reasons: string[];
}

export interface WfhListResult {
  success: boolean;
  data: IWfhRequest[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Resolves an active employee document from the auth context userId
 */
async function resolveEmployee(userId: string) {
  const employee = await Employee.findOne({
    $or: [
      { userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null },
      { _id: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null },
    ],
  });
  return employee;
}

/**
 * Checks employee WFH eligibility based on active status, work type, and monthly quota
 */
export async function checkWfhEligibility(userId: string): Promise<WfhEligibilityResult> {
  const employee = await resolveEmployee(userId);
  if (!employee) {
    throw new AppError(404, ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND, "Employee profile not found.");
  }

  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  const now = new Date();
  const currentMonth = getDateKey(now, timezone).slice(0, 7); // YYYY-MM

  const monthlyQuota = policy.wfhRules?.monthlyQuota ?? policy.monthlyWfhQuota ?? 4;
  const advanceNoticeDays = policy.wfhRules?.advanceNoticeDays ?? 1;
  const allowedDaysPerWeek = policy.wfhRules?.allowedDaysPerWeek ?? 2;

  // Count approved WFH requests for this employee in the current month
  const usedDays = await WfhRequest.countDocuments({
    employee: employee._id,
    status: WfhStatus.APPROVED,
    dateKey: new RegExp(`^${currentMonth}`),
  });

  const remainingQuota = Math.max(0, monthlyQuota - usedDays);
  const reasons: string[] = [];

  if (!employee.isActive) {
    reasons.push("Employee account is currently inactive.");
  }

  if (employee.workType === WorkType.INTERN) {
    reasons.push("Interns are not eligible for Work From Home under organizational policy.");
  }

  if (remainingQuota <= 0) {
    reasons.push(`Monthly Work From Home quota of ${monthlyQuota} days has been reached.`);
  }

  const isEligible = reasons.length === 0;

  return {
    isEligible,
    employeeId: employee.employeeId,
    department: employee.department,
    workType: employee.workType,
    monthlyQuota,
    usedDays,
    remainingQuota,
    advanceNoticeDays,
    allowedDaysPerWeek,
    rules: `Requests require at least ${advanceNoticeDays} day(s) advance notice. Monthly quota is ${monthlyQuota} days.`,
    reasons,
  };
}

/**
 * Creates a new WFH request for an employee:
 * - Validates duplicate requests on the same date
 * - Validates advance notice and prevents past dates
 * - Validates weekends and official company holidays
 * - Validates conflicts with existing office check-in sessions
 * - Validates monthly quota limit
 */
export async function createWfhRequest(
  userId: string,
  data: { dateKey: string; reason: string },
  simulatedNow?: Date
): Promise<IWfhRequest> {
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

  if (employee.workType === WorkType.INTERN) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_WFH_INELIGIBLE,
      "Interns are not eligible for Work From Home under organizational policy."
    );
  }

  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  const now = simulatedNow || new Date();
  const todayDateKey = getDateKey(now, timezone);

  // 1. Prevent past dates
  if (data.dateKey < todayDateKey) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_WFH_INELIGIBLE,
      "Cannot submit WFH request for past dates."
    );
  }

  // 2. Enforce advance notice days
  const advanceNoticeDays = policy.wfhRules?.advanceNoticeDays ?? 1;
  if (advanceNoticeDays > 0) {
    const earliestAllowed = addDaysToDateKey(todayDateKey, advanceNoticeDays);
    if (data.dateKey < earliestAllowed) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_WFH_INELIGIBLE,
        `WFH requests require at least ${advanceNoticeDays} day(s) advance notice.`
      );
    }
  }

  // 3. Prevent requesting on non-workdays, weekly-offs, or company holidays via unified CalendarService
  const dayType = await calendarService.getDayType(data.dateKey, timezone, policy.workdays);
  if (dayType !== "workday") {
    throw new AppError(
      400,
      ApiErrorCode.ERR_NON_WORKING_DAY,
      "Today is a non-working weekend or company holiday. Office attendance is not required."
    );
  }

  // 5. Conflict with existing office check-in sessions
  const existingAttendance = await AttendanceRecord.findOne({
    employee: employee._id,
    dateKey: data.dateKey,
  });

  if (existingAttendance) {
    if (existingAttendance.checkInTime) {
      if (existingAttendance.checkOutTime) {
        throw new AppError(
          400,
          ApiErrorCode.ERR_WFH_ALREADY_WORKED,
          "Cannot submit WFH request for a date where an office attendance record is already completed."
        );
      } else {
        throw new AppError(
          400,
          ApiErrorCode.ERR_WFH_CURRENTLY_IN_OFFICE,
          "Cannot apply for Work From Home while currently punched in at the office."
        );
      }
    }
    if (existingAttendance.status === AttendanceStatus.WFH_APPROVED) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ALREADY_WFH_APPROVED,
        "Attendance already recorded as Work From Home for today. Contact HR if you wish to revoke WFH."
      );
    }
  }

  // 6. Check monthly quota
  const targetMonth = data.dateKey.slice(0, 7);
  const monthlyQuota = policy.wfhRules?.monthlyQuota ?? policy.monthlyWfhQuota ?? 4;
  const approvedThisMonth = await WfhRequest.countDocuments({
    employee: employee._id,
    status: WfhStatus.APPROVED,
    dateKey: new RegExp(`^${targetMonth}`),
  });

  if (approvedThisMonth >= monthlyQuota) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_QUOTA_EXCEEDED,
      `Monthly Work From Home quota of ${monthlyQuota} days has been reached.`
    );
  }

  // 7. Check for duplicate pending or approved requests
  const existingRequest = await WfhRequest.findOne({
    employee: employee._id,
    dateKey: data.dateKey,
  });

  if (existingRequest) {
    if (
      existingRequest.status === WfhStatus.PENDING ||
      existingRequest.status === WfhStatus.APPROVED
    ) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_DUPLICATE_WFH_REQUEST,
        "A WFH request for this date already exists."
      );
    }

    // If previously rejected or cancelled, allow re-submitting by updating the record
    existingRequest.reason = data.reason.trim();
    existingRequest.status = WfhStatus.PENDING;
    existingRequest.reviewedBy = undefined;
    existingRequest.reviewerRemarks = undefined;
    existingRequest.reviewedAt = undefined;
    await existingRequest.save();

    await AuditEvent.create({
      entityType: "WFH_REQUEST",
      entityId: existingRequest._id.toString(),
      performedBy: employee.userId || null,
      performedByEmployeeId: employee.employeeId,
      action: "RESUBMIT",
      previousValue: { status: existingRequest.status },
      newValue: { status: WfhStatus.PENDING, reason: data.reason },
      reason: "Employee resubmitted WFH request",
      timestamp: new Date(),
      metadata: { dateKey: data.dateKey, actorRole: "EMPLOYEE" },
    });

    eventEmitterService.emitWfhCreated({
      requestId: existingRequest._id.toString(),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      dateKey: existingRequest.dateKey,
      reason: existingRequest.reason,
      status: existingRequest.status,
      createdAt: (existingRequest.createdAt || new Date()).toISOString(),
    });

    return existingRequest;
  }

  // 8. Create new WFH Request document
  const wfh = await WfhRequest.create({
    employee: employee._id,
    employeeId: employee.employeeId,
    department: employee.department,
    dateKey: data.dateKey,
    reason: data.reason.trim(),
    status: WfhStatus.PENDING,
  });

  await AuditEvent.create({
    entityType: "WFH_REQUEST",
    entityId: wfh._id.toString(),
    performedBy: employee.userId || null,
    performedByEmployeeId: employee.employeeId,
    action: "CREATE",
    newValue: {
      status: wfh.status,
      dateKey: wfh.dateKey,
      reason: wfh.reason,
    },
    reason: "Employee submitted WFH request",
    timestamp: new Date(),
    metadata: { dateKey: data.dateKey, actorRole: "EMPLOYEE" },
  });

  eventEmitterService.emitWfhCreated({
    requestId: wfh._id.toString(),
    employeeId: employee.employeeId,
    employeeName: employee.name,
    department: employee.department,
    dateKey: wfh.dateKey,
    reason: wfh.reason,
    status: wfh.status,
    createdAt: (wfh.createdAt || new Date()).toISOString(),
  });

  return wfh;
}

/**
 * Lists the authenticated employee's own WFH requests
 */
export async function listMyWfhRequests(
  userId: string,
  query: {
    status?: string;
    month?: string;
    page?: number;
    limit?: number;
  }
): Promise<WfhListResult> {
  const employee = await resolveEmployee(userId);
  if (!employee) {
    throw new AppError(404, ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND, "Employee profile not found.");
  }

  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { employee: employee._id };

  if (query.status && query.status !== "ALL") {
    filter.status = query.status;
  }

  if (query.month) {
    filter.dateKey = new RegExp(`^${query.month}`);
  }

  const [requests, total] = await Promise.all([
    WfhRequest.find(filter).sort({ dateKey: -1 }).skip(skip).limit(limit),
    WfhRequest.countDocuments(filter),
  ]);

  return {
    success: true,
    data: requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Cancels a pending WFH request by the employee
 */
export async function cancelWfhRequest(userId: string, requestId: string): Promise<IWfhRequest> {
  const employee = await resolveEmployee(userId);
  if (!employee) {
    throw new AppError(404, ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND, "Employee profile not found.");
  }

  const query = Types.ObjectId.isValid(requestId)
    ? { _id: new Types.ObjectId(requestId), employee: employee._id }
    : null;

  if (!query) {
    throw new AppError(400, ApiErrorCode.ERR_BAD_REQUEST, "Invalid request ID format.");
  }

  const existing = await WfhRequest.findOne(query);
  if (!existing) {
    throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, "WFH request not found.");
  }

  if (existing.status !== WfhStatus.PENDING) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_BAD_REQUEST,
      "Only pending WFH requests can be cancelled."
    );
  }

  // Atomic state transition from PENDING to CANCELLED
  const cancelled = await WfhRequest.findOneAndUpdate(
    { _id: existing._id, status: WfhStatus.PENDING },
    { $set: { status: WfhStatus.CANCELLED } },
    { new: true }
  );

  if (!cancelled) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_BAD_REQUEST,
      "Request is no longer pending or was already decided."
    );
  }

  await AuditEvent.create({
    entityType: "WFH_REQUEST",
    entityId: cancelled._id.toString(),
    performedBy: employee.userId || null,
    performedByEmployeeId: employee.employeeId,
    action: "CANCEL",
    previousValue: { status: WfhStatus.PENDING },
    newValue: { status: WfhStatus.CANCELLED },
    reason: "Employee cancelled WFH request",
    timestamp: new Date(),
    metadata: { actorRole: "EMPLOYEE" },
  });

  return cancelled;
}

/**
 * Lists all WFH requests with filters and pagination (HR / Admin only)
 */
export async function listAllWfhRequests(query: WfhFilterQuery): Promise<WfhListResult> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (query.status && query.status !== "ALL") {
    filter.status = query.status;
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.month) {
    filter.dateKey = new RegExp(`^${query.month}`);
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search, "i");
    filter.$or = [
      { employeeId: searchRegex },
      { department: searchRegex },
      { reason: searchRegex },
    ];
  }

  const [requests, total] = await Promise.all([
    WfhRequest.find(filter)
      .populate("employee", "name email department designation")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WfhRequest.countDocuments(filter),
  ]);

  return {
    success: true,
    data: requests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Reviews a WFH request (Approve or Reject) by HR/Admin:
 * - Atomic status update: guarantees a request can only be decided once (concurrency guarded)
 * - Records deciding admin and exact review timestamp
 * - On APPROVAL: automatically applies WFH attendance treatment to attendance_records (credits 480 mins)
 * - Audits the decision in AuditEvent
 */
export async function reviewWfhRequest(
  requestId: string,
  review: {
    status: WfhStatus.APPROVED | WfhStatus.REJECTED;
    remarks?: string;
  },
  actor: {
    userId: string;
    employeeId?: string;
    role?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  request: IWfhRequest;
}> {
  if (!Types.ObjectId.isValid(requestId)) {
    throw new AppError(400, ApiErrorCode.ERR_BAD_REQUEST, "Invalid WFH request ID format.");
  }

  const adminUserId = new Types.ObjectId(actor.userId);
  const now = new Date();

  // ATOMIC DECISION: Only transition from PENDING -> double decisions are prevented
  const updatedRequest = await WfhRequest.findOneAndUpdate(
    { _id: new Types.ObjectId(requestId), status: WfhStatus.PENDING },
    {
      $set: {
        status: review.status,
        reviewedBy: adminUserId,
        reviewerRemarks: review.remarks?.trim() || null,
        reviewedAt: now,
      },
    },
    { new: true }
  );

  if (!updatedRequest) {
    // Check if the request exists to give a clear error message
    const existing = await WfhRequest.findById(requestId);
    if (!existing) {
      throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, "WFH request not found.");
    }
    throw new AppError(
      409,
      ApiErrorCode.ERR_BAD_REQUEST,
      `WFH request has already been decided (${existing.status}). Double review is prohibited.`
    );
  }

  const policy = await policyService.getActivePolicy();

  // If APPROVED, apply WFH attendance treatment directly to attendance_records
  if (review.status === WfhStatus.APPROVED) {
    const fullDayMinutes = (policy.minFullDayHours || 8) * 60; // 480 minutes

    await AttendanceRecord.findOneAndUpdate(
      { employee: updatedRequest.employee, dateKey: updatedRequest.dateKey },
      {
        $set: {
          status: AttendanceStatus.WFH_APPROVED,
          isWfh: true,
          durationMinutes: fullDayMinutes,
          systemNotes: `Auto-credited via approved WFH request. Reviewer remarks: ${updatedRequest.reviewerRemarks || "Approved"}`,
          policyId: policy._id,
          policyVersion: policy.version,
        },
        $setOnInsert: {
          employee: updatedRequest.employee,
          employeeId: updatedRequest.employeeId,
          department: updatedRequest.department,
          dateKey: updatedRequest.dateKey,
          checkInTime: null,
          checkOutTime: null,
          isLate: false,
          lateMinutes: 0,
          isMissingCheckout: false,
          isManuallyCorrected: false,
        },
      },
      { upsert: true, new: true }
    );
  }

  // Audit the administrative review decision
  await AuditEvent.create({
    entityType: "WFH_REQUEST",
    entityId: updatedRequest._id.toString(),
    performedBy: adminUserId,
    performedByEmployeeId: actor.employeeId || null,
    action: "UPDATE",
    previousValue: { status: WfhStatus.PENDING },
    newValue: {
      status: updatedRequest.status,
      reviewedBy: actor.userId,
      reviewerRemarks: updatedRequest.reviewerRemarks,
      reviewedAt: updatedRequest.reviewedAt,
    },
    reason: review.remarks || `WFH request ${review.status.toLowerCase()} by HR`,
    timestamp: now,
    metadata: { actorRole: actor.role || "ADMIN" },
  });

  // Emit real-time socket events only after DB operations succeed
  eventEmitterService.emitWfhDecided({
    requestId: updatedRequest._id.toString(),
    employeeId: updatedRequest.employeeId,
    department: updatedRequest.department,
    dateKey: updatedRequest.dateKey,
    status: updatedRequest.status,
    reviewedBy: actor.employeeId || actor.userId,
    reviewerRemarks: updatedRequest.reviewerRemarks,
    reviewedAt: now.toISOString(),
  });

  if (review.status === WfhStatus.APPROVED) {
    eventEmitterService.emitAttendanceUpdated({
      recordId: updatedRequest._id.toString(),
      employeeId: updatedRequest.employeeId,
      department: updatedRequest.department,
      dateKey: updatedRequest.dateKey,
      punchType: "WFH_AUTO_CREDIT",
      status: AttendanceStatus.WFH_APPROVED,
      isLate: false,
      lateMinutes: 0,
      timestamp: now.toISOString(),
      checkInTime: null,
      checkOutTime: null,
      durationMinutes: 480,
      message: "Attendance credited for approved Work From Home.",
    });
  }

  return {
    success: true,
    message:
      review.status === WfhStatus.APPROVED
        ? "WFH request approved. Attendance record credited."
        : "WFH request rejected.",
    request: updatedRequest,
  };
}
