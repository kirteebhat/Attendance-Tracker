import { Router } from "express";
import * as wfhController from "../controllers/wfh.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { WfhCreateRequestSchema, WfhReviewRequestSchema, UserRole } from "@vorldx/shared";

const router = Router();

// All WFH endpoints require authentication
router.use(authenticate);

// ==========================================
// Employee WFH Endpoints
// ==========================================

// Check eligibility
router.get("/eligibility", wfhController.checkEligibility);

// Submit a new WFH request
router.post("/requests", validate({ body: WfhCreateRequestSchema }), wfhController.createRequest);
router.post("/", validate({ body: WfhCreateRequestSchema }), wfhController.createRequest);

// List own requests
router.get("/my-requests", wfhController.listMyRequests);
router.get("/me", wfhController.listMyRequests);

// Cancel a pending request
router.patch("/requests/:id/cancel", wfhController.cancelRequest);
router.post("/requests/:id/cancel", wfhController.cancelRequest);

// ==========================================
// HR / Admin Review Endpoints
// ==========================================

// List all requests with filters (HR/Admin)
router.get(
  "/admin/requests",
  requireRole(UserRole.HR, UserRole.ADMIN),
  wfhController.listAllRequests
);

// Review (Approve or Reject) a WFH request (HR/Admin)
router.patch(
  "/requests/:id/review",
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: WfhReviewRequestSchema }),
  wfhController.reviewRequest
);

router.post(
  "/requests/:id/review",
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: WfhReviewRequestSchema }),
  wfhController.reviewRequest
);

export const wfhRouter = router;
export default router;
