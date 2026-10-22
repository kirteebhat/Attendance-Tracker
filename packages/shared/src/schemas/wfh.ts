import { z } from "zod";
import { WfhStatus } from "../constants/enums";

export const WfhCreateRequestSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  reason: z
    .string()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason cannot exceed 500 characters")
    .trim(),
  simulatedNow: z.string().optional(),
});

export type WfhCreateRequest = z.infer<typeof WfhCreateRequestSchema>;

export const WfhReviewRequestSchema = z.object({
  status: z.enum([WfhStatus.APPROVED, WfhStatus.REJECTED]),
  remarks: z.string().max(500).trim().optional(),
});

export type WfhReviewRequest = z.infer<typeof WfhReviewRequestSchema>;

export const WfhRequestRecordSchema = z.object({
  _id: z.string(),
  employeeId: z.string(),
  employeeName: z.string().optional(),
  department: z.string().optional(),
  dateKey: z.string(),
  reason: z.string(),
  status: z.nativeEnum(WfhStatus),
  reviewedBy: z.string().optional(),
  reviewerRemarks: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type WfhRequestRecord = z.infer<typeof WfhRequestRecordSchema>;

export const WfhEligibilityResponseSchema = z.object({
  isEligible: z.boolean(),
  department: z.string(),
  monthlyQuota: z.number().int().nonnegative(),
  usedDays: z.number().int().nonnegative(),
  remainingQuota: z.number().int().nonnegative(),
  rules: z.string().optional(),
});

export type WfhEligibilityResponse = z.infer<typeof WfhEligibilityResponseSchema>;

export const WfhFilterQuerySchema = z.object({
  status: z
    .enum([WfhStatus.PENDING, WfhStatus.APPROVED, WfhStatus.REJECTED, WfhStatus.CANCELLED, "ALL"])
    .optional(),
  department: z.string().trim().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format")
    .optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type WfhFilterQuery = z.infer<typeof WfhFilterQuerySchema>;
