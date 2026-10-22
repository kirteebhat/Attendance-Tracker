import mongoose, { Types } from "mongoose";
import { Employee, IEmployee } from "../models/Employee";
import { User } from "../models/User";
import { AuditEvent } from "../models/AuditEvent";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, EmployeeCreate, EmployeeUpdate, EmployeeFilterQuery } from "@vorldx/shared";

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ActorContext {
  userId: string;
  employeeId: string;
  role: string;
}

export class EmployeeService {
  /**
   * Retrieves paginated employee roster with multi-column search, filtering, and sorting
   */
  public async listEmployees(query: EmployeeFilterQuery): Promise<PaginatedResult<IEmployee>> {
    const filter: Record<string, unknown> = {};

    // Multi-field search: name, employeeId, or email
    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { employeeId: searchRegex }, { email: searchRegex }];
    }

    // Department filter
    if (query.department && query.department.trim().length > 0) {
      filter.department = new RegExp(`^${query.department.trim()}$`, "i");
    }

    // Designation filter
    if (query.designation && query.designation.trim().length > 0) {
      filter.designation = new RegExp(`^${query.designation.trim()}$`, "i");
    }

    // Active status filter
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    } else if (query.status) {
      const s = query.status.toLowerCase();
      if (s === "active" || s === "true") {
        filter.isActive = true;
      } else if (s === "inactive" || s === "false") {
        filter.isActive = false;
      }
      // "all" leaves isActive unfiltered
    }

    // Shift filter
    if (query.shiftId && query.shiftId.trim().length > 0) {
      filter.shiftId = new Types.ObjectId(query.shiftId.trim());
    }

    // Work type filter
    if (query.workType) {
      filter.workType = query.workType;
    }

    // Sorting
    const sortField = query.sortBy || "createdAt";
    const sortDirection: 1 | -1 = query.sortOrder === "asc" ? 1 : -1;
    const sortOption: Record<string, 1 | -1> = { [sortField]: sortDirection };

    // Pagination
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      Employee.countDocuments(filter),
      Employee.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .populate("userId", "role status lastLoginAt")
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items as unknown as IEmployee[],
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Resolves an employee by Mongo ObjectId or unique business employeeId
   */
  public async getEmployeeById(idOrEmployeeId: string): Promise<IEmployee> {
    const trimmed = idOrEmployeeId.trim();
    let employee: IEmployee | null = null;

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      employee = await Employee.findById(trimmed).populate("userId", "role status lastLoginAt");
    }

    if (!employee) {
      employee = await Employee.findOne({ employeeId: trimmed.toUpperCase() }).populate(
        "userId",
        "role status lastLoginAt"
      );
    }

    if (!employee) {
      throw AppError.notFound(
        `Employee '${idOrEmployeeId}' not found`,
        ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND
      );
    }

    return employee;
  }

  /**
   * Onboards a new employee with duplicate prevention and audit trail logging
   */
  public async createEmployee(data: EmployeeCreate, actor: ActorContext): Promise<IEmployee> {
    const normalizedEmployeeId = data.employeeId.trim().toUpperCase();
    const normalizedEmail = data.email.trim().toLowerCase();

    // Prevent duplicate Employee ID
    const existingId = await Employee.findOne({ employeeId: normalizedEmployeeId });
    if (existingId) {
      throw AppError.conflict(
        `Employee ID '${normalizedEmployeeId}' already exists in company roster`,
        ApiErrorCode.ERR_BAD_REQUEST
      );
    }

    // Prevent duplicate Email
    const existingEmail = await Employee.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw AppError.conflict(
        `Email address '${normalizedEmail}' is already assigned to another employee`,
        ApiErrorCode.ERR_BAD_REQUEST
      );
    }

    const employee = await Employee.create({
      employeeId: normalizedEmployeeId,
      name: data.name.trim(),
      email: normalizedEmail,
      department: data.department.trim(),
      designation: data.designation.trim(),
      workType: data.workType,
      shiftId: data.shiftId ? new Types.ObjectId(data.shiftId) : undefined,
      joiningDate: data.joiningDate,
      isActive: true,
    });

    // Write immutable AuditEvent
    await AuditEvent.create({
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: "CREATE",
      previousValue: null,
      newValue: employee.toObject(),
      reason: "Employee onboarded into company directory",
      timestamp: new Date(),
      metadata: { actorRole: actor.role },
    });

    return employee;
  }

  /**
   * Updates employee record with uniqueness verification and audit trail logging
   */
  public async updateEmployee(
    idOrEmployeeId: string,
    data: EmployeeUpdate,
    actor: ActorContext
  ): Promise<IEmployee> {
    const employee = await this.getEmployeeById(idOrEmployeeId);
    const beforeState = employee.toObject();

    // Check Employee ID uniqueness if being modified
    if (data.employeeId) {
      const newEmployeeId = data.employeeId.trim().toUpperCase();
      if (newEmployeeId !== employee.employeeId) {
        const conflict = await Employee.findOne({
          employeeId: newEmployeeId,
          _id: { $ne: employee._id },
        });
        if (conflict) {
          throw AppError.conflict(
            `Employee ID '${newEmployeeId}' is already in use by another record`,
            ApiErrorCode.ERR_BAD_REQUEST
          );
        }
        employee.employeeId = newEmployeeId;
      }
    }

    // Check Email uniqueness if being modified
    if (data.email) {
      const newEmail = data.email.trim().toLowerCase();
      if (newEmail !== employee.email) {
        const conflict = await Employee.findOne({
          email: newEmail,
          _id: { $ne: employee._id },
        });
        if (conflict) {
          throw AppError.conflict(
            `Email address '${newEmail}' is already assigned to another employee`,
            ApiErrorCode.ERR_BAD_REQUEST
          );
        }
        employee.email = newEmail;
      }
    }

    if (data.name !== undefined) employee.name = data.name.trim();
    if (data.department !== undefined) employee.department = data.department.trim();
    if (data.designation !== undefined) employee.designation = data.designation.trim();
    if (data.workType !== undefined) employee.workType = data.workType;
    if (data.shiftId !== undefined) {
      employee.shiftId = data.shiftId ? new Types.ObjectId(data.shiftId) : undefined;
    }
    if (data.joiningDate !== undefined) employee.joiningDate = data.joiningDate;

    await employee.save();

    // Write immutable AuditEvent
    await AuditEvent.create({
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: "UPDATE",
      previousValue: beforeState,
      newValue: employee.toObject(),
      reason: "Employee profile details updated",
      timestamp: new Date(),
      metadata: { actorRole: actor.role },
    });

    return employee;
  }

  /**
   * Activates or deactivates an employee.
   * Deactivation immediately blocks login and QR attendance by invalidating active sessions
   * and setting associated User account status to INACTIVE, without deleting historical records.
   */
  public async updateStatus(
    idOrEmployeeId: string,
    isActive: boolean,
    reason: string | undefined,
    actor: ActorContext
  ): Promise<IEmployee> {
    const employee = await this.getEmployeeById(idOrEmployeeId);
    const previousState = { isActive: employee.isActive };

    employee.isActive = isActive;
    await employee.save();

    if (!isActive) {
      // Deactivating: immediately revoke refresh tokens and disable login access
      await User.updateMany(
        {
          $or: [
            ...(employee.userId ? [{ _id: employee.userId }] : []),
            { employeeId: employee.employeeId },
          ],
        },
        {
          $set: {
            status: "INACTIVE",
            refreshTokenHash: null,
          },
        }
      );
    } else {
      // Reactivating: restore active status on User account if registered
      await User.updateMany(
        {
          $or: [
            ...(employee.userId ? [{ _id: employee.userId }] : []),
            { employeeId: employee.employeeId },
          ],
        },
        {
          $set: {
            status: "ACTIVE",
          },
        }
      );
    }

    // Write immutable AuditEvent
    await AuditEvent.create({
      entityType: "EMPLOYEE",
      entityId: employee._id.toString(),
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor.employeeId,
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      previousValue: previousState,
      newValue: { isActive },
      reason:
        reason ||
        (isActive
          ? "Employee reactivated by administrator"
          : "Employee deactivated by administrator"),
      timestamp: new Date(),
      metadata: { actorRole: actor.role },
    });

    return employee;
  }
}

export const employeeService = new EmployeeService();
