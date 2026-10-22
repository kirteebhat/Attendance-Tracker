"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeFilterQuerySchema = exports.EmployeeStatusUpdateSchema = exports.EmployeeUpdateSchema = exports.EmployeeCreateSchema = exports.EmployeeRecordSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.EmployeeRecordSchema = zod_1.z.object({
    _id: zod_1.z.string(),
    employeeId: zod_1.z.string(),
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    role: zod_1.z.nativeEnum(enums_1.UserRole),
    department: zod_1.z.string(),
    designation: zod_1.z.string(),
    workType: zod_1.z.nativeEnum(enums_1.WorkType).default(enums_1.WorkType.FULL_TIME),
    shiftId: zod_1.z.string().optional(),
    shiftName: zod_1.z.string().optional(),
    joiningDate: zod_1.z.string(),
    isVerified: zod_1.z.boolean(),
    isRegistered: zod_1.z.boolean(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
exports.EmployeeCreateSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(3).max(20).trim(),
    name: zod_1.z.string().min(2).max(100).trim(),
    email: zod_1.z.string().email().trim(),
    role: zod_1.z.nativeEnum(enums_1.UserRole).default(enums_1.UserRole.EMPLOYEE).optional(),
    department: zod_1.z.string().min(2).max(100).trim(),
    designation: zod_1.z.string().min(2).max(100).trim(),
    workType: zod_1.z.nativeEnum(enums_1.WorkType).default(enums_1.WorkType.FULL_TIME),
    shiftId: zod_1.z.string().nullable().optional(),
    joiningDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Joining date must be YYYY-MM-DD"),
});
exports.EmployeeUpdateSchema = exports.EmployeeCreateSchema.partial();
exports.EmployeeStatusUpdateSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
    reason: zod_1.z.string().trim().min(3, "Reason must be at least 3 characters").optional(),
});
exports.EmployeeFilterQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().optional(),
    department: zod_1.z.string().trim().optional(),
    designation: zod_1.z.string().trim().optional(),
    status: zod_1.z.string().trim().optional(),
    isActive: zod_1.z.preprocess((val) => {
        if (val === undefined || val === "")
            return undefined;
        if (val === "true" || val === true)
            return true;
        if (val === "false" || val === false)
            return false;
        return val;
    }, zod_1.z.boolean().optional()),
    shiftId: zod_1.z.string().trim().optional(),
    workType: zod_1.z.nativeEnum(enums_1.WorkType).optional(),
    sortBy: zod_1.z
        .enum([
        "name",
        "employeeId",
        "department",
        "designation",
        "joiningDate",
        "createdAt",
        "updatedAt",
    ])
        .default("createdAt"),
    sortOrder: zod_1.z.enum(["asc", "desc"]).default("desc"),
});
