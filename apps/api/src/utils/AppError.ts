import { ApiErrorCode, ApiErrorCodeType } from "@vorldx/shared";

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCodeType;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;
  public readonly isAppError: boolean = true;

  constructor(
    statusCode: number,
    code: ApiErrorCodeType = ApiErrorCode.ERR_BAD_REQUEST,
    message: string,
    errors?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = isOperational;
    this.isAppError = true;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(
    message: string,
    code: ApiErrorCodeType = ApiErrorCode.ERR_BAD_REQUEST,
    errors?: unknown
  ): AppError {
    return new AppError(400, code, message, errors);
  }

  static unauthorized(
    message = "Authentication required",
    code: ApiErrorCodeType = ApiErrorCode.ERR_UNAUTHORIZED
  ): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(
    message = "Access denied",
    code: ApiErrorCodeType = ApiErrorCode.ERR_FORBIDDEN
  ): AppError {
    return new AppError(403, code, message);
  }

  static notFound(
    message = "Requested resource not found",
    code: ApiErrorCodeType = ApiErrorCode.ERR_NOT_FOUND
  ): AppError {
    return new AppError(404, code, message);
  }

  static conflict(
    message: string,
    code: ApiErrorCodeType = ApiErrorCode.ERR_BAD_REQUEST
  ): AppError {
    return new AppError(409, code, message);
  }

  static internal(message = "Internal server error", errors?: unknown): AppError {
    return new AppError(500, ApiErrorCode.ERR_INTERNAL_SERVER, message, errors, false);
  }
}
