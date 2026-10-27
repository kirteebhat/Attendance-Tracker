import { Router } from "express";
import { featureFlagController } from "../controllers/featureFlag.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { UserRole } from "@vorldx/shared";

const router = Router();

// Public / client endpoint to read active feature flags
router.get("/feature-flags", featureFlagController.getFlags);

// Admin-only inspection of feature flags metadata
router.get(
  "/admin/feature-flags",
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.HR),
  featureFlagController.getFlagsDetailed
);

// Admin-only toggle of feature flags
router.patch(
  "/admin/feature-flags",
  authenticate,
  requireRole(UserRole.ADMIN),
  featureFlagController.updateFlag
);

export default router;
