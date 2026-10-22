import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as attendanceService from "../services/attendance.service";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, AttendanceStatus } from "@vorldx/shared";

/**
 * POST /attendance/scan (and /api/attendance/scan, /api/attendance/punch)
 * Scans a dynamic QR token to record employee arrival or departure.
 */
export const scanAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(
      401,
      ApiErrorCode.ERR_UNAUTHORIZED,
      "Authentication required to punch attendance."
    );
  }

  const simulatedNow = req.body.simulatedNow ? new Date(req.body.simulatedNow) : undefined;

  const result = await attendanceService.scanAttendance(req.user.userId, {
    token: req.body.token,
    qrPayload: req.body.qrPayload,
    action: req.body.action,
    simulatedNow,
  });

  res.status(200).json(result);
});

/**
 * GET /attendance/today (and /api/attendance/today)
 * Retrieves today's current punch card status for the authenticated employee.
 */
export const getTodayAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const simulatedNow = req.query.simulatedNow
    ? new Date(req.query.simulatedNow as string)
    : undefined;

  const result = await attendanceService.getTodayAttendance(req.user.userId, simulatedNow);

  res.status(200).json(result);
});

/**
 * GET /attendance/me (and /api/attendance/me)
 * Retrieves personal attendance history, date/month filtering, and calculated aggregate statistics.
 */
export const getMyAttendanceHistory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const query = {
    month: req.query.month as string | undefined,
    dateKey: req.query.dateKey as string | undefined,
    status: req.query.status as AttendanceStatus | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  };

  const result = await attendanceService.getMyAttendanceHistory(req.user.userId, query);

  res.status(200).json(result);
});

/**
 * GET /attendance (and /api/attendance)
 * HR/Admin: Retrieves organization-wide attendance ledger with multi-column filtering, search, and pagination.
 */
export const listAttendanceRecords = asyncHandler(async (req: Request, res: Response) => {
  const query = {
    startDate: (req.query.startDate || req.query.from) as string | undefined,
    endDate: (req.query.endDate || req.query.to) as string | undefined,
    dateKey: req.query.dateKey as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    department: req.query.department as string | undefined,
    employee: req.query.employee as string | undefined,
    employeeId: req.query.employeeId as string | undefined,
    status: req.query.status as AttendanceStatus | undefined,
    workType: req.query.workType as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    sortBy:
      (req.query.sortBy as "dateKey" | "createdAt" | "employeeId" | "status" | undefined) ||
      "dateKey",
    sortOrder: (req.query.sortOrder as "asc" | "desc" | undefined) || "desc",
  };

  const result = await attendanceService.listAttendanceRecords(query);
  res.status(200).json(result);
});

/**
 * PATCH /attendance/:id (and /attendance/:id/correct, /api/attendance/:id, /api/attendance/:id/correct)
 * HR/Admin: Manually corrects an attendance record with mandatory reason, validation, recalculation, and audit log.
 */
export const correctAttendanceRecord = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const actor = {
    userId: req.user.userId,
    employeeId: req.user.employeeId,
    role: req.user.role,
  };

  const result = await attendanceService.correctAttendanceRecord(req.params.id, req.body, actor);

  res.status(200).json(result);
});

/**
 * POST /attendance/jobs/evaluate-day (and /api/attendance/jobs/evaluate-day, /api/admin/attendance/evaluate)
 * Admin only: Triggers automated absence and incomplete checkout evaluation (for scheduled cron and demos).
 */
export const runAbsenceEvaluationJob = asyncHandler(async (req: Request, res: Response) => {
  const dateKey = req.body.dateKey || (req.query.dateKey as string | undefined);
  const force = req.body.force === true || req.query.force === "true";
  const simulatedNow = req.body.simulatedNow
    ? new Date(req.body.simulatedNow)
    : req.query.simulatedNow
      ? new Date(req.query.simulatedNow as string)
      : undefined;

  const result = await attendanceService.evaluateAbsenceAndIncompleteJob(dateKey, {
    force,
    simulatedNow,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});
