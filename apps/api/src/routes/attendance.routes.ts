import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  AttendanceScanRequestSchema,
  AttendanceCorrectionRequestSchema,
  AttendanceFilterQuerySchema,
  UserRole,
} from "@vorldx/shared";

const router = Router();

// All attendance routes require authentication
router.use(authenticate);

// ==========================================
// Employee / Public Attendance Endpoints
// ==========================================

// POST /attendance/scan & /attendance/punch
router.post(
  "/scan",
  requireRole(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN),
  validate({ body: AttendanceScanRequestSchema }),
  attendanceController.scanAttendance
);
router.post(
  "/punch",
  requireRole(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN),
  validate({ body: AttendanceScanRequestSchema }),
  attendanceController.scanAttendance
);

// GET /attendance/today
router.get(
  "/today",
  requireRole(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN),
  attendanceController.getTodayAttendance
);

// GET /attendance/me
router.get(
  "/me",
  requireRole(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN),
  attendanceController.getMyAttendanceHistory
);

// ==========================================
// HR / Admin Attendance Ledger & Corrections
// ==========================================

// GET /attendance - List records with filters, search, and pagination (HR/Admin only)
router.get(
  "/",
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ query: AttendanceFilterQuerySchema }),
  attendanceController.listAttendanceRecords
);

// PATCH /attendance/:id & /attendance/:id/correct - Manual administrative correction (HR/Admin only)
router.patch(
  "/:id/correct",
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: AttendanceCorrectionRequestSchema }),
  attendanceController.correctAttendanceRecord
);

router.patch(
  "/:id",
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: AttendanceCorrectionRequestSchema }),
  attendanceController.correctAttendanceRecord
);

// ==========================================
// Automated Job Manual Trigger (Admin only)
// ==========================================

// POST /attendance/jobs/evaluate-day (and /evaluate)
router.post(
  "/jobs/evaluate-day",
  requireRole(UserRole.ADMIN),
  attendanceController.runAbsenceEvaluationJob
);

router.post("/evaluate", requireRole(UserRole.ADMIN), attendanceController.runAbsenceEvaluationJob);

export const attendanceRouter = router;
export default router;
