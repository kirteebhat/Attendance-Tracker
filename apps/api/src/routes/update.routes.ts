import { Router } from "express";
import { updateController } from "../controllers/update.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { requireFeatureFlag } from "../middleware/featureFlag";
import { validate } from "../middleware/validate";
import { UserRole, CreateAppReleaseInputSchema } from "@vorldx/shared";

const router = Router();

// Public / Client check endpoints (check update, current deployment version)
router.get("/check", updateController.checkUpdate);
router.get("/version", updateController.getVersion);

// Administrative routes
router.get(
  "/releases",
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.HR),
  updateController.listReleases
);

router.post(
  "/releases",
  authenticate,
  requireRole(UserRole.ADMIN),
  requireFeatureFlag("otaUpdates"),
  validate({ body: CreateAppReleaseInputSchema }),
  updateController.publishRelease
);

router.delete(
  "/releases/:id",
  authenticate,
  requireRole(UserRole.ADMIN),
  requireFeatureFlag("otaUpdates"),
  updateController.deleteRelease
);

export const updateRouter = router;
export default router;
