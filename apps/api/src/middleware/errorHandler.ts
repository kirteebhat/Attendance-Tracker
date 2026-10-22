import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, ApiErrorCodeType } from "@vorldx/shared";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.id || `req_${Date.now()}`;
  let statusCode = 500;
  let code: ApiErrorCodeType = ApiErrorCode.ERR_INTERNAL_SERVER;
  let message = "An internal server error occurred.";
  let errors: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    errors = err.errors;
  } else if (err.name === "ZodError") {
    statusCode = 400;
    code = ApiErrorCode.ERR_INVALID_INPUT;
    message = "Request validation failed";
    errors = (err as unknown as { errors: unknown }).errors;
  } else if (err.name === "CastError") {
    statusCode = 400;
    code = ApiErrorCode.ERR_INVALID_INPUT;
    message = "Resource identifier format is invalid.";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    code = ApiErrorCode.ERR_INVALID_INPUT;
    message = err.message;
  } else if ((err as unknown as { code: number }).code === 11000) {
    statusCode = 409;
    code = ApiErrorCode.ERR_BAD_REQUEST;
    message = "Duplicate key violation. An identical resource already exists.";
  }

  // Log server errors (500) as errors, client errors (4xx) as warnings
  if (statusCode >= 500) {
    logger.error(
      `Server Error: ${err.message}`,
      {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
      },
      requestId
    );
  } else {
    logger.warn(
      `Client Error (${statusCode}): ${message}`,
      {
        code,
        url: req.originalUrl,
        method: req.method,
        errors,
      },
      requestId
    );
  }

  res.status(statusCode).json({
    success: false,
    code,
    message,
    ...(errors !== undefined ? { errors } : {}),
    requestId,
    timestamp: new Date().toISOString(),
    ...(env.NODE_ENV === "development" && err.stack ? { stack: err.stack } : {}),
  });
};
