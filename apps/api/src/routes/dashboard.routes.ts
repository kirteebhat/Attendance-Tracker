import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { DashboardSummaryQuerySchema, UserRole } from "@vorldx/shared";

const router = Router();

// Dashboard summary requires HR or Admin role
router.use(authenticate);
router.use(requireRole(UserRole.HR, UserRole.ADMIN));

router.get(
  "/summary",
  validate({ query: DashboardSummaryQuerySchema }),
  dashboardController.getDashboardSummary
);

router.get(
  "/",
  validate({ query: DashboardSummaryQuerySchema }),
  dashboardController.getDashboardSummary
);

export const dashboardRouter = router;
export default router;
