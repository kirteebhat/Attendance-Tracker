import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, ApiErrorCode.ERR_NOT_FOUND, `Cannot ${req.method} ${req.originalUrl}`));
};
