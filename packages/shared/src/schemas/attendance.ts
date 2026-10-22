import { z } from "zod";
import { AttendanceStatus, PunchType } from "../constants/enums";

export const PunchRequestSchema = z.object({
  qrPayload: z.string().min(1, "QR payload string is required"),
});

export type PunchRequest = z.infer<typeof PunchRequestSchema>;

export const AttendanceScanRequestSchema = z
  .object({
    token: z.string().trim().min(1).optional(),
    qrPayload: z.string().trim().min(1).optional(),
    action: z.enum(["CHECK_IN", "CHECK_OUT"]).optional(),
    simulatedNow: z.string().optional(),
  })
  .refine((data) => data.token || data.qrPayload, {
    message: "Either token or qrPayload is required",
    path: ["token"],
  });

export type AttendanceScanRequest = z.infer<typeof AttendanceScanRequestSchema>;

export const AttendanceRecordSchema = z.object({
  _id: z.string(),
  employeeId: z.string(),
  departmentId: z.string().optional(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD"),
  checkInTime: z.string().datetime().nullable(),
  checkOutTime: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nonnegative().default(0),
  status: z.nativeEnum(AttendanceStatus),
  isLate: z.boolean().default(false),
  lateMinutes: z.number().int().nonnegative().default(0),
  isMissingCheckout: z.boolean().default(false),
  isManuallyCorrected: z.boolean().default(false),
  terminalId: z.string().optional(),
  systemNotes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

export const AttendanceTodayResponseSchema = z.object({
  success: z.boolean(),
  dateKey: z.string(),
  hasPunched: z.boolean(),
  punchType: z.nativeEnum(PunchType).optional(),
  status: z.nativeEnum(AttendanceStatus),
  checkInTime: z.string().datetime().nullable().optional(),
  checkOutTime: z.string().datetime().nullable().optional(),
  durationMinutes: z.number().int().nonnegative().default(0),
  isLate: z.boolean().default(false),
  shift: z
    .object({
      name: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      graceMinutes: z.number().int(),
    })
    .optional(),
});

export type AttendanceTodayResponse = z.infer<typeof AttendanceTodayResponseSchema>;

export const AttendanceHistoryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(AttendanceStatus).optional(),
});

export type AttendanceHistoryQuery = z.infer<typeof AttendanceHistoryQuerySchema>;

export const AttendanceStatsResponseSchema = z.object({
  month: z.string(),
  totalWorkingDays: z.number().int().nonnegative(),
  presentDays: z.number().int().nonnegative(),
  lateDays: z.number().int().nonnegative(),
  wfhDays: z.number().int().nonnegative(),
  attendancePercentage: z.number().min(0).max(100),
  wfhRemainingQuota: z.number().int().nonnegative(),
});

export type AttendanceStatsResponse = z.infer<typeof AttendanceStatsResponseSchema>;

export const AttendanceFilterQuerySchema = z.object({
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
  employee: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  workType: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["dateKey", "createdAt", "employeeId", "status"]).default("dateKey"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AttendanceFilterQuery = z.infer<typeof AttendanceFilterQuerySchema>;

export const AttendanceCorrectionRequestSchema = z
  .object({
    status: z.nativeEnum(AttendanceStatus).optional(),
    checkInTime: z.string().datetime().nullable().optional(),
    checkOutTime: z.string().datetime().nullable().optional(),
    reason: z
      .string()
      .min(5, "Justification reason must be at least 5 characters")
      .max(500, "Justification reason cannot exceed 500 characters")
      .trim(),
    isLate: z.boolean().optional(),
    isMissingCheckout: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.checkInTime && data.checkOutTime) {
        return new Date(data.checkOutTime).getTime() > new Date(data.checkInTime).getTime();
      }
      return true;
    },
    {
      message: "Check-out time must be strictly after check-in time",
      path: ["checkOutTime"],
    }
  );

export type AttendanceCorrectionRequest = z.infer<typeof AttendanceCorrectionRequestSchema>;

export const AbsenceEvaluationJobRequestSchema = z.object({
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
    .optional(),
  force: z.boolean().default(false),
  simulatedNow: z.string().optional(),
});

export type AbsenceEvaluationJobRequest = z.infer<typeof AbsenceEvaluationJobRequestSchema>;
