"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WfhReportFilterQuerySchema = exports.ReportFilterQuerySchema = exports.DashboardSummaryQuerySchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.DashboardSummaryQuerySchema = zod_1.z.object({
    dateKey: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
        .optional(),
    simulatedNow: zod_1.z.string().optional(),
});
exports.ReportFilterQuerySchema = zod_1.z.object({
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
    employeeId: zod_1.z.string().trim().optional(),
    employee: zod_1.z.string().trim().optional(),
    status: zod_1.z.nativeEnum(enums_1.AttendanceStatus).optional(),
    workType: zod_1.z.string().trim().optional(),
    search: zod_1.z.string().trim().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(500).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(["asc", "desc"]).default("desc"),
    format: zod_1.z.enum(["json", "csv"]).default("json"),
});
exports.WfhReportFilterQuerySchema = zod_1.z.object({
    startDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
        .optional(),
    endDate: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
        .optional(),
    department: zod_1.z.string().trim().optional(),
    status: zod_1.z
        .enum([enums_1.WfhStatus.PENDING, enums_1.WfhStatus.APPROVED, enums_1.WfhStatus.REJECTED, enums_1.WfhStatus.CANCELLED, "ALL"])
        .optional(),
    search: zod_1.z.string().trim().optional(),
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(500).default(20),
    format: zod_1.z.enum(["json", "csv"]).default("json"),
});
