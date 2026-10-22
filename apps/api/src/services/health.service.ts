import { getDatabaseStatus, DatabaseStatus } from "../config/database";
import { env } from "../config/env";

export interface HealthCheckResult {
  status: "ok" | "degraded";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  database: DatabaseStatus;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export class HealthService {
  static getHealth(): HealthCheckResult {
    const dbStatus = getDatabaseStatus();
    const isDegraded = dbStatus.status !== "connected";
    const memory = process.memoryUsage();

    return {
      status: isDegraded ? "degraded" : "ok",
      service: "vorldx-attendance-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      database: dbStatus,
      memory: {
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
      },
    };
  }
}
