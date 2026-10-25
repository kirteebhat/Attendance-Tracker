import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { env } from "./config/env";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { globalRateLimiter } from "./middleware/rateLimiter";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes";

export function createApp(): Express {
  const app = express();

  // 1. Security HTTP Headers (relaxed CSP to allow Vite/React SPA assets)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Strict CORS Configuration from Environment
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-request-id",
        "x-terminal-id",
        "x-terminal-secret",
        "x-display-id",
        "x-display-credential",
      ],
      exposedHeaders: ["x-request-id"],
    })
  );

  // 3. Strict Request Size Limits & Cookie Parsing
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));
  app.use(cookieParser());

  // 4. Request ID Assignment
  app.use(requestIdMiddleware);

  // 5. Safe Structured Access Logger
  app.use(requestLogger);

  // 6. Global Rate Limiter for /api
  app.use("/api", globalRateLimiter);

  // 7. Core Application Routes
  app.use(routes);

  // 8. Serve HR Web Portal SPA if compiled dist exists
  const webDistPath = path.resolve(__dirname, "../../web/dist");
  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get("*", (req, res, next) => {
      // Don't intercept API, health, or WebSocket routes
      if (
        req.path.startsWith("/api") ||
        req.path.startsWith("/health") ||
        req.path.startsWith("/socket.io")
      ) {
        return next();
      }
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  // 9. 404 Route Handler
  app.use(notFoundHandler);

  // 9. Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
