import { Router } from "express";
import { staffAuthController } from "../controllers/staffAuth.controller";
import { validate } from "../middleware/validate";
import { authenticate, requireRole, authenticateStaffSession } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimiter";
import {
  StaffOtpStartInputSchema,
  StaffOtpVerifyInputSchema,
  UserRole,
} from "@vorldx/shared";

const router = Router();

/**
 * @route   POST /api/auth/staff/otp-start
 * @alias   POST /api/auth/staff/login-request
 * @desc    Request a 6-digit SMS OTP for staff authentication (Admin / HR)
 * @access  Public (Rate-limited, Enumeration-safe)
 */
router.post(
  "/api/auth/staff/otp-start",
  authRateLimiter,
  validate({ body: StaffOtpStartInputSchema }),
  staffAuthController.requestOtp
);

router.post(
  "/api/auth/staff/login-request",
  authRateLimiter,
  validate({ body: StaffOtpStartInputSchema }),
  staffAuthController.requestOtp
);

/**
 * @route   POST /api/auth/staff/otp-verify
 * @alias   POST /api/auth/staff/login-verify
 * @desc    Verify SMS OTP, recognize trusted hardware, establish staff session
 * @access  Public (Rate-limited, Lockout-protected)
 */
router.post(
  "/api/auth/staff/otp-verify",
  authRateLimiter,
  validate({ body: StaffOtpVerifyInputSchema }),
  staffAuthController.verifyOtp
);

router.post(
  "/api/auth/staff/login-verify",
  authRateLimiter,
  validate({ body: StaffOtpVerifyInputSchema }),
  staffAuthController.verifyOtp
);

/**
 * @route   GET /api/auth/staff/sessions
 * @desc    List all active sessions for currently authenticated staff member
 * @access  Protected (HR, ADMIN)
 */
router.get(
  "/api/auth/staff/sessions",
  authenticate,
  authenticateStaffSession,
  requireRole(UserRole.HR_ADMIN, UserRole.ADMIN, "HR"),
  staffAuthController.listSessions
);

/**
 * @route   DELETE /api/auth/staff/sessions/:id
 * @desc    Revoke a specific active session
 * @access  Protected (HR, ADMIN)
 */
router.delete(
  "/api/auth/staff/sessions/:id",
  authenticate,
  authenticateStaffSession,
  requireRole(UserRole.HR_ADMIN, UserRole.ADMIN, "HR"),
  staffAuthController.revokeSession
);

/**
 * @route   POST /api/auth/staff/sessions/revoke-all
 * @desc    Revoke all active sessions for currently authenticated staff member
 * @access  Protected (HR, ADMIN)
 */
router.post(
  "/api/auth/staff/sessions/revoke-all",
  authenticate,
  authenticateStaffSession,
  requireRole(UserRole.HR_ADMIN, UserRole.ADMIN, "HR"),
  staffAuthController.revokeAllSessions
);

/**
 * @route   POST /api/auth/staff/force-logout/:userId
 * @desc    Administrative forced termination of another staff/HR account's sessions
 * @access  Protected (ADMIN only)
 */
router.post(
  "/api/auth/staff/force-logout/:userId",
  authenticate,
  authenticateStaffSession,
  requireRole(UserRole.ADMIN),
  staffAuthController.forceLogoutStaff
);

/**
 * @route   GET /api/auth/staff/devices
 * @desc    List all trusted devices registered to the current staff user
 * @access  Protected (HR, ADMIN)
 */
router.get(
  "/api/auth/staff/devices",
  authenticate,
  authenticateStaffSession,
  requireRole(UserRole.HR_ADMIN, UserRole.ADMIN, "HR"),
  staffAuthController.listTrustedDevices
);

/**
 * @route   DELETE /api/auth/staff/devices/:id
 * @desc    Revoke trust for a hardware device and kill linked sessions
 * @access  Protected (HR, ADMIN)
 */
router.delete(
  "/api/auth/staff/devices/:id",
  authenticate,
  authenticateStaffSession,
  requireRole(UserRole.HR_ADMIN, UserRole.ADMIN, "HR"),
  staffAuthController.revokeTrustedDevice
);

export default router;
