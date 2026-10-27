import { Request, Response, NextFunction } from "express";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, UserRole } from "@vorldx/shared";
import { TokenPayload } from "../services/auth.service";
import { User, StaffSession } from "../models";

// Module augmentation for Express Request to attach authenticated user payload
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Authentication middleware that verifies JWT access tokens.
 * Emits distinct error codes:
 * - ERR_TOKEN_EXPIRED (401) when access token has expired
 * - ERR_UNAUTHORIZED (401) when token is missing or malformed
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new AppError(401, ApiErrorCode.ERR_TOKEN_EXPIRED, "Access token has expired");
    }
    throw AppError.unauthorized(
      "Invalid or malformed authentication token",
      ApiErrorCode.ERR_UNAUTHORIZED
    );
  }
};

/**
 * Role-based access control middleware.
 * Supports roles: 'admin', 'hr', 'employee' (case-insensitive and enum-compatible).
 * Admins are granted implicit access to HR-protected endpoints.
 */
export const requireRole = (...allowedRoles: (UserRole | string)[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }

    const userRole = (req.user.role || "").toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    const isMatch =
      normalizedAllowed.includes(userRole) ||
      userRole === "ADMIN" ||
      (userRole === "HR_ADMIN" && normalizedAllowed.includes("HR")) ||
      (userRole === "HR" && normalizedAllowed.includes("HR_ADMIN"));

    if (!isMatch) {
      throw AppError.forbidden(
        `Access denied: required role in [${allowedRoles.join(", ")}], but current user role is ${req.user.role}`,
        ApiErrorCode.ERR_FORBIDDEN
      );
    }

    next();
  };
};

/**
 * Validates active staff session and confirms session has not been revoked or locked out
 */
export const authenticateStaffSession = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.status === "INACTIVE") {
      throw AppError.forbidden("Staff account is disabled", ApiErrorCode.ERR_FORBIDDEN);
    }

    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      throw new AppError(423, ApiErrorCode.ERR_ACCOUNT_LOCKED, "Account is currently locked");
    }

    // If all sessions were revoked, refreshTokenHash is cleared
    if (!user.refreshTokenHash) {
      throw new AppError(401, ApiErrorCode.ERR_SESSION_REVOKED, "Your session has been revoked. Please sign in again.");
    }

    const sessionId = req.headers["x-session-id"] as string;
    if (sessionId && Types.ObjectId.isValid(sessionId)) {
      const session = await StaffSession.findOne({
        _id: new Types.ObjectId(sessionId),
        user: user._id,
        isActive: true,
      });
      if (!session || session.expiresAt.getTime() < Date.now()) {
        throw new AppError(401, ApiErrorCode.ERR_SESSION_REVOKED, "This session has been revoked or expired.");
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};
