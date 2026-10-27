import { z } from "zod";
import { WfhStatus } from "../constants/enums";
export declare const WfhCreateRequestSchema: z.ZodObject<{
    dateKey: z.ZodString;
    reason: z.ZodString;
    simulatedNow: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reason: string;
    dateKey: string;
    simulatedNow?: string | undefined;
}, {
    reason: string;
    dateKey: string;
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
    status: WfhStatus;
    _id: string;
    createdAt: string;
    reason: string;
    employeeId: string;
    dateKey: string;
    updatedAt?: string | undefined;
    department?: string | undefined;
    employeeName?: string | undefined;
    reviewedBy?: string | undefined;
    reviewerRemarks?: string | undefined;
    reviewedAt?: string | undefined;
}, {
    status: WfhStatus;
    _id: string;
    createdAt: string;
    reason: string;
    employeeId: string;
    dateKey: string;
    updatedAt?: string | undefined;
    department?: string | undefined;
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
    status?: "ALL" | WfhStatus | undefined;
    department?: string | undefined;
    search?: string | undefined;
    month?: string | undefined;
}, {
    status?: "ALL" | WfhStatus | undefined;
    department?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    month?: string | undefined;
}>;
export type WfhFilterQuery = z.infer<typeof WfhFilterQuerySchema>;
//# sourceMappingURL=wfh.d.ts.map