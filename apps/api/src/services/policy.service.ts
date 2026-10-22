import mongoose, { Types } from "mongoose";
import { AttendancePolicy, IAttendancePolicy } from "../models/AttendancePolicy";
import { Holiday, IHoliday } from "../models/Holiday";
import { AuditEvent } from "../models/AuditEvent";
import { eventEmitterService } from "./eventEmitter.service";
import { AppError } from "../utils/AppError";
import {
  ApiErrorCode,
  HolidayCreate,
  HolidayUpdate,
  validatePolicyShifts,
  DEFAULT_TIMEZONE,
} from "@vorldx/shared";
import { ActorContext } from "./employee.service";

export class PolicyService {
  /**
   * Retrieves the active default company attendance policy.
   * Self-seeds default policy with 3 shifts (Day, Morning, Night) if none exists.
   */
  public async getActivePolicy(): Promise<IAttendancePolicy> {
    let policy = await AttendancePolicy.findOne({ isDefault: true });

    if (!policy) {
      policy = await AttendancePolicy.create({
        name: "Standard Corporate Attendance Policy",
        version: 1,
        timezone: DEFAULT_TIMEZONE,
        defaultGraceMinutes: 15,
        minFullDayHours: 8,
        minHalfDayHours: 4,
        monthlyWfhQuota: 4,
        absenceEvaluationCutoffTime: "23:59",
        wfhRules: {
          monthlyQuota: 4,
          advanceNoticeDays: 1,
          allowedDaysPerWeek: 2,
          autoApproval: false,
        },
        workdays: [1, 2, 3, 4, 5], // Monday - Friday
        shifts: [
          {
            name: "General Day Shift",
            startTime: "09:30",
            endTime: "18:30",
            graceMinutes: 15,
            checkInWindowStartMinutes: 60,
            checkInWindowEndMinutes: 180,
            checkOutWindowStartMinutes: 60,
            checkOutWindowEndMinutes: 180,
            isOvernight: false,
            isActive: true,
          },
          {
            name: "Early Morning Shift",
            startTime: "07:00",
            endTime: "16:00",
            graceMinutes: 15,
            checkInWindowStartMinutes: 60,
            checkInWindowEndMinutes: 180,
            checkOutWindowStartMinutes: 60,
            checkOutWindowEndMinutes: 180,
            isOvernight: false,
            isActive: true,
          },
          {
            name: "Night Operations Shift",
            startTime: "21:00",
            endTime: "06:00",
            graceMinutes: 15,
            checkInWindowStartMinutes: 60,
            checkInWindowEndMinutes: 180,
            checkOutWindowStartMinutes: 60,
            checkOutWindowEndMinutes: 180,
            isOvernight: true,
            isActive: true,
          },
        ],
        qrRotationSeconds: 30,
        qrGraceSeconds: 15,
        punchCooldownMinutes: 2,
        allowOvertime: false,
        isDefault: true,
      });
    }

    return policy;
  }

  /**
   * Updates the attendance policy, validating shift constraints, incrementing policy version,
   * and logging an immutable AuditEvent.
   */
  public async updatePolicy(
    data: Record<string, unknown>,
    actor: ActorContext
  ): Promise<IAttendancePolicy> {
    const policy = await this.getActivePolicy();
    const beforeState = policy.toObject();

    // Validate shifts if provided
    if (data.shifts && Array.isArray(data.shifts)) {
      const shiftValidation = validatePolicyShifts(
        data.shifts as Parameters<typeof validatePolicyShifts>[0]
      );
      if (!shiftValidation.valid) {
        throw AppError.badRequest(
          shiftValidation.error || "Invalid shift configuration",
          ApiErrorCode.ERR_INVALID_INPUT
        );
      }
      policy.shifts = data.shifts as unknown as typeof policy.shifts;
    }

    // Validate grace period
    if (data.defaultGraceMinutes !== undefined) {
      const grace = Number(data.defaultGraceMinutes);
      if (grace < 0 || grace > 60) {
        throw AppError.badRequest(
          "Default grace period must be between 0 and 60 minutes",
          ApiErrorCode.ERR_INVALID_INPUT
        );
      }
      policy.defaultGraceMinutes = grace;
    }

    if (data.name) policy.name = String(data.name).trim();
    if (data.timezone) policy.timezone = String(data.timezone).trim();
    if (data.minFullDayHours !== undefined) policy.minFullDayHours = Number(data.minFullDayHours);
    if (data.minHalfDayHours !== undefined) policy.minHalfDayHours = Number(data.minHalfDayHours);
    if (data.monthlyWfhQuota !== undefined) policy.monthlyWfhQuota = Number(data.monthlyWfhQuota);
    if (data.absenceEvaluationCutoffTime)
      policy.absenceEvaluationCutoffTime = String(data.absenceEvaluationCutoffTime).trim();
    if (data.workdays && Array.isArray(data.workdays)) policy.workdays = data.workdays as number[];
    if (data.wfhRules && typeof data.wfhRules === "object") {
      policy.wfhRules = { ...policy.wfhRules, ...data.wfhRules };
    }
    if (data.allowOvertime !== undefined) policy.allowOvertime = Boolean(data.allowOvertime);

    // Increment policy version
    const nextVersion = (policy.version || 1) + 1;
    policy.version = nextVersion;

    await policy.save();

    // Write AuditEvent
    await AuditEvent.create({
      entityType: "POLICY",
      entityId: policy._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: "UPDATE",
      previousValue: beforeState,
      newValue: policy.toObject(),
      reason: (data.reason as string) || `Attendance policy updated to version ${nextVersion}`,
      timestamp: new Date(),
      metadata: { newVersion: nextVersion, actorRole: actor.role },
    });

    eventEmitterService.emitPolicyUpdated({
      policyId: policy._id.toString(),
      version: nextVersion,
      name: policy.name,
      timezone: policy.timezone,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.employeeId || actor.userId,
    });

    return policy;
  }

