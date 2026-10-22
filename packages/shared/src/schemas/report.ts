import { z } from "zod";
import { AttendanceStatus, WfhStatus } from "../constants/enums";

export const DashboardSummaryQuerySchema = z.object({
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
    .optional(),
  simulatedNow: z.string().optional(),
});

export type DashboardSummaryQuery = z.infer<typeof DashboardSummaryQuerySchema>;

export const ReportFilterQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
    .optional(),
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
    .optional(),
  department: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  employee: z.string().trim().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  workType: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  format: z.enum(["json", "csv"]).default("json"),
});

export type ReportFilterQuery = z.infer<typeof ReportFilterQuerySchema>;

export const WfhReportFilterQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD")
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD")
    .optional(),
  department: z.string().trim().optional(),
  status: z
    .enum([WfhStatus.PENDING, WfhStatus.APPROVED, WfhStatus.REJECTED, WfhStatus.CANCELLED, "ALL"])
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
  format: z.enum(["json", "csv"]).default("json"),
});

export type WfhReportFilterQuery = z.infer<typeof WfhReportFilterQuerySchema>;
