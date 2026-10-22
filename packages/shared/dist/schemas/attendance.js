"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbsenceEvaluationJobRequestSchema = exports.AttendanceCorrectionRequestSchema = exports.AttendanceFilterQuerySchema = exports.AttendanceStatsResponseSchema = exports.AttendanceHistoryQuerySchema = exports.AttendanceTodayResponseSchema = exports.AttendanceRecordSchema = exports.AttendanceScanRequestSchema = exports.PunchRequestSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.PunchRequestSchema = zod_1.z.object({
    qrPayload: zod_1.z.string().min(1, "QR payload string is required"),
});
exports.AttendanceScanRequestSchema = zod_1.z
    .object({
    token: zod_1.z.string().trim().min(1).optional(),
    qrPayload: zod_1.z.string().trim().min(1).optional(),
    action: zod_1.z.enum(["CHECK_IN", "CHECK_OUT"]).optional(),
    simulatedNow: zod_1.z.string().optional(),
})
    .refine((data) => data.token || data.qrPayload, {
    message: "Either token or qrPayload is required",
    path: ["token"],
});
exports.AttendanceRecordSchema = zod_1.z.object({
    _id: zod_1.z.string(),
    employeeId: zod_1.z.string(),
    departmentId: zod_1.z.string().optional(),
    dateKey: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD"),
    checkInTime: zod_1.z.string().datetime().nullable(),
    checkOutTime: zod_1.z.string().datetime().nullable(),
    durationMinutes: zod_1.z.number().int().nonnegative().default(0),
    status: zod_1.z.nativeEnum(enums_1.AttendanceStatus),
    isLate: zod_1.z.boolean().default(false),
    lateMinutes: zod_1.z.number().int().nonnegative().default(0),
    isMissingCheckout: zod_1.z.boolean().default(false),
    isManuallyCorrected: zod_1.z.boolean().default(false),
    terminalId: zod_1.z.string().optional(),
    systemNotes: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
exports.AttendanceTodayResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    dateKey: zod_1.z.string(),
    hasPunched: zod_1.z.boolean(),
    punchType: zod_1.z.nativeEnum(enums_1.PunchType).optional(),
    status: zod_1.z.nativeEnum(enums_1.AttendanceStatus),
    checkInTime: zod_1.z.string().datetime().nullable().optional(),
    checkOutTime: zod_1.z.string().datetime().nullable().optional(),
    durationMinutes: zod_1.z.number().int().nonnegative().default(0),
    isLate: zod_1.z.boolean().default(false),
    shift: zod_1.z
        .object({
        name: zod_1.z.string(),
        startTime: zod_1.z.string(),
        endTime: zod_1.z.string(),
        graceMinutes: zod_1.z.number().int(),
    })
        .optional(),
});
exports.AttendanceHistoryQuerySchema = zod_1.z.object({
    month: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
        .optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    status: zod_1.z.nativeEnum(enums_1.AttendanceStatus).optional(),
});
exports.AttendanceStatsResponseSchema = zod_1.z.object({
    month: zod_1.z.string(),
    totalWorkingDays: zod_1.z.number().int().nonnegative(),
    presentDays: zod_1.z.number().int().nonnegative(),
    lateDays: zod_1.z.number().int().nonnegative(),
    wfhDays: zod_1.z.number().int().nonnegative(),
    attendancePercentage: zod_1.z.number().min(0).max(100),
    wfhRemainingQuota: zod_1.z.number().int().nonnegative(),
});
exports.AttendanceFilterQuerySchema = zod_1.z.object({
    startDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
        .optional(),
    endDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
        .optional(),
    dateKey: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
        .optional(),
    from: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
        .optional(),
    to: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
        .optional(),
    department: zod_1.z.string().trim().optional(),
    employee: zod_1.z.string().trim().optional(),
    employeeId: zod_1.z.string().trim().optional(),
    status: zod_1.z.nativeEnum(enums_1.AttendanceStatus).optional(),
    workType: zod_1.z.string().trim().optional(),
    search: zod_1.z.string().trim().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    sortBy: zod_1.z.enum(["dateKey", "createdAt", "employeeId", "status"]).default("dateKey"),
    sortOrder: zod_1.z.enum(["asc", "desc"]).default("desc"),
});
exports.AttendanceCorrectionRequestSchema = zod_1.z
    .object({
    status: zod_1.z.nativeEnum(enums_1.AttendanceStatus).optional(),
    checkInTime: zod_1.z.string().datetime().nullable().optional(),
    checkOutTime: zod_1.z.string().datetime().nullable().optional(),
    reason: zod_1.z
        .string()
        .min(5, "Justification reason must be at least 5 characters")
        .max(500, "Justification reason cannot exceed 500 characters")
        .trim(),
    isLate: zod_1.z.boolean().optional(),
    isMissingCheckout: zod_1.z.boolean().optional(),
})
    .refine((data) => {
    if (data.checkInTime && data.checkOutTime) {
        return new Date(data.checkOutTime).getTime() > new Date(data.checkInTime).getTime();
    }
    return true;
}, {
    message: "Check-out time must be strictly after check-in time",
    path: ["checkOutTime"],
});
exports.AbsenceEvaluationJobRequestSchema = zod_1.z.object({
    dateKey: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
        .optional(),
    force: zod_1.z.boolean().default(false),
    simulatedNow: zod_1.z.string().optional(),
});
