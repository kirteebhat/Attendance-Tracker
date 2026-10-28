import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { LiveAnalyticsQuerySchema, UserRole } from "@vorldx/shared";

const router = Router();

// Live analytics requires HR or Admin authentication
router.use(authenticate);
router.use(requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN));

/**
 * @route   GET /api/analytics/live
 * @desc    Live workforce attendance metrics, hourly check-in distribution, 30-day heatmap, scan feed, and department breakdown
 * @access  HR / Admin
 */
router.get(
  "/live",
  validate({ query: LiveAnalyticsQuerySchema }),
  analyticsController.getLiveAnalytics
);

router.get(
  "/",
  validate({ query: LiveAnalyticsQuerySchema }),
  analyticsController.getLiveAnalytics
);

export const analyticsRouter = router;
export default router;

