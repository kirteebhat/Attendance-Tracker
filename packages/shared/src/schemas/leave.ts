import { z } from "zod";

export const LeaveRequestStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);
export type LeaveRequestStatus = z.infer<typeof LeaveRequestStatusSchema>;

export const HalfDayTypeSchema = z.enum(["FIRST_HALF", "SECOND_HALF"]);
export type HalfDayType = z.infer<typeof HalfDayTypeSchema>;

/**
 * Carry Forward Rule Schema
 */
export const CarryForwardRuleSchema = z.object({
  allowed: z.boolean().default(false),
  maxDays: z.number().nonnegative().default(0),
  expiryMonths: z.number().int().positive().optional(),
});
export type CarryForwardRule = z.infer<typeof CarryForwardRuleSchema>;

/**
 * Leave Type Schema
 */
export const LeaveTypeSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  code: z.string().min(1).max(10).toUpperCase(),
  paid: z.boolean().default(true),
  annualQuota: z.number().nonnegative().default(12),
  carryForwardRule: CarryForwardRuleSchema.default({ allowed: false, maxDays: 0 }),
  halfDayAllowed: z.boolean().default(true),
  description: z.string().max(300).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type LeaveType = z.infer<typeof LeaveTypeSchema>;

export const CreateLeaveTypeSchema = LeaveTypeSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateLeaveTypeInput = z.infer<typeof CreateLeaveTypeSchema>;

/**
 * Leave Balance Schema
 */
export const LeaveBalanceSchema = z.object({
  _id: z.string().optional(),
  employee: z.string(), // ObjectId
  type: z.string(), // ObjectId ref LeaveType
  year: z.number().int().min(2020).max(2100),
  allotted: z.number().nonnegative(),
  used: z.number().nonnegative().default(0),
  pending: z.number().nonnegative().default(0),
  carriedOver: z.number().nonnegative().default(0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;

/**
 * Leave Request Schema
 */
export const LeaveRequestSchema = z.object({
  _id: z.string().optional(),
  employee: z.string(),
  type: z.string(), // LeaveType ObjectId
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  isHalfDay: z.boolean().default(false),
  halfDayType: HalfDayTypeSchema.optional(),
  workingDays: z.number().positive(),
  reason: z.string().min(3).max(500),
  status: LeaveRequestStatusSchema.default("PENDING"),
  decidedBy: z.string().optional(),
  decidedAt: z.date().optional(),
  decisionNote: z.string().max(500).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;

export const CreateLeaveRequestInputSchema = z.object({
  type: z.string().min(1, "Leave type is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  isHalfDay: z.boolean().default(false),
  halfDayType: HalfDayTypeSchema.optional(),
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});
export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestInputSchema>;

export const DecideLeaveRequestInputSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().max(500).optional(),
});
export type DecideLeaveRequestInput = z.infer<typeof DecideLeaveRequestInputSchema>;

