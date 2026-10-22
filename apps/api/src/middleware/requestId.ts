/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers["x-request-id"];
  const id =
    typeof existingId === "string" && existingId.trim().length > 0
      ? existingId
      : `req_${crypto.randomBytes(8).toString("hex")}`;

  req.id = id;
  res.setHeader("x-request-id", id);
  next();
};
