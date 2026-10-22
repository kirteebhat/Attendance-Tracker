import { z } from "zod";

export const WfhRulesSchema = z.object({
  monthlyQuota: z.number().int().nonnegative().default(4),
  advanceNoticeDays: z.number().int().nonnegative().default(1),
  allowedDaysPerWeek: z.number().int().min(1).max(7).default(2),
  autoApproval: z.boolean().default(false),
});

export type WfhRules = z.infer<typeof WfhRulesSchema>;

export const ShiftSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(2).max(100),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  graceMinutes: z.number().int().min(0).max(60).default(15),
  checkInWindowStartMinutes: z.number().int().min(0).max(360).default(60),
  checkInWindowEndMinutes: z.number().int().min(0).max(360).default(180),
  checkOutWindowStartMinutes: z.number().int().min(0).max(360).default(60),
  checkOutWindowEndMinutes: z.number().int().min(0).max(360).default(180),
  isOvernight: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type Shift = z.infer<typeof ShiftSchema>;

export const AttendancePolicySchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(2).max(100).default("Default Company Attendance Policy"),
  version: z.number().int().positive().default(1),
  timezone: z.string().default("Asia/Kolkata"),
  defaultGraceMinutes: z.number().int().min(0).max(60).default(15),
  minFullDayHours: z.number().positive().default(8),
  minHalfDayHours: z.number().positive().default(4),
  monthlyWfhQuota: z.number().int().nonnegative().default(4),
  absenceEvaluationCutoffTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
    .default("23:59"),
  workdays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  wfhRules: WfhRulesSchema.default({}),
  shifts: z.array(ShiftSchema).default([]),
  qrRotationSeconds: z.number().int().min(10).max(120).default(30),
  qrGraceSeconds: z.number().int().min(5).max(60).default(15),
  punchCooldownMinutes: z.number().int().nonnegative().default(2),
  allowOvertime: z.boolean().default(false),
  isDefault: z.boolean().default(true),
});

export type AttendancePolicy = z.infer<typeof AttendancePolicySchema>;

export const PolicyUpdateSchema = AttendancePolicySchema.partial().extend({
  reason: z.string().trim().optional(),
});
export type PolicyUpdate = z.infer<typeof PolicyUpdateSchema>;

export const HolidayCreateSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD format"),
  description: z.string().max(500).trim().optional(),
  isRecurring: z.boolean().default(false),
});

export type HolidayCreate = z.infer<typeof HolidayCreateSchema>;

export const HolidayUpdateSchema = HolidayCreateSchema.partial();
export type HolidayUpdate = z.infer<typeof HolidayUpdateSchema>;
