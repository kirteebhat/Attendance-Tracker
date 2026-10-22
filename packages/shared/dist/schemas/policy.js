"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HolidayUpdateSchema = exports.HolidayCreateSchema = exports.PolicyUpdateSchema = exports.AttendancePolicySchema = exports.ShiftSchema = exports.WfhRulesSchema = void 0;
const zod_1 = require("zod");
exports.WfhRulesSchema = zod_1.z.object({
    monthlyQuota: zod_1.z.number().int().nonnegative().default(4),
    advanceNoticeDays: zod_1.z.number().int().nonnegative().default(1),
    allowedDaysPerWeek: zod_1.z.number().int().min(1).max(7).default(2),
    autoApproval: zod_1.z.boolean().default(false),
});
exports.ShiftSchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2).max(100),
    startTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
    endTime: zod_1.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
    graceMinutes: zod_1.z.number().int().min(0).max(60).default(15),
    checkInWindowStartMinutes: zod_1.z.number().int().min(0).max(360).default(60),
    checkInWindowEndMinutes: zod_1.z.number().int().min(0).max(360).default(180),
    checkOutWindowStartMinutes: zod_1.z.number().int().min(0).max(360).default(60),
    checkOutWindowEndMinutes: zod_1.z.number().int().min(0).max(360).default(180),
    isOvernight: zod_1.z.boolean().default(false),
    isActive: zod_1.z.boolean().default(true),
});
exports.AttendancePolicySchema = zod_1.z.object({
    _id: zod_1.z.string().optional(),
    name: zod_1.z.string().min(2).max(100).default("Default Company Attendance Policy"),
    version: zod_1.z.number().int().positive().default(1),
    timezone: zod_1.z.string().default("Asia/Kolkata"),
    defaultGraceMinutes: zod_1.z.number().int().min(0).max(60).default(15),
    minFullDayHours: zod_1.z.number().positive().default(8),
    minHalfDayHours: zod_1.z.number().positive().default(4),
    monthlyWfhQuota: zod_1.z.number().int().nonnegative().default(4),
    absenceEvaluationCutoffTime: zod_1.z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
        .default("23:59"),
    workdays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    wfhRules: exports.WfhRulesSchema.default({}),
    shifts: zod_1.z.array(exports.ShiftSchema).default([]),
    qrRotationSeconds: zod_1.z.number().int().min(10).max(120).default(30),
    qrGraceSeconds: zod_1.z.number().int().min(5).max(60).default(15),
    punchCooldownMinutes: zod_1.z.number().int().nonnegative().default(2),
    allowOvertime: zod_1.z.boolean().default(false),
    isDefault: zod_1.z.boolean().default(true),
});
exports.PolicyUpdateSchema = exports.AttendancePolicySchema.partial().extend({
    reason: zod_1.z.string().trim().optional(),
});
exports.HolidayCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100).trim(),
    dateKey: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD format"),
    description: zod_1.z.string().max(500).trim().optional(),
    isRecurring: zod_1.z.boolean().default(false),
});
exports.HolidayUpdateSchema = exports.HolidayCreateSchema.partial();
