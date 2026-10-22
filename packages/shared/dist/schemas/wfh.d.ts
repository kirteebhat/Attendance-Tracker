import { z } from "zod";
import { WfhStatus } from "../constants/enums";
export declare const WfhCreateRequestSchema: z.ZodObject<{
    dateKey: z.ZodString;
    reason: z.ZodString;
    simulatedNow: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateKey: string;
    reason: string;
    simulatedNow?: string | undefined;
}, {
    dateKey: string;
    reason: string;
    simulatedNow?: string | undefined;
}>;
export type WfhCreateRequest = z.infer<typeof WfhCreateRequestSchema>;
export declare const WfhReviewRequestSchema: z.ZodObject<{
    status: z.ZodEnum<[WfhStatus.APPROVED, WfhStatus.REJECTED]>;
    remarks: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: WfhStatus.APPROVED | WfhStatus.REJECTED;
    remarks?: string | undefined;
}, {
    status: WfhStatus.APPROVED | WfhStatus.REJECTED;
    remarks?: string | undefined;
}>;
export type WfhReviewRequest = z.infer<typeof WfhReviewRequestSchema>;
export declare const WfhRequestRecordSchema: z.ZodObject<{
    _id: z.ZodString;
    employeeId: z.ZodString;
    employeeName: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    dateKey: z.ZodString;
    reason: z.ZodString;
    status: z.ZodNativeEnum<typeof WfhStatus>;
    reviewedBy: z.ZodOptional<z.ZodString>;
    reviewerRemarks: z.ZodOptional<z.ZodString>;
    reviewedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    status: WfhStatus;
    _id: string;
    dateKey: string;
    createdAt: string;
    reason: string;
    department?: string | undefined;
    updatedAt?: string | undefined;
    employeeName?: string | undefined;
    reviewedBy?: string | undefined;
    reviewerRemarks?: string | undefined;
    reviewedAt?: string | undefined;
}, {
    employeeId: string;
    status: WfhStatus;
    _id: string;
    dateKey: string;
    createdAt: string;
    reason: string;
    department?: string | undefined;
    updatedAt?: string | undefined;
    employeeName?: string | undefined;
    reviewedBy?: string | undefined;
    reviewerRemarks?: string | undefined;
    reviewedAt?: string | undefined;
}>;
export type WfhRequestRecord = z.infer<typeof WfhRequestRecordSchema>;
export declare const WfhEligibilityResponseSchema: z.ZodObject<{
    isEligible: z.ZodBoolean;
    department: z.ZodString;
    monthlyQuota: z.ZodNumber;
    usedDays: z.ZodNumber;
    remainingQuota: z.ZodNumber;
    rules: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    department: string;
    isEligible: boolean;
    monthlyQuota: number;
    usedDays: number;
    remainingQuota: number;
    rules?: string | undefined;
}, {
    department: string;
    isEligible: boolean;
    monthlyQuota: number;
    usedDays: number;
    remainingQuota: number;
    rules?: string | undefined;
}>;
export type WfhEligibilityResponse = z.infer<typeof WfhEligibilityResponseSchema>;
export declare const WfhFilterQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<[WfhStatus.PENDING, WfhStatus.APPROVED, WfhStatus.REJECTED, WfhStatus.CANCELLED, "ALL"]>>;
    department: z.ZodOptional<z.ZodString>;
    month: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    status?: WfhStatus | "ALL" | undefined;
    department?: string | undefined;
    month?: string | undefined;
    search?: string | undefined;
}, {
    status?: WfhStatus | "ALL" | undefined;
    department?: string | undefined;
    month?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
}>;
export type WfhFilterQuery = z.infer<typeof WfhFilterQuerySchema>;
//# sourceMappingURL=wfh.d.ts.map