  // ==========================================
  // Holiday Management CRUD
  // ==========================================

  public async listHolidays(year?: number): Promise<IHoliday[]> {
    const filter: Record<string, unknown> = {};

    if (year) {
      const yearStr = String(year);
      filter.$or = [{ dateKey: new RegExp(`^${yearStr}-`) }, { isRecurring: true }];
    }

    return Holiday.find(filter).sort({ dateKey: 1 }).lean() as unknown as Promise<IHoliday[]>;
  }

  public async getHolidayById(idOrDateKey: string): Promise<IHoliday> {
    const trimmed = idOrDateKey.trim();
    let holiday: IHoliday | null = null;

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      holiday = await Holiday.findById(trimmed);
    }
    if (!holiday) {
      holiday = await Holiday.findOne({ dateKey: trimmed });
    }

    if (!holiday) {
      throw AppError.notFound(`Holiday '${idOrDateKey}' not found`, ApiErrorCode.ERR_NOT_FOUND);
    }

    return holiday;
  }

  public async createHoliday(data: HolidayCreate, actor: ActorContext): Promise<IHoliday> {
    const existing = await Holiday.findOne({ dateKey: data.dateKey });
    if (existing) {
      throw AppError.conflict(
        `Holiday for date '${data.dateKey}' already exists (${existing.name})`,
        ApiErrorCode.ERR_BAD_REQUEST
      );
    }

    const holiday = await Holiday.create({
      name: data.name.trim(),
      dateKey: data.dateKey,
      description: data.description?.trim(),
      isRecurring: Boolean(data.isRecurring),
    });

    await AuditEvent.create({
      entityType: "POLICY",
      entityId: holiday._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: "CREATE_HOLIDAY",
      previousValue: null,
      newValue: holiday.toObject(),
      reason: `Created holiday '${holiday.name}' for ${holiday.dateKey}`,
      timestamp: new Date(),
      metadata: { actorRole: actor.role },
    });

    return holiday;
  }

  public async updateHoliday(
    idOrDateKey: string,
    data: HolidayUpdate,
    actor: ActorContext
  ): Promise<IHoliday> {
    const holiday = await this.getHolidayById(idOrDateKey);
    const beforeState = holiday.toObject();

    if (data.dateKey && data.dateKey !== holiday.dateKey) {
      const conflict = await Holiday.findOne({ dateKey: data.dateKey, _id: { $ne: holiday._id } });
      if (conflict) {
        throw AppError.conflict(
          `Holiday on date '${data.dateKey}' already exists`,
          ApiErrorCode.ERR_BAD_REQUEST
        );
      }
      holiday.dateKey = data.dateKey;
    }

    if (data.name !== undefined) holiday.name = data.name.trim();
    if (data.description !== undefined) holiday.description = data.description?.trim();
    if (data.isRecurring !== undefined) holiday.isRecurring = Boolean(data.isRecurring);

    await holiday.save();

    await AuditEvent.create({
      entityType: "POLICY",
      entityId: holiday._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: "UPDATE_HOLIDAY",
      previousValue: beforeState,
      newValue: holiday.toObject(),
      reason: `Holiday '${holiday.name}' updated`,
      timestamp: new Date(),
      metadata: { actorRole: actor.role },
    });

    return holiday;
  }

  public async deleteHoliday(idOrDateKey: string, actor: ActorContext): Promise<void> {
    const holiday = await this.getHolidayById(idOrDateKey);
    const beforeState = holiday.toObject();

    await Holiday.deleteOne({ _id: holiday._id });

    await AuditEvent.create({
      entityType: "POLICY",
      entityId: holiday._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: "DELETE_HOLIDAY",
      previousValue: beforeState,
      newValue: null,
      reason: `Holiday '${holiday.name}' on ${holiday.dateKey} deleted`,
      timestamp: new Date(),
      metadata: { actorRole: actor.role },
    });
  }
}

export const policyService = new PolicyService();
