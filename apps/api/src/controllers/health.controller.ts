import { Request, Response } from "express";
import { HealthService } from "../services/health.service";

export class HealthController {
  static getHealth(_req: Request, res: Response): void {
    const health = HealthService.getHealth();
    const statusCode = health.status === "ok" ? 200 : 200; // Return 200 with degraded indicator so orchestrators don't crash before DB boots
    res.status(statusCode).json(health);
  }
}
