import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";

export interface CustomRateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  skipFailedRequests?: boolean;
}

export const createRateLimiter = (options: CustomRateLimiterOptions = {}) => {
  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = isTest ? 10000 : (options.max ?? env.RATE_LIMIT_MAX);
  const message = options.message ?? "Too many requests. Please try again later.";

  return rateLimit({
    windowMs,
    max,
    skip: () => isTest,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response) => {
      throw new AppError(429, ApiErrorCode.ERR_BAD_REQUEST, message, {
        retryAfterMs: windowMs,
      });
    },
    ...options,
  } as Partial<Options>);
};

// Global rate limiter applied to all /api routes
export const globalRateLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: "Global rate limit exceeded. Please throttle requests.",
});

// Stricter rate limiter for sensitive authentication & OTP endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute
  message: "Too many authentication attempts. Please try again in 1 minute.",
});
