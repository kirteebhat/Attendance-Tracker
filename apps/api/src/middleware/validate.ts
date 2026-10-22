import { Request, Response, NextFunction, RequestHandler } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";

export interface ValidationTarget {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate = (schemas: ValidationTarget): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        errors?: Array<{ path: (string | number)[]; message: string; code: string }>;
      };
      if (error instanceof ZodError || err?.name === "ZodError") {
        const issues = err.errors || [];
        const formattedErrors = issues.map((issue) => ({
          field: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || ""),
          message: issue.message,
          rule: issue.code,
        }));

        next(
          new AppError(
            400,
            ApiErrorCode.ERR_INVALID_INPUT,
            "Request validation failed",
            formattedErrors
          )
        );
      } else {
        next(error);
      }
    }
  };
};
