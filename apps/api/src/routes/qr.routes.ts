import { Router } from "express";
import * as qrController from "../controllers/qr.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  DisplayRegisterSchema,
  DisplayPairSchema,
  DisplayStatusUpdateSchema,
  UserRole,
} from "@vorldx/shared";

const router = Router();

// ==========================================
// Kiosk / Terminal Endpoints (Display Auth)
// ==========================================

// Display pairs using one-time pairing code
router.post("/pair", validate({ body: DisplayPairSchema }), qrController.pairDisplay);

// Display requests rotating QR challenge
router.get("/token", qrController.requestRotatingToken);
router.post("/token", qrController.requestRotatingToken);
router.post("/challenge", qrController.requestRotatingToken);

// Token validation endpoint
router.post("/validate", qrController.validateToken);

// ==========================================
// HR / Admin Management Endpoints
// ==========================================

router.use(authenticate);
router.use(requireRole(UserRole.HR, UserRole.ADMIN));

// List all displays
router.get("/", qrController.listDisplays);

// Register a new display terminal
router.post("/", validate({ body: DisplayRegisterSchema }), qrController.registerDisplay);

// Get display by ID or terminalId
router.get("/:id", qrController.getDisplayById);

// Enable or disable display terminal
router.patch(
  "/:id/status",
  validate({ body: DisplayStatusUpdateSchema }),
  qrController.updateDisplayStatus
);
router.put(
  "/:id/status",
  validate({ body: DisplayStatusUpdateSchema }),
  qrController.updateDisplayStatus
);

// Reauthorize display terminal
router.post("/:id/authorize", qrController.authorizeDisplay);

// Revoke display terminal
router.post("/:id/revoke", qrController.revokeDisplay);
router.patch("/:id/revoke", qrController.revokeDisplay);

export const qrRouter = router;
