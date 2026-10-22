import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ReportFilterQuerySchema, WfhReportFilterQuerySchema, UserRole } from "@vorldx/shared";

const router = Router();

// All reporting endpoints require HR or Admin role
router.use(authenticate);
router.use(requireRole(UserRole.HR, UserRole.ADMIN));

// 1. Attendance Summary Report
router.get(
  "/attendance",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getAttendanceSummaryReport
);
router.get(
  "/attendance/export",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getAttendanceSummaryReport
);

// 2. Employee-wise Report
router.get(
  "/employee-wise",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getEmployeeWiseReport
);
router.get(
  "/employee-wise/export",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getEmployeeWiseReport
);

// 3. Department-wise Report
router.get(
  "/department-wise",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getDepartmentWiseReport
);
router.get(
  "/department-wise/export",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getDepartmentWiseReport
);

// 4. Late Arrivals Report
router.get("/late", validate({ query: ReportFilterQuerySchema }), reportController.getLateReport);
router.get(
  "/late/export",
  validate({ query: ReportFilterQuerySchema }),
  reportController.getLateReport
);

// 5. WFH Utilization Report
router.get("/wfh", validate({ query: WfhReportFilterQuerySchema }), reportController.getWfhReport);
router.get(
  "/wfh/export",
  validate({ query: WfhReportFilterQuerySchema }),
  reportController.getWfhReport
);

export const reportRouter = router;
export default router;
