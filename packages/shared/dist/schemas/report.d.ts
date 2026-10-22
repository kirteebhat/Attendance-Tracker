import { z } from "zod";
import { AttendanceStatus, WfhStatus } from "../constants/enums";
export declare const DashboardSummaryQuerySchema: z.ZodObject<{
    dateKey: z.ZodOptional<z.ZodString>;
    simulatedNow: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    simulatedNow?: string | undefined;
    dateKey?: string | undefined;
}, {
    simulatedNow?: string | undefined;
    dateKey?: string | undefined;
}>;
export type DashboardSummaryQuery = z.infer<typeof DashboardSummaryQuerySchema>;
export declare const ReportFilterQuerySchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    dateKey: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    employeeId: z.ZodOptional<z.ZodString>;
    employee: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof AttendanceStatus>>;
    workType: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    format: z.ZodDefault<z.ZodEnum<["json", "csv"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    format: "json" | "csv";
    employeeId?: string | undefined;
    status?: AttendanceStatus | undefined;
    department?: string | undefined;
    dateKey?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    employee?: string | undefined;
    workType?: string | undefined;
    search?: string | undefined;
    sortBy?: string | undefined;
}, {
    employeeId?: string | undefined;
    status?: AttendanceStatus | undefined;
    department?: string | undefined;
    dateKey?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    employee?: string | undefined;
    workType?: string | undefined;
    search?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    format?: "json" | "csv" | undefined;
}>;
export type ReportFilterQuery = z.infer<typeof ReportFilterQuerySchema>;
export declare const WfhReportFilterQuerySchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<[WfhStatus.PENDING, WfhStatus.APPROVED, WfhStatus.REJECTED, WfhStatus.CANCELLED, "ALL"]>>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    format: z.ZodDefault<z.ZodEnum<["json", "csv"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    format: "json" | "csv";
    status?: WfhStatus | "ALL" | undefined;
    department?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    search?: string | undefined;
}, {
    status?: WfhStatus | "ALL" | undefined;
    department?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    search?: string | undefined;
    format?: "json" | "csv" | undefined;
}>;
export type WfhReportFilterQuery = z.infer<typeof WfhReportFilterQuerySchema>;
//# sourceMappingURL=report.d.ts.map