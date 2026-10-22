import { Router } from "express";
import { policyController } from "../controllers/policy.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  PolicyUpdateSchema,
  HolidayCreateSchema,
  HolidayUpdateSchema,
  UserRole,
} from "@vorldx/shared";

const router = Router();

// ==========================================
// Attendance Policy Endpoints
// ==========================================

/**
 * @route   GET /api/policy
 * @desc    Get active attendance policy, configured shifts, workdays, grace period, and WFH rules
 * @access  Protected (All authenticated users)
 */
router.get("/api/policy", authenticate, policyController.getPolicy);

/**
 * @route   PATCH /api/policy
 * @desc    Update active attendance policy configuration, increment version, and record AuditEvent
 * @access  Protected (HR & Admin only)
 */
router.patch(
  "/api/policy",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: PolicyUpdateSchema }),
  policyController.updatePolicy
);

router.put(
  "/api/policy",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: PolicyUpdateSchema }),
  policyController.updatePolicy
);

// ==========================================
// Holiday Management Endpoints
// ==========================================

/**
 * @route   GET /api/holidays
 * @desc    List official company holidays
 * @access  Protected (All authenticated users)
 */
router.get("/api/holidays", authenticate, policyController.listHolidays);

/**
 * @route   GET /api/holidays/:id
 * @desc    Get holiday by ID or dateKey
 * @access  Protected (All authenticated users)
 */
router.get("/api/holidays/:id", authenticate, policyController.getHolidayById);

/**
 * @route   POST /api/holidays
 * @desc    Add a company holiday with dateKey uniqueness and audit logging
 * @access  Protected (HR & Admin only)
 */
router.post(
  "/api/holidays",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: HolidayCreateSchema }),
  policyController.createHoliday
);

/**
 * @route   PATCH /api/holidays/:id
 * @desc    Update holiday details with audit logging
 * @access  Protected (HR & Admin only)
 */
router.patch(
  "/api/holidays/:id",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: HolidayUpdateSchema }),
  policyController.updateHoliday
);

/**
 * @route   DELETE /api/holidays/:id
 * @desc    Delete holiday with audit logging
 * @access  Protected (HR & Admin only)
 */
router.delete(
  "/api/holidays/:id",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  policyController.deleteHoliday
);

export default router;
