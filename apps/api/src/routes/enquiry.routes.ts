import { Router } from "express";
import { enquiryController } from "../controllers/enquiry.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { requireFeatureFlag } from "../middleware/featureFlag";
import { validate } from "../middleware/validate";
import { UserRole } from "@vorldx/shared";
import {
  CreateEnquiryInputSchema,
  SendEnquiryMessageInputSchema,
  UpdateEnquiryStatusInputSchema,
  AssignEnquiryInputSchema,
  ReopenEnquiryInputSchema,
} from "@vorldx/shared";

const router = Router();

// Guard entire module with the 'enquiries' feature flag
router.use(requireFeatureFlag("enquiries"));

// All enquiry operations require authentication
router.use(authenticate);

// Create new enquiry
router.post(
  "/",
  validate({ body: CreateEnquiryInputSchema }),
  enquiryController.create
);

// List enquiries (scoped by role: employee sees own, HR/admin sees all)
router.get("/", enquiryController.list);

// Get enquiry details & conversation thread
router.get("/:id", enquiryController.getById);

// Send message / reply in enquiry thread
router.post(
  "/:id/messages",
  validate({ body: SendEnquiryMessageInputSchema }),
  enquiryController.addMessage
);

// Update status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
router.patch(
  "/:id/status",
  validate({ body: UpdateEnquiryStatusInputSchema }),
  enquiryController.updateStatus
);

// Reopen a resolved or closed enquiry (enforces 7-day reopen window)
router.post(
  "/:id/reopen",
  validate({ body: ReopenEnquiryInputSchema }),
  enquiryController.reopen
);

// Assign or reassign ticket (HR & Admin only)
router.patch(
  "/:id/assign",
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: AssignEnquiryInputSchema }),
  enquiryController.assign
);

export const enquiryRouter = router;
export default router;
