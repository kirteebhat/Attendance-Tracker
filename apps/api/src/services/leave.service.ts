import { Types } from "mongoose";
import {
  LeaveType,
  ILeaveType,
  LeaveBalance,
  ILeaveBalance,
  LeaveRequest,
  ILeaveRequest,
  Employee,
  IEmployee,
  AttendanceRecord,
  WfhRequest,
  Notification,
  AuditEvent,
  User,
} from "../models";
import { calendarService } from "./calendar.service";
import { policyService } from "./policy.service";
import { eventEmitterService } from "./eventEmitter.service";
import { AppError } from "../utils/AppError";
import {
  ApiErrorCode,
  AttendanceStatus,
  WfhStatus,
  addDaysToDateKey,
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  CreateLeaveRequestInput,
  DecideLeaveRequestInput,
  AdjustLeaveBalanceInput,
  CarryForwardBalanceInput,
  LeaveFilterQuery,
} from "@vorldx/shared";
import { logger } from "../utils/logger";

export interface LeaveRequestListResult {
  success: boolean;
  data: ILeaveRequest[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BulkDecisionResult {
  total: number;
  successful: Array<{
    requestId: string;
    employeeId: string;
    status: string;
  }>;
  failed: Array<{
    requestId: string;
    reason: string;
    code: string;
  }>;
}

export class LeaveService {
  /**
   * Helper: Resolves an employee document from a User ID or Employee ID
   */
  public async resolveEmployee(identifier: string): Promise<IEmployee | null> {
    if (Types.ObjectId.isValid(identifier)) {
      const byUser = await Employee.findOne({ userId: new Types.ObjectId(identifier) });
      if (byUser) return byUser;
      const byId = await Employee.findById(identifier);
      if (byId) return byId;
    }
    return Employee.findOne({ employeeId: identifier.trim().toUpperCase() });
  }

  // ============================================================================
  // LEAVE TYPE MANAGEMENT (HR / ADMIN)
  // ============================================================================

  /**
   * Creates a new Leave Type configuration with annual quota and carry-forward rules
   */
  public async createLeaveType(
    data: CreateLeaveTypeInput,
    actor?: { userId?: string; employeeId?: string }
  ): Promise<ILeaveType> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();

    const existingCode = await LeaveType.findOne({ code });
    if (existingCode) {
      throw AppError.conflict(
        `Leave type with code '${code}' already exists.`,
        ApiErrorCode.ERR_BAD_REQUEST
      );
    }

    const existingName = await LeaveType.findOne({ name });
    if (existingName) {
      throw AppError.conflict(
        `Leave type with name '${name}' already exists.`,
        ApiErrorCode.ERR_BAD_REQUEST
      );
    }

    const leaveType = await LeaveType.create({
      name,
      code,
      paid: data.paid ?? true,
      annualQuota: data.annualQuota ?? 12,
      carryForwardRule: {
        allowed: data.carryForwardRule?.allowed ?? false,
        maxDays: data.carryForwardRule?.maxDays ?? 0,
        expiryMonths: data.carryForwardRule?.expiryMonths,
      },
      halfDayAllowed: data.halfDayAllowed ?? true,
      description: data.description?.trim(),
      isActive: data.isActive ?? true,
    });

    await AuditEvent.create({
      entityType: "LEAVE_TYPE",
      entityId: leaveType._id.toString(),
      action: "LEAVE_TYPE_CREATE",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      newValue: leaveType.toObject(),
      timestamp: new Date(),
    });

    logger.info(`[LeaveService] Created leave type: ${name} (${code})`);
    return leaveType;
  }

  /**
   * Lists leave types (optionally filtered by active status)
   */
  public async listLeaveTypes(includeInactive = false): Promise<ILeaveType[]> {
    const filter = includeInactive ? {} : { isActive: true };
    return LeaveType.find(filter).sort({ name: 1 });
  }

  /**
   * Retrieves single leave type by ID
   */
  public async getLeaveTypeById(id: string): Promise<ILeaveType> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid leave type ID format.", ApiErrorCode.ERR_INVALID_INPUT);
    }
    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      throw AppError.notFound("Leave type not found.", ApiErrorCode.ERR_NOT_FOUND);
    }
    return leaveType;
  }

  /**
   * Updates an existing leave type
   */
  public async updateLeaveType(
    id: string,
    data: UpdateLeaveTypeInput,
    actor?: { userId?: string; employeeId?: string }
  ): Promise<ILeaveType> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid leave type ID format.", ApiErrorCode.ERR_INVALID_INPUT);
    }

    const existing = await LeaveType.findById(id);
    if (!existing) {
      throw AppError.notFound("Leave type not found.", ApiErrorCode.ERR_NOT_FOUND);
    }

    if (data.code && data.code.toUpperCase() !== existing.code) {
      const codeTaken = await LeaveType.findOne({
        code: data.code.toUpperCase(),
        _id: { $ne: existing._id },
      });
      if (codeTaken) {
        throw AppError.conflict(
          `Leave type with code '${data.code.toUpperCase()}' already exists.`,
          ApiErrorCode.ERR_BAD_REQUEST
        );
      }
    }

    if (data.name && data.name !== existing.name) {
      const nameTaken = await LeaveType.findOne({
        name: data.name,
        _id: { $ne: existing._id },
      });
      if (nameTaken) {
        throw AppError.conflict(
          `Leave type with name '${data.name}' already exists.`,
          ApiErrorCode.ERR_BAD_REQUEST
        );
      }
    }

    const previousValue = existing.toObject();

    if (data.name !== undefined) existing.name = data.name.trim();
    if (data.code !== undefined) existing.code = data.code.trim().toUpperCase();
    if (data.paid !== undefined) existing.paid = data.paid;
    if (data.annualQuota !== undefined) existing.annualQuota = data.annualQuota;
    if (data.carryForwardRule !== undefined) {
      existing.carryForwardRule = {
        allowed: data.carryForwardRule.allowed ?? existing.carryForwardRule.allowed,
        maxDays: data.carryForwardRule.maxDays ?? existing.carryForwardRule.maxDays,
        expiryMonths: data.carryForwardRule.expiryMonths,
      };
    }
    if (data.halfDayAllowed !== undefined) existing.halfDayAllowed = data.halfDayAllowed;
    if (data.description !== undefined) existing.description = data.description?.trim();
    if (data.isActive !== undefined) existing.isActive = data.isActive;

    await existing.save();

    await AuditEvent.create({
      entityType: "LEAVE_TYPE",
      entityId: existing._id.toString(),
      action: "LEAVE_TYPE_UPDATE",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      previousValue,
      newValue: existing.toObject(),
      timestamp: new Date(),
    });

    return existing;
  }

  /**
   * Deactivates (soft deletes) a leave type
   */
  public async deleteLeaveType(
    id: string,
    actor?: { userId?: string; employeeId?: string }
  ): Promise<ILeaveType> {
    return this.updateLeaveType(id, { isActive: false }, actor);
  }

  // ============================================================================
  // LEAVE BALANCES & CARRY-FORWARD
  // ============================================================================

  /**
   * Retrieves or auto-initializes leave balances for an employee in a given year.
   * Ensures active leave types are populated and calculates the live available balance.
   */
  public async getEmployeeBalances(
    employeeIdentifier: string,
    targetYear?: number
  ): Promise<{
    employee: { id: string; employeeId: string; name: string };
    year: number;
    balances: Array<{
      id: string;
      type: { id: string; name: string; code: string; paid: boolean };
      allotted: number;
      used: number;
      pending: number;
      carriedOver: number;
      available: number;
    }>;
  }> {
    const employee = await this.resolveEmployee(employeeIdentifier);
    if (!employee) {
      throw AppError.notFound("Employee profile not found.", ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND);
    }

    const year = targetYear || new Date().getFullYear();
    const activeTypes = await LeaveType.find({ isActive: true });

    // Seed any missing balance records for active leave types
    for (const lt of activeTypes) {
      const existing = await LeaveBalance.findOne({
        employee: employee._id,
        type: lt._id,
        year,
      });

      if (!existing) {
        await LeaveBalance.create({
          employee: employee._id,
          type: lt._id,
          year,
          allotted: lt.annualQuota,
          used: 0,
          pending: 0,
          carriedOver: 0,
        }).catch((err: any) => {
          // Handle rare race conditions idempotently
          if (err.code !== 11000) throw err;
        });
      }
    }

    const balances = await LeaveBalance.find({
      employee: employee._id,
      year,
    }).populate("type");

    return {
      employee: {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
      },
      year,
      balances: balances
        .filter((b) => b.type != null)
        .map((b) => {
          const lt = b.type as unknown as ILeaveType;
          const available = Math.max(
            0,
            (b.allotted || 0) + (b.carriedOver || 0) - ((b.used || 0) + (b.pending || 0))
          );

          return {
            id: b._id.toString(),
            type: {
              id: lt._id.toString(),
              name: lt.name,
              code: lt.code,
              paid: lt.paid,
            },
            allotted: b.allotted,
            used: b.used,
            pending: b.pending,
            carriedOver: b.carriedOver,
            available,
          };
        }),
    };
  }

  /**
   * Lists leave balances across employees (HR view) with multi-criteria filtering
   */
  public async listAllBalances(query: {
    year?: number;
    department?: string;
    employeeId?: string;
    page?: number;
    limit?: number;
  }) {
    const year = query.year || new Date().getFullYear();
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const empFilter: Record<string, unknown> = { isActive: true };
    if (query.department) empFilter.department = query.department;
    if (query.employeeId) empFilter.employeeId = query.employeeId.toUpperCase();

    const [employees, total] = await Promise.all([
      Employee.find(empFilter).sort({ employeeId: 1 }).skip(skip).limit(limit),
      Employee.countDocuments(empFilter),
    ]);

    const results = [];
    for (const emp of employees) {
      const empData = await this.getEmployeeBalances(emp._id.toString(), year);
      results.push({
        employee: {
          id: emp._id.toString(),
          employeeId: emp.employeeId,
          name: emp.name,
          department: emp.department,
          designation: emp.designation,
        },
        year,
        balances: empData.balances,
      });
    }

    return {
      success: true,
      data: results,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Manually adjusts an employee's leave balance with full audit tracking
   */
  public async adjustBalance(
    input: AdjustLeaveBalanceInput,
    actor?: { userId?: string; employeeId?: string }
  ): Promise<ILeaveBalance> {
    const employee = await this.resolveEmployee(input.employeeId);
    if (!employee) {
      throw AppError.notFound("Employee profile not found.", ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND);
    }

    const leaveType = await this.getLeaveTypeById(input.typeId);
    const year = input.year || new Date().getFullYear();

    let balance = await LeaveBalance.findOne({
      employee: employee._id,
      type: leaveType._id,
      year,
    });

    if (!balance) {
      balance = await LeaveBalance.create({
        employee: employee._id,
        type: leaveType._id,
        year,
        allotted: leaveType.annualQuota,
        used: 0,
        pending: 0,
        carriedOver: 0,
      });
    }

    const previousValue = balance.toObject();

    if (input.allotted !== undefined) balance.allotted = input.allotted;
    if (input.carriedOver !== undefined) balance.carriedOver = input.carriedOver;

    await balance.save();

    await AuditEvent.create({
      entityType: "LEAVE_BALANCE",
      entityId: balance._id.toString(),
      action: "LEAVE_BALANCE_ADJUST",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      previousValue,
      newValue: balance.toObject(),
      reason: input.reason,
      timestamp: new Date(),
    });

    eventEmitterService.emitLeaveBalanceUpdated({
      employeeId: employee.employeeId,
      typeId: leaveType._id.toString(),
      year,
      allotted: balance.allotted,
      carriedOver: balance.carriedOver,
      used: balance.used,
      pending: balance.pending,
    });

    return balance;
  }

  /**
   * Executes year-end carry-forward rollover for eligible leave types
   */
  public async carryForwardBalances(
    input: CarryForwardBalanceInput,
    actor?: { userId?: string; employeeId?: string }
  ): Promise<{
    processedCount: number;
    details: Array<{ employeeId: string; type: string; carriedDays: number }>;
  }> {
    const { fromYear, toYear } = input;
    if (fromYear >= toYear) {
      throw AppError.badRequest(
        "fromYear must be strictly less than toYear.",
        ApiErrorCode.ERR_INVALID_INPUT
      );
    }

    const eligibleTypes = await LeaveType.find({
      isActive: true,
      "carryForwardRule.allowed": true,
    });

    const empFilter: Record<string, unknown> = { isActive: true };
    if (input.employeeId) {
      const targetEmp = await this.resolveEmployee(input.employeeId);
      if (!targetEmp) {
        throw AppError.notFound("Employee not found.", ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND);
      }
      empFilter._id = targetEmp._id;
    }

    const employees = await Employee.find(empFilter);
    const details: Array<{ employeeId: string; type: string; carriedDays: number }> = [];

    for (const emp of employees) {
      for (const lt of eligibleTypes) {
        const fromBalance = await LeaveBalance.findOne({
          employee: emp._id,
          type: lt._id,
          year: fromYear,
        });

        if (!fromBalance) continue;

        const unused = Math.max(
          0,
          (fromBalance.allotted || 0) + (fromBalance.carriedOver || 0) - (fromBalance.used || 0)
        );

        if (unused <= 0) continue;

        const maxAllowed = lt.carryForwardRule.maxDays ?? 0;
        const carriedDays = Math.min(unused, maxAllowed);

        if (carriedDays <= 0) continue;

        let toBalance = await LeaveBalance.findOne({
          employee: emp._id,
          type: lt._id,
          year: toYear,
        });

        if (!toBalance) {
          toBalance = await LeaveBalance.create({
            employee: emp._id,
            type: lt._id,
            year: toYear,
            allotted: lt.annualQuota,
            used: 0,
            pending: 0,
            carriedOver: carriedDays,
          });
        } else {
          toBalance.carriedOver = carriedDays;
          await toBalance.save();
        }

        details.push({
          employeeId: emp.employeeId,
          type: lt.code,
          carriedDays,
        });
      }
    }

    await AuditEvent.create({
      entityType: "LEAVE_BALANCE",
      entityId: `carry-forward-${fromYear}-${toYear}`,
      action: "LEAVE_CARRY_FORWARD",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      metadata: { fromYear, toYear, processedCount: details.length },
      timestamp: new Date(),
    });

    return { processedCount: details.length, details };
  }

  // ============================================================================
  // LEAVE APPLICATION & CANCELLATION (EMPLOYEE)
  // ============================================================================

  /**
   * Applies for employee leave with robust multi-layer validation:
   * - Balance sufficiency check
   * - Unified Calendar working days calculation (excluding weekends/public holidays/company off-days)
   * - Half-day verification
   * - Overlap with existing pending/approved leave
   * - Conflict with approved WFH
   * - Past date & advance notice rules from policy
   */
  public async applyLeave(
    userId: string,
    input: CreateLeaveRequestInput,
    simulatedNow?: Date
  ): Promise<ILeaveRequest> {
    const employee = await this.resolveEmployee(userId);
    if (!employee) {
      throw AppError.notFound("Employee profile not found.", ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND);
    }

    if (!employee.isActive) {
      throw AppError.forbidden(
        "Your employee account is inactive. Please contact HR.",
        ApiErrorCode.ERR_EMPLOYEE_INACTIVE
      );
    }

    // Resolve Leave Type
    let leaveType: ILeaveType | null = null;
    if (Types.ObjectId.isValid(input.type)) {
      leaveType = await LeaveType.findById(input.type);
    }
    if (!leaveType) {
      leaveType = await LeaveType.findOne({ code: input.type.toUpperCase() });
    }

    if (!leaveType) {
      throw AppError.notFound(
        `Leave type '${input.type}' does not exist.`,
        ApiErrorCode.ERR_NOT_FOUND
      );
    }

    if (!leaveType.isActive) {
      throw AppError.badRequest(
        `Leave type '${leaveType.name}' is currently disabled.`,
        ApiErrorCode.ERR_LEAVE_TYPE_DISABLED
      );
    }

    const policy = await policyService.getActivePolicy();
    const tz = policy.timezone || "Asia/Kolkata";
    const now = simulatedNow || new Date();
    const todayKey = calendarService.toDateKey(now, tz);

    const startKey = input.startDate.trim();
    const endKey = input.endDate.trim();

    if (startKey > endKey) {
      throw AppError.badRequest(
        "Start date cannot be after end date.",
        ApiErrorCode.ERR_INVALID_INPUT
      );
    }

    // Past-date rule validation: cannot apply for past dates
    if (startKey < todayKey) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_LEAVE_PAST_DATE,
        `Cannot apply for leave on past date (${startKey}). Today is ${todayKey}.`
      );
    }

    // Half-day validation
    if (input.isHalfDay) {
      if (!leaveType.halfDayAllowed) {
        throw new AppError(
          400,
          ApiErrorCode.ERR_HALF_DAY_NOT_ALLOWED,
          `Half-day leave is not permitted for leave type '${leaveType.name}'.`
        );
      }
      if (startKey !== endKey) {
        throw AppError.badRequest(
          "Half-day leave can only be applied for a single day.",
          ApiErrorCode.ERR_INVALID_INPUT
        );
      }
      if (!input.halfDayType || !["FIRST_HALF", "SECOND_HALF"].includes(input.halfDayType)) {
        throw AppError.badRequest(
          "halfDayType must be specified as 'FIRST_HALF' or 'SECOND_HALF' for half-day requests.",
          ApiErrorCode.ERR_INVALID_INPUT
        );
      }
    }

    // Working days calculation using Unified Calendar Service
    let workingDays = 0;
    if (input.isHalfDay) {
      const dayType = await calendarService.getDayType(startKey, tz, policy.workdays);
      if (dayType !== "workday") {
        throw new AppError(
          400,
          ApiErrorCode.ERR_NON_WORKING_DAY,
          `Selected date (${startKey}) is a non-working ${dayType}. Half-day leave cannot be booked.`
        );
      }
      workingDays = 0.5;
    } else {
      workingDays = await calendarService.countWorkingDays(startKey, endKey, tz, policy.workdays);
      if (workingDays === 0) {
        throw new AppError(
          400,
          ApiErrorCode.ERR_NO_WORKING_DAYS,
          `The selected date range (${startKey} to ${endKey}) contains 0 working days (all days are weekends or official holidays).`
        );
      }
    }

    // Parse start and end timestamps (ISO midnight UTC equivalent of local date)
    const startDateObj = new Date(`${startKey}T00:00:00.000Z`);
    const endDateObj = new Date(`${endKey}T23:59:59.999Z`);

    // Check for Overlapping Leave Requests (PENDING or APPROVED)
    const conflictingLeave = await LeaveRequest.findOne({
      employee: employee._id,
      status: { $in: ["PENDING", "APPROVED"] },
      $or: [
        { startDate: { $lte: endDateObj }, endDate: { $gte: startDateObj } },
      ],
    }).populate("type");

    if (conflictingLeave) {
      const confType = (conflictingLeave.type as unknown as ILeaveType)?.name || "Leave";
      const confStart = calendarService.toDateKey(conflictingLeave.startDate, tz);
      const confEnd = calendarService.toDateKey(conflictingLeave.endDate, tz);
      throw new AppError(
        409,
        ApiErrorCode.ERR_OVERLAPPING_LEAVE,
        `Leave request conflicts with an existing ${conflictingLeave.status} ${confType} (${confStart} to ${confEnd}).`
      );
    }

    // Check for Conflicts with Approved WFH
    const conflictingWfh = await WfhRequest.findOne({
      employee: employee._id,
      status: WfhStatus.APPROVED,
      dateKey: { $gte: startKey, $lte: endKey },
    });

    if (conflictingWfh) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_LEAVE_CONFLICT_WFH,
        `Conflict: You already have an approved Work From Home (WFH) day scheduled on ${conflictingWfh.dateKey}. Please cancel your WFH request before applying for leave.`
      );
    }

    // Balance Sufficiency Validation
    const targetYear = parseInt(startKey.substring(0, 4), 10);
    const balanceInfo = await this.getEmployeeBalances(employee._id.toString(), targetYear);
    const specificBalance = balanceInfo.balances.find((b) => b.type.id === leaveType!._id.toString());

    if (!specificBalance) {
      throw AppError.badRequest(
        `No leave quota allocated for '${leaveType.name}' in year ${targetYear}.`,
        ApiErrorCode.ERR_INSUFFICIENT_BALANCE
      );
    }

    if (specificBalance.available < workingDays) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_INSUFFICIENT_BALANCE,
        `Insufficient leave balance for ${leaveType.name}. Required: ${workingDays} day(s), Available: ${specificBalance.available} day(s).`
      );
    }

    // Create the Leave Request
    const leaveRequest = await LeaveRequest.create({
      employee: employee._id,
      type: leaveType._id,
      startDate: startDateObj,
      endDate: endDateObj,
      isHalfDay: input.isHalfDay ?? false,
      halfDayType: input.isHalfDay ? input.halfDayType : undefined,
      workingDays,
      reason: input.reason.trim(),
      status: "PENDING",
    });

    // Atomically reserve the balance by incrementing 'pending'
    await LeaveBalance.findOneAndUpdate(
      { employee: employee._id, type: leaveType._id, year: targetYear },
      { $inc: { pending: workingDays } }
    );

    // Audit Logging
    await AuditEvent.create({
      entityType: "LEAVE_REQUEST",
      entityId: leaveRequest._id.toString(),
      action: "LEAVE_APPLY",
      performedBy: new Types.ObjectId(userId),
      performedByEmployeeId: employee.employeeId,
      newValue: {
        leaveType: leaveType.name,
        startKey,
        endKey,
        workingDays,
        isHalfDay: input.isHalfDay,
      },
      reason: input.reason,
      timestamp: new Date(),
    });

    // Real-time Socket Event Dispatches
    eventEmitterService.emitLeaveRequested({
      requestId: leaveRequest._id.toString(),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      typeName: leaveType.name,
      startDate: startKey,
      endDate: endKey,
      workingDays,
      isHalfDay: leaveRequest.isHalfDay,
      status: "PENDING",
      timestamp: new Date().toISOString(),
    });

    eventEmitterService.emitLeaveBalanceUpdated({
      employeeId: employee.employeeId,
      typeId: leaveType._id.toString(),
      year: targetYear,
      used: specificBalance.used,
      pending: specificBalance.pending + workingDays,
      available: specificBalance.available - workingDays,
    });

    logger.info(
      `[LeaveService] Applied leave for ${employee.employeeId} (${workingDays} days, ${startKey} to ${endKey})`
    );

    return (await leaveRequest.populate(["employee", "type"])) as ILeaveRequest;
  }

  /**
   * Cancels a pending request or future approved request, accurately restoring balance
   */
  public async cancelLeave(
    requestId: string,
    actorUserId: string,
    reason?: string,
    simulatedNow?: Date
  ): Promise<ILeaveRequest> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw AppError.badRequest("Invalid leave request ID format.", ApiErrorCode.ERR_INVALID_INPUT);
    }

    const leaveRequest = await LeaveRequest.findById(requestId).populate(["employee", "type"]);
    if (!leaveRequest) {
      throw AppError.notFound("Leave request not found.", ApiErrorCode.ERR_NOT_FOUND);
    }

    const employee = leaveRequest.employee as unknown as IEmployee;
    const leaveType = leaveRequest.type as unknown as ILeaveType;

    // Authorization: only the applicant employee or HR/Admin can cancel
    const actorUser = await User.findById(actorUserId);
    const isOwner = employee.userId && employee.userId.toString() === actorUserId;
    const isStaff =
      actorUser &&
      ["ADMIN", "HR", "HR_ADMIN"].includes(actorUser.role as string);

    if (!isOwner && !isStaff) {
      throw AppError.forbidden(
        "You are not authorized to cancel this leave request.",
        ApiErrorCode.ERR_FORBIDDEN
      );
    }

    const policy = await policyService.getActivePolicy();
    const tz = policy.timezone || "Asia/Kolkata";
    const now = simulatedNow || new Date();
    const todayKey = calendarService.toDateKey(now, tz);
    const startKey = calendarService.toDateKey(leaveRequest.startDate, tz);
    const endKey = calendarService.toDateKey(leaveRequest.endDate, tz);

    if (leaveRequest.status === "CANCELLED" || leaveRequest.status === "REJECTED") {
      throw new AppError(
        400,
        ApiErrorCode.ERR_LEAVE_CANNOT_CANCEL,
        `Cannot cancel a request that is already ${leaveRequest.status}.`
      );
    }

    // An approved leave can only be cancelled if it has not yet completed
    if (leaveRequest.status === "APPROVED" && endKey < todayKey) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_LEAVE_CANNOT_CANCEL,
        "Cannot cancel an approved leave that occurred in the past."
      );
    }

    const previousStatus = leaveRequest.status;
    const targetYear = parseInt(startKey.substring(0, 4), 10);

    // Atomically transition status
    leaveRequest.status = "CANCELLED";
    leaveRequest.decisionNote = reason?.trim() || leaveRequest.decisionNote;
    await leaveRequest.save();

    // Restore balance accurately based on previous status
    if (previousStatus === "PENDING") {
      await LeaveBalance.findOneAndUpdate(
        { employee: employee._id, type: leaveType._id, year: targetYear },
        { $inc: { pending: -leaveRequest.workingDays } }
      );
    } else if (previousStatus === "APPROVED") {
      await LeaveBalance.findOneAndUpdate(
        { employee: employee._id, type: leaveType._id, year: targetYear },
        { $inc: { used: -leaveRequest.workingDays } }
      );

      // Revert attendance records that were marked ON_LEAVE
      let curr = startKey;
      while (curr <= endKey) {
        await AttendanceRecord.deleteOne({
          employee: employee._id,
          dateKey: curr,
          status: { $in: [AttendanceStatus.ON_LEAVE, AttendanceStatus.HALF_DAY] },
          systemNotes: new RegExp(`Approved Leave: ${leaveType.name}`),
        });
        curr = addDaysToDateKey(curr, 1);
      }
    }

    // Audit Logging
    await AuditEvent.create({
      entityType: "LEAVE_REQUEST",
      entityId: leaveRequest._id.toString(),
      action: "LEAVE_CANCEL",
      performedBy: new Types.ObjectId(actorUserId),
      performedByEmployeeId: employee.employeeId,
      reason: reason || "Cancelled by user",
      previousValue: { status: previousStatus },
      newValue: { status: "CANCELLED" },
      timestamp: new Date(),
    });

    // Create Notification
    await Notification.create({
      user: employee.userId,
      type: "LEAVE_STATUS",
      title: "Leave Request Cancelled",
      message: `Your leave request for ${startKey} to ${endKey} has been cancelled and balances restored.`,
      payload: { requestId: leaveRequest._id.toString(), status: "CANCELLED" },
    }).catch(() => null);

    // Sockets
    eventEmitterService.emitLeaveDecided({
      requestId: leaveRequest._id.toString(),
      employeeId: employee.employeeId,
      status: "CANCELLED",
      workingDays: leaveRequest.workingDays,
      previousStatus,
      timestamp: new Date().toISOString(),
    });

    logger.info(`[LeaveService] Cancelled leave request ${requestId} for ${employee.employeeId}`);
    return leaveRequest;
  }

  // ============================================================================
  // HR / ADMIN QUEUE & DECISION ENGINE
  // ============================================================================

  /**
   * Retrieves leave requests with comprehensive filters and pagination for HR review
   */
  public async listLeaveRequests(query: LeaveFilterQuery): Promise<LeaveRequestListResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.status && query.status !== "ALL") {
      filter.status = query.status;
    }

    if (query.type) {
      if (Types.ObjectId.isValid(query.type)) {
        filter.type = new Types.ObjectId(query.type);
      } else {
        const lt = await LeaveType.findOne({ code: query.type.toUpperCase() });
        if (lt) filter.type = lt._id;
      }
    }

    if (query.startDate && query.endDate) {
      filter.startDate = { $lte: new Date(`${query.endDate}T23:59:59.999Z`) };
      filter.endDate = { $gte: new Date(`${query.startDate}T00:00:00.000Z`) };
    }

    // Employee or Department Search
    if (query.employeeId || query.department || query.search) {
      const empQuery: Record<string, unknown> = {};
      if (query.employeeId) empQuery.employeeId = query.employeeId.toUpperCase();
      if (query.department) empQuery.department = query.department;
      if (query.search && query.search.trim()) {
        const regex = new RegExp(query.search.trim(), "i");
        empQuery.$or = [{ name: regex }, { employeeId: regex }, { department: regex }];
      }

      const matchingEmps = await Employee.find(empQuery).select("_id");
      filter.employee = { $in: matchingEmps.map((e) => e._id) };
    }

    const [requests, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate("employee", "name email employeeId department designation workType")
        .populate("type", "name code paid annualQuota")
        .populate("decidedBy", "email employeeId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(filter),
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
   * Lists an employee's own leave requests
   */
  public async listMyLeaveRequests(
    userId: string,
    query: { status?: string; page?: number; limit?: number }
  ): Promise<LeaveRequestListResult> {
    const employee = await this.resolveEmployee(userId);
    if (!employee) {
      throw AppError.notFound("Employee profile not found.", ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND);
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { employee: employee._id };
    if (query.status && query.status !== "ALL") {
      filter.status = query.status;
    }

    const [requests, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate("type", "name code paid")
        .populate("decidedBy", "email employeeId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(filter),
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
   * Single decision: Approve or Reject a leave request.
   * Enforces strict ATOMIC TRANSITION from 'PENDING' -> Prevents double decisions.
   * If APPROVED: Marks dates as ON_LEAVE in AttendanceRecord; decrements pending, increments used.
   * If REJECTED: Decrements pending (balance restored).
   */
  public async decideLeaveRequest(
    requestId: string,
    decision: DecideLeaveRequestInput,
    actor: { userId: string; employeeId?: string; role?: string }
  ): Promise<ILeaveRequest> {
    if (!Types.ObjectId.isValid(requestId)) {
      throw AppError.badRequest("Invalid leave request ID format.", ApiErrorCode.ERR_INVALID_INPUT);
    }

    const adminUserId = new Types.ObjectId(actor.userId);
    const now = new Date();

    // ATOMIC UPDATE: Only update if current status is PENDING
    const updatedRequest = await LeaveRequest.findOneAndUpdate(
      { _id: new Types.ObjectId(requestId), status: "PENDING" },
      {
        $set: {
          status: decision.status,
          decidedBy: adminUserId,
          decisionNote: decision.decisionNote?.trim() || null,
          decidedAt: now,
        },
      },
      { new: true }
    )
      .populate("employee")
      .populate("type");

    if (!updatedRequest) {
      const existing = await LeaveRequest.findById(requestId);
      if (!existing) {
        throw AppError.notFound("Leave request not found.", ApiErrorCode.ERR_NOT_FOUND);
      }
      throw new AppError(
        409,
        ApiErrorCode.ERR_LEAVE_ALREADY_DECIDED,
        `Leave request has already been decided (${existing.status}). Double decision is prohibited.`
      );
    }

    const employee = updatedRequest.employee as unknown as IEmployee;
    const leaveType = updatedRequest.type as unknown as ILeaveType;

    const policy = await policyService.getActivePolicy();
    const tz = policy.timezone || "Asia/Kolkata";
    const startKey = calendarService.toDateKey(updatedRequest.startDate, tz);
    const endKey = calendarService.toDateKey(updatedRequest.endDate, tz);
    const targetYear = parseInt(startKey.substring(0, 4), 10);

    // Balance reconciliation
    if (decision.status === "APPROVED") {
      await LeaveBalance.findOneAndUpdate(
        { employee: employee._id, type: leaveType._id, year: targetYear },
        {
          $inc: {
            pending: -updatedRequest.workingDays,
            used: updatedRequest.workingDays,
          },
        }
      );

      // Mark dates as "ON_LEAVE" (or HALF_DAY) in AttendanceRecord
      let curr = startKey;
      while (curr <= endKey) {
        const dayType = await calendarService.getDayType(curr, tz, policy.workdays);
        if (dayType === "workday") {
          const status = updatedRequest.isHalfDay
            ? AttendanceStatus.HALF_DAY
            : AttendanceStatus.ON_LEAVE;

          const record = await AttendanceRecord.findOneAndUpdate(
            { employee: employee._id, dateKey: curr },
            {
              $set: {
                employeeId: employee.employeeId,
                department: employee.department,
                status,
                isManuallyCorrected: false,
                systemNotes: `Approved Leave: ${leaveType.name}${
                  updatedRequest.isHalfDay ? ` (${updatedRequest.halfDayType})` : ""
                }`,
              },
            },
            { upsert: true, new: true }
          );

          eventEmitterService.emitAttendanceUpdated({
            recordId: record._id.toString(),
            employeeId: employee.employeeId,
            employeeName: employee.name,
            department: employee.department,
            dateKey: curr,
            punchType: "CORRECTION",
            status,
            isLate: false,
            timestamp: new Date().toISOString(),
            durationMinutes: 0,
            message: `Marked ${status} due to approved ${leaveType.name}.`,
          });
        }
        curr = addDaysToDateKey(curr, 1);
      }
    } else {
      // REJECTED: Release reserved pending balance back to available
      await LeaveBalance.findOneAndUpdate(
        { employee: employee._id, type: leaveType._id, year: targetYear },
        { $inc: { pending: -updatedRequest.workingDays } }
      );
    }

    // Audit Logging
    await AuditEvent.create({
      entityType: "LEAVE_REQUEST",
      entityId: updatedRequest._id.toString(),
      action: `LEAVE_${decision.status}`,
      performedBy: adminUserId,
      performedByEmployeeId: actor.employeeId,
      reason: decision.decisionNote || `Leave ${decision.status.toLowerCase()} by HR`,
      previousValue: { status: "PENDING" },
      newValue: { status: decision.status },
      timestamp: now,
    });

    // In-App Notification
    await Notification.create({
      user: employee.userId,
      type: "LEAVE_STATUS",
      title: `Leave Request ${decision.status === "APPROVED" ? "Approved" : "Rejected"}`,
      message: `Your ${leaveType.name} request for ${startKey} to ${endKey} (${updatedRequest.workingDays} days) was ${decision.status.toLowerCase()}.${
        decision.decisionNote ? ` Note: ${decision.decisionNote}` : ""
      }`,
      payload: {
        requestId: updatedRequest._id.toString(),
        status: decision.status,
        note: decision.decisionNote,
      },
    }).catch(() => null);

    // Sockets
    eventEmitterService.emitLeaveDecided({
      requestId: updatedRequest._id.toString(),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      status: decision.status,
      workingDays: updatedRequest.workingDays,
      decisionNote: decision.decisionNote,
      timestamp: now.toISOString(),
    });

    logger.info(
      `[LeaveService] Decided leave request ${requestId}: ${decision.status} for ${employee.employeeId}`
    );

    return updatedRequest;
  }

  /**
   * Bulk approve or reject leave requests with detailed per-item results
   */
  public async bulkDecideLeaveRequests(
    requestIds: string[],
    decision: DecideLeaveRequestInput,
    actor: { userId: string; employeeId?: string; role?: string }
  ): Promise<BulkDecisionResult> {
    const successful: Array<{ requestId: string; employeeId: string; status: string }> = [];
    const failed: Array<{ requestId: string; reason: string; code: string }> = [];

    for (const reqId of requestIds) {
      try {
        const updated = await this.decideLeaveRequest(reqId, decision, actor);
        const emp = updated.employee as unknown as IEmployee;
        successful.push({
          requestId: reqId,
          employeeId: emp.employeeId,
          status: updated.status,
        });
      } catch (err: any) {
        failed.push({
          requestId: reqId,
          reason: err.message || "Failed to decide leave request.",
          code: err.code || ApiErrorCode.ERR_BAD_REQUEST,
        });
      }
    }

    return {
      total: requestIds.length,
      successful,
      failed,
    };
  }
}

export const leaveService = new LeaveService();
