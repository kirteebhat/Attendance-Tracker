import { z } from "zod";
import { AttendanceStatus, PunchType } from "../constants/enums";
export declare const PunchRequestSchema: z.ZodObject<{
    qrPayload: z.ZodString;
}, "strip", z.ZodTypeAny, {
    qrPayload: string;
}, {
    qrPayload: string;
}>;
export type PunchRequest = z.infer<typeof PunchRequestSchema>;
export declare const AttendanceScanRequestSchema: z.ZodEffects<z.ZodObject<{
    token: z.ZodOptional<z.ZodString>;
    qrPayload: z.ZodOptional<z.ZodString>;
    action: z.ZodOptional<z.ZodEnum<["CHECK_IN", "CHECK_OUT"]>>;
    simulatedNow: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    qrPayload?: string | undefined;
    token?: string | undefined;
    action?: "CHECK_IN" | "CHECK_OUT" | undefined;
    simulatedNow?: string | undefined;
}, {
    qrPayload?: string | undefined;
    token?: string | undefined;
    action?: "CHECK_IN" | "CHECK_OUT" | undefined;
    simulatedNow?: string | undefined;
}>, {
    qrPayload?: string | undefined;
    token?: string | undefined;
    action?: "CHECK_IN" | "CHECK_OUT" | undefined;
    simulatedNow?: string | undefined;
}, {
    qrPayload?: string | undefined;
    token?: string | undefined;
    action?: "CHECK_IN" | "CHECK_OUT" | undefined;
    simulatedNow?: string | undefined;
}>;
export type AttendanceScanRequest = z.infer<typeof AttendanceScanRequestSchema>;
export declare const AttendanceRecordSchema: z.ZodObject<{
    _id: z.ZodString;
    employeeId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodString>;
    dateKey: z.ZodString;
    checkInTime: z.ZodNullable<z.ZodString>;
    checkOutTime: z.ZodNullable<z.ZodString>;
    durationMinutes: z.ZodDefault<z.ZodNumber>;
    status: z.ZodNativeEnum<typeof AttendanceStatus>;
    isLate: z.ZodDefault<z.ZodBoolean>;
    lateMinutes: z.ZodDefault<z.ZodNumber>;
    isMissingCheckout: z.ZodDefault<z.ZodBoolean>;
    isManuallyCorrected: z.ZodDefault<z.ZodBoolean>;
    terminalId: z.ZodOptional<z.ZodString>;
    systemNotes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    status: AttendanceStatus;
    _id: string;
    dateKey: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    durationMinutes: number;
    isLate: boolean;
    lateMinutes: number;
    isMissingCheckout: boolean;
    isManuallyCorrected: boolean;
    createdAt: string;
    departmentId?: string | undefined;
    terminalId?: string | undefined;
    systemNotes?: string | undefined;
    updatedAt?: string | undefined;
}, {
    employeeId: string;
    status: AttendanceStatus;
    _id: string;
    dateKey: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    createdAt: string;
    departmentId?: string | undefined;
    durationMinutes?: number | undefined;
    isLate?: boolean | undefined;
    lateMinutes?: number | undefined;
    isMissingCheckout?: boolean | undefined;
    isManuallyCorrected?: boolean | undefined;
    terminalId?: string | undefined;
    systemNotes?: string | undefined;
    updatedAt?: string | undefined;
}>;
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;
export declare const AttendanceTodayResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    dateKey: z.ZodString;
    hasPunched: z.ZodBoolean;
    punchType: z.ZodOptional<z.ZodNativeEnum<typeof PunchType>>;
    status: z.ZodNativeEnum<typeof AttendanceStatus>;
    checkInTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    checkOutTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    durationMinutes: z.ZodDefault<z.ZodNumber>;
    isLate: z.ZodDefault<z.ZodBoolean>;
    shift: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        startTime: z.ZodString;
        endTime: z.ZodString;
        graceMinutes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
    }, {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: AttendanceStatus;
    dateKey: string;
    durationMinutes: number;
    isLate: boolean;
    success: boolean;
    hasPunched: boolean;
    shift?: {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
    } | undefined;
    checkInTime?: string | null | undefined;
    checkOutTime?: string | null | undefined;
    punchType?: PunchType | undefined;
}, {
    status: AttendanceStatus;
    dateKey: string;
    success: boolean;
    hasPunched: boolean;
    shift?: {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
    } | undefined;
    checkInTime?: string | null | undefined;
    checkOutTime?: string | null | undefined;
    durationMinutes?: number | undefined;
    isLate?: boolean | undefined;
    punchType?: PunchType | undefined;
}>;
export type AttendanceTodayResponse = z.infer<typeof AttendanceTodayResponseSchema>;
export declare const AttendanceHistoryQuerySchema: z.ZodObject<{
    month: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof AttendanceStatus>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: AttendanceStatus | undefined;
    month?: string | undefined;
}, {
    status?: AttendanceStatus | undefined;
    month?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type AttendanceHistoryQuery = z.infer<typeof AttendanceHistoryQuerySchema>;
export declare const AttendanceStatsResponseSchema: z.ZodObject<{
    month: z.ZodString;
    totalWorkingDays: z.ZodNumber;
    presentDays: z.ZodNumber;
    lateDays: z.ZodNumber;
    wfhDays: z.ZodNumber;
    attendancePercentage: z.ZodNumber;
    wfhRemainingQuota: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    month: string;
    totalWorkingDays: number;
    presentDays: number;
    lateDays: number;
    wfhDays: number;
    attendancePercentage: number;
    wfhRemainingQuota: number;
}, {
    month: string;
    totalWorkingDays: number;
    presentDays: number;
    lateDays: number;
    wfhDays: number;
    attendancePercentage: number;
    wfhRemainingQuota: number;
}>;
export type AttendanceStatsResponse = z.infer<typeof AttendanceStatsResponseSchema>;
export declare const AttendanceFilterQuerySchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    dateKey: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    employee: z.ZodOptional<z.ZodString>;
    employeeId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof AttendanceStatus>>;
    workType: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["dateKey", "createdAt", "employeeId", "status"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortBy: "employeeId" | "status" | "dateKey" | "createdAt";
    sortOrder: "asc" | "desc";
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
    sortBy?: "employeeId" | "status" | "dateKey" | "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type AttendanceFilterQuery = z.infer<typeof AttendanceFilterQuerySchema>;
export declare const AttendanceCorrectionRequestSchema: z.ZodEffects<z.ZodObject<{
    status: z.ZodOptional<z.ZodNativeEnum<typeof AttendanceStatus>>;
    checkInTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    checkOutTime: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
    isLate: z.ZodOptional<z.ZodBoolean>;
    isMissingCheckout: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    status?: AttendanceStatus | undefined;
    checkInTime?: string | null | undefined;
    checkOutTime?: string | null | undefined;
    isLate?: boolean | undefined;
    isMissingCheckout?: boolean | undefined;
}, {
    reason: string;
    status?: AttendanceStatus | undefined;
    checkInTime?: string | null | undefined;
    checkOutTime?: string | null | undefined;
    isLate?: boolean | undefined;
    isMissingCheckout?: boolean | undefined;
}>, {
    reason: string;
    status?: AttendanceStatus | undefined;
    checkInTime?: string | null | undefined;
    checkOutTime?: string | null | undefined;
    isLate?: boolean | undefined;
    isMissingCheckout?: boolean | undefined;
}, {
    reason: string;
    status?: AttendanceStatus | undefined;
    checkInTime?: string | null | undefined;
    checkOutTime?: string | null | undefined;
    isLate?: boolean | undefined;
    isMissingCheckout?: boolean | undefined;
}>;
export type AttendanceCorrectionRequest = z.infer<typeof AttendanceCorrectionRequestSchema>;
export declare const AbsenceEvaluationJobRequestSchema: z.ZodObject<{
    dateKey: z.ZodOptional<z.ZodString>;
    force: z.ZodDefault<z.ZodBoolean>;
    simulatedNow: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    force: boolean;
    simulatedNow?: string | undefined;
    dateKey?: string | undefined;
}, {
    simulatedNow?: string | undefined;
    dateKey?: string | undefined;
    force?: boolean | undefined;
}>;
export type AbsenceEvaluationJobRequest = z.infer<typeof AbsenceEvaluationJobRequestSchema>;
//# sourceMappingURL=attendance.d.ts.map