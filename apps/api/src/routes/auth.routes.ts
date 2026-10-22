import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimiter";
import {
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  RegisterStartRequestSchema,
  RegisterVerifyRequestSchema,
  RegisterCompleteRequestSchema,
} from "@vorldx/shared";

const router = Router();

/**
 * @route   POST /api/auth/register-start
 * @desc    Initiate self-registration by generating a secure 6-digit OTP
 * @access  Public (Rate-limited)
 */
router.post(
  "/api/auth/register-start",
  authRateLimiter,
  validate({ body: RegisterStartRequestSchema }),
  authController.registerStart
);

/**
 * Backward compatibility alias for register-start
 */
router.post(
  "/api/auth/register",
  authRateLimiter,
  validate({ body: RegisterStartRequestSchema }),
  authController.registerStart
);

/**
 * @route   POST /api/auth/register-verify
 * @desc    Verify single-use OTP (with or without password)
 * @access  Public (Rate-limited)
 */
router.post(
  "/api/auth/register-verify",
  authRateLimiter,
  validate({ body: RegisterVerifyRequestSchema }),
  authController.registerVerify
);

/**
 * Backward compatibility alias for register-verify
 */
router.post(
  "/api/auth/verify-otp",
  authRateLimiter,
  validate({ body: RegisterVerifyRequestSchema }),
  authController.registerVerify
);

/**
 * @route   POST /api/auth/register-complete
 * @desc    Complete registration with verification token and set account password
 * @access  Public (Rate-limited)
 */
router.post(
  "/api/auth/register-complete",
  authRateLimiter,
  validate({ body: RegisterCompleteRequestSchema }),
  authController.registerComplete
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate employee/admin credentials and obtain JWT tokens
 * @access  Public
 */
router.post(
  "/api/auth/login",
  authRateLimiter,
  validate({ body: LoginRequestSchema }),
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rotate refresh token and issue new access token
 * @access  Public (Requires valid refresh token)
 */
router.post(
  "/api/auth/refresh",
  authRateLimiter,
  validate({ body: RefreshTokenRequestSchema }),
  authController.refresh
);

/**
 * @route   POST /api/auth/logout
 * @desc    Clear refresh token from database and wipe session cookie
 * @access  Public / Authenticated
 */
router.post("/api/auth/logout", authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve currently authenticated user and employee record
 * @access  Protected (Requires Bearer access token)
 */
router.get("/api/auth/me", authenticate, authController.getCurrentUser);

export default router;
