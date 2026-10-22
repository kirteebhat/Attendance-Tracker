import { createServer, Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { logger } from "./utils/logger";
import { startAbsenceCronJob, stopAbsenceCronJob } from "./jobs/absence.cron";
import { initSocketServer, closeSocketServer } from "./sockets/socketServer";

let httpServer: HttpServer;
let io: SocketIOServer;

export async function startServer(): Promise<{ httpServer: HttpServer; io: SocketIOServer }> {
  // Connect to persistent MongoDB database
  try {
    await connectDatabase();
  } catch (err) {
    logger.error(
      "Initial MongoDB connection failed. Server will continue with degraded health status.",
      err
    );
  }

  httpServer = createServer(app);
  io = initSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`[VorldX Attendance API] Running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  // Start automated absence cutoff evaluation cron job
  startAbsenceCronJob().catch((err) => {
    logger.error("Failed to start absence cron job:", err);
  });

  setupGracefulShutdown();

  return { httpServer, io };
}

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    // 1. Close HTTP server and stop accepting new connections
    if (httpServer) {
      httpServer.close((err) => {
        if (err) {
          logger.error("Error while closing HTTP server:", err);
        } else {
          logger.info("HTTP server closed cleanly.");
        }
      });
    }

    // 2. Close Socket.io server
    await closeSocketServer();
    logger.info("Socket.io server closed cleanly.");

    // 3. Stop absence cron job
    stopAbsenceCronJob();

    // 4. Disconnect MongoDB
    try {
      await disconnectDatabase();
    } catch (err) {
      logger.error("Error disconnecting MongoDB:", err);
    }

    logger.info("Graceful shutdown completed. Exiting process.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Start the server directly if executed as main module
if (process.env.NODE_ENV !== "test" && require.main === module) {
  startServer().catch((error) => {
    logger.error("Fatal startup error:", error);
    process.exit(1);
  });
}

export { httpServer, io };
