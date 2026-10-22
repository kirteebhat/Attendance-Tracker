"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WfhFilterQuerySchema = exports.WfhEligibilityResponseSchema = exports.WfhRequestRecordSchema = exports.WfhReviewRequestSchema = exports.WfhCreateRequestSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.WfhCreateRequestSchema = zod_1.z.object({
    dateKey: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    reason: zod_1.z
        .string()
        .min(5, "Reason must be at least 5 characters")
        .max(500, "Reason cannot exceed 500 characters")
        .trim(),
    simulatedNow: zod_1.z.string().optional(),
});
exports.WfhReviewRequestSchema = zod_1.z.object({
    status: zod_1.z.enum([enums_1.WfhStatus.APPROVED, enums_1.WfhStatus.REJECTED]),
    remarks: zod_1.z.string().max(500).trim().optional(),
});
exports.WfhRequestRecordSchema = zod_1.z.object({
    _id: zod_1.z.string(),
    employeeId: zod_1.z.string(),
    employeeName: zod_1.z.string().optional(),
    department: zod_1.z.string().optional(),
    dateKey: zod_1.z.string(),
    reason: zod_1.z.string(),
    status: zod_1.z.nativeEnum(enums_1.WfhStatus),
    reviewedBy: zod_1.z.string().optional(),
    reviewerRemarks: zod_1.z.string().optional(),
    reviewedAt: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
exports.WfhEligibilityResponseSchema = zod_1.z.object({
    isEligible: zod_1.z.boolean(),
    department: zod_1.z.string(),
    monthlyQuota: zod_1.z.number().int().nonnegative(),
    usedDays: zod_1.z.number().int().nonnegative(),
    remainingQuota: zod_1.z.number().int().nonnegative(),
    rules: zod_1.z.string().optional(),
});
exports.WfhFilterQuerySchema = zod_1.z.object({
    status: zod_1.z
        .enum([enums_1.WfhStatus.PENDING, enums_1.WfhStatus.APPROVED, enums_1.WfhStatus.REJECTED, enums_1.WfhStatus.CANCELLED, "ALL"])
        .optional(),
    department: zod_1.z.string().trim().optional(),
    month: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format")
        .optional(),
    search: zod_1.z.string().trim().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
});
