import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import staffAuthRoutes from "./staffAuth.routes";
import employeeRoutes from "./employee.routes";
import policyRoutes from "./policy.routes";
import { qrRouter } from "./qr.routes";
import { attendanceRouter } from "./attendance.routes";
import { wfhRouter } from "./wfh.routes";
import { dashboardRouter } from "./dashboard.routes";
import { reportRouter } from "./report.routes";
import { auditRouter } from "./audit.routes";
import { calendarRouter } from "./calendar.routes";
import featureFlagRoutes from "./featureFlag.routes";
import extensionRoutes from "./extension.routes";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, UserRole } from "@vorldx/shared";
import { validate } from "../middleware/validate";
import { authenticate, requireRole } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Root health check endpoint
router.use(healthRoutes);

// Core Authentication & Session endpoints
router.use(authRoutes);
router.use(staffAuthRoutes);

// Employee Management & Directory endpoints
router.use(employeeRoutes);

// Attendance Policy & Holiday endpoints
router.use(policyRoutes);

// Calendar & Corporate Events Engine
router.use("/api/calendar", calendarRouter);
router.use("/calendar", calendarRouter);

// Office QR Display & Terminal endpoints (supports both /api/displays and /api/terminals)
router.use("/api/displays", qrRouter);
router.use("/api/terminals", qrRouter);

// Attendance Punch & Metrics endpoints (supports /attendance, /api/attendance, /api/admin/attendance)
router.use("/attendance", attendanceRouter);
router.use("/api/attendance", attendanceRouter);
router.use("/api/admin/attendance", attendanceRouter);

// Work From Home (WFH) endpoints (supports /api/wfh, /wfh, and /api/admin/wfh)
router.use("/api/wfh", wfhRouter);
router.use("/wfh", wfhRouter);
router.use("/api/admin/wfh", wfhRouter);

// Executive Dashboard Summary endpoints
router.use("/dashboard", dashboardRouter);
router.use("/api/dashboard", dashboardRouter);
router.use("/api/admin/dashboard", dashboardRouter);

// Reporting & CSV Export endpoints
router.use("/reports", reportRouter);
router.use("/api/reports", reportRouter);
router.use("/api/admin/reports", reportRouter);

// Audit Logging & Compliance endpoints
router.use("/audit-logs", auditRouter);
router.use("/api/audit-logs", auditRouter);
router.use("/api/admin/audit-logs", auditRouter);

// Feature Flags & Extension endpoints
router.use("/api", featureFlagRoutes);
router.use("/api", extensionRoutes);

// Test routes for integration verification (active in non-production)
if (process.env.NODE_ENV !== "production") {
  router.get(
    "/api/test-protected-hr",
    authenticate,
    requireRole(UserRole.HR, UserRole.ADMIN),
    (req, res) => {
      res.json({ success: true, message: "HR route accessed successfully", user: req.user });
    }
  );

  router.get("/api/test-error", () => {
    throw AppError.badRequest(
      "Simulated domain error for test verification",
      ApiErrorCode.ERR_BAD_REQUEST,
      {
        detail: "Test error details",
      }
    );
  });

  router.post(
    "/api/test-validation",
    validate({
      body: z.object({
        employeeId: z.string().min(3),
        email: z.string().email(),
      }),
    }),
    (req, res) => {
      res.json({ success: true, data: req.body });
    }
  );
}

export default router;
