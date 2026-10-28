import { Router } from "express";
import { leaveController } from "../controllers/leave.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { requireFeatureFlag } from "../middleware/featureFlag";
import { validate } from "../middleware/validate";
import { UserRole } from "@vorldx/shared";
import {
  CreateLeaveTypeSchema,
  UpdateLeaveTypeSchema,
  CreateLeaveRequestInputSchema,
  DecideLeaveRequestInputSchema,
  BulkDecideLeaveRequestInputSchema,
  AdjustLeaveBalanceInputSchema,
  CarryForwardBalanceInputSchema,
  LeaveFilterQuerySchema,
} from "@vorldx/shared";

const router = Router();

// ============================================================================
// FEATURE FLAG PROTECTION: Entire leave subsystem is protected by 'leave' flag
// ============================================================================
router.use(requireFeatureFlag("leave"));
router.use(authenticate);

// ============================================================================
// 1. LEAVE TYPES CONFIGURATION (HR / ADMIN)
// ============================================================================

// List leave types (accessible to all authenticated users so employees can select)
router.get("/types", leaveController.listTypes);
router.get("/types/:id", leaveController.getTypeById);

// Create, update, deactivate leave types (HR & Admin only)
router.post(
  "/types",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: CreateLeaveTypeSchema }),
  leaveController.createType
);

router.patch(
  "/types/:id",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: UpdateLeaveTypeSchema }),
  leaveController.updateType
);

router.put(
  "/types/:id",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: UpdateLeaveTypeSchema }),
  leaveController.updateType
);

router.delete(
  "/types/:id",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  leaveController.deleteType
);

// ============================================================================
// 2. LEAVE BALANCES
// ============================================================================

// Employee own balances
router.get("/balances/my", leaveController.getMyBalances);
router.get("/my-balances", leaveController.getMyBalances);

// HR / Admin balances view and manual adjustment
router.get(
  "/balances",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  leaveController.listAllBalances
);

router.get(
  "/balances/employee/:employeeId",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  leaveController.getEmployeeBalances
);

router.post(
  "/balances/adjust",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: AdjustLeaveBalanceInputSchema }),
  leaveController.adjustBalance
);

router.post(
  "/balances/carry-forward",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: CarryForwardBalanceInputSchema }),
  leaveController.carryForward
);

// ============================================================================
// 3. LEAVE APPLICATIONS (EMPLOYEE)
// ============================================================================

// Apply for leave (single date, range, or half-day)
router.post(
  "/requests",
  validate({ body: CreateLeaveRequestInputSchema }),
  leaveController.applyLeave
);

// List own leave requests
router.get("/requests/my", leaveController.getMyRequests);
router.get("/my-requests", leaveController.getMyRequests);

// Cancel a pending or future approved leave request
router.post("/requests/:id/cancel", leaveController.cancelLeave);
router.patch("/requests/:id/cancel", leaveController.cancelLeave);
router.delete("/requests/:id", leaveController.cancelLeave);

// ============================================================================
// 4. HR / ADMIN DECISION WORKFLOW
// ============================================================================

// Review queue with multi-field filtering
router.get(
  "/requests",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ query: LeaveFilterQuerySchema }),
  leaveController.listRequests
);

// Single decision (Approve or Reject with optional note)
router.patch(
  "/requests/:id/decision",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: DecideLeaveRequestInputSchema }),
  leaveController.decideRequest
);

router.post(
  "/requests/:id/decide",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: DecideLeaveRequestInputSchema }),
  leaveController.decideRequest
);

router.post(
  "/requests/:id/review",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: DecideLeaveRequestInputSchema }),
  leaveController.decideRequest
);

// Bulk decision with per-item atomic results
router.post(
  "/requests/bulk-decision",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: BulkDecideLeaveRequestInputSchema }),
  leaveController.bulkDecide
);

router.post(
  "/requests/bulk-review",
  requireRole(UserRole.HR, UserRole.ADMIN, UserRole.HR_ADMIN),
  validate({ body: BulkDecideLeaveRequestInputSchema }),
  leaveController.bulkDecide
);

export const leaveRouter = router;
export default router;

