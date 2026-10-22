import { env } from "../config/env";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "otp",
  "verificationotp",
  "simulateddemootp",
  "demohelperotp",
  "hashedcode",
  "token",
  "jwt",
  "secret",
  "terminalsecret",
  "authorization",
  "cookie",
  "accesstoken",
  "refreshtoken",
]);

/**
 * Recursively redacts sensitive fields from objects before logging
 */
export function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Attempt to parse stringified JSON
    if (data.startsWith("{") || data.startsWith("[")) {
      try {
        const parsed = JSON.parse(data);
        return sanitizeData(parsed);
      } catch {
        return data;
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }

  return data;
}

export interface LogPayload {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  requestId?: string;
  meta?: unknown;
  timestamp: string;
}

class SafeLogger {
  private formatLog(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    meta?: unknown,
    requestId?: string
  ): LogPayload {
    return {
      level,
      message,
      requestId,
      meta: meta ? sanitizeData(meta) : undefined,
      timestamp: new Date().toISOString(),
    };
  }

  info(message: string, meta?: unknown, requestId?: string): void {
    const payload = this.formatLog("info", message, meta, requestId);
    if (env.NODE_ENV === "test") return;
    console.log(JSON.stringify(payload));
  }

  warn(message: string, meta?: unknown, requestId?: string): void {
    const payload = this.formatLog("warn", message, meta, requestId);
    if (env.NODE_ENV === "test") return;
    console.warn(JSON.stringify(payload));
  }

  error(message: string, meta?: unknown, requestId?: string): void {
    const payload = this.formatLog("error", message, meta, requestId);
    if (env.NODE_ENV === "test") return;
    console.error(JSON.stringify(payload));
  }

  debug(message: string, meta?: unknown, requestId?: string): void {
    if (env.NODE_ENV !== "development") return;
    const payload = this.formatLog("debug", message, meta, requestId);
    console.debug(JSON.stringify(payload));
  }
}

export const logger = new SafeLogger();
