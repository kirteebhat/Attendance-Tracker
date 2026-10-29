import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { DashboardSummaryQuerySchema, LiveAnalyticsQuerySchema, UserRole } from "@vorldx/shared";

const router = Router();

// Dashboard summary requires HR or Admin role
router.use(authenticate);
router.use(requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN));

router.get(
  "/summary",
  validate({ query: DashboardSummaryQuerySchema }),
  dashboardController.getDashboardSummary
);

router.get(
  "/analytics",
  validate({ query: LiveAnalyticsQuerySchema }),
  analyticsController.getLiveAnalytics
);

router.get(
  "/live-analytics",
  validate({ query: LiveAnalyticsQuerySchema }),
  analyticsController.getLiveAnalytics
);

router.get(
  "/",
  validate({ query: DashboardSummaryQuerySchema }),
  dashboardController.getDashboardSummary
);

export const dashboardRouter = router;
export default router;
