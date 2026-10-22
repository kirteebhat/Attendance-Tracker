import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = req.id;

  // Log on request start
  logger.info(
    `HTTP ${req.method} ${req.originalUrl}`,
    {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      body: req.body,
      query: req.query,
    },
    requestId
  );

  // Hook into response finish event
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const logMethod =
      statusCode >= 500 ? logger.error : statusCode >= 400 ? logger.warn : logger.info;

    logMethod.call(
      logger,
      `HTTP ${req.method} ${req.originalUrl} responded with ${statusCode} in ${duration}ms`,
      {
        method: req.method,
        url: req.originalUrl,
        statusCode,
        durationMs: duration,
      },
      requestId
    );
  });

  next();
};
