import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

const READY_STATES: Record<number, "disconnected" | "connected" | "connecting" | "disconnecting"> =
  {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

export interface DatabaseStatus {
  status: "connected" | "disconnected" | "connecting" | "disconnecting";
  readyState: number;
  host?: string;
  name?: string;
}

export async function connectDatabase(customUri?: string): Promise<typeof mongoose> {
  const uri = customUri || env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });

    logger.info(
      `MongoDB connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`
    );
    return conn;
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    if (env.NODE_ENV !== "test") {
      throw error;
    }
    return mongoose;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected successfully");
  }
}

export function getDatabaseStatus(): DatabaseStatus {
  const state = mongoose.connection.readyState;
  return {
    status: READY_STATES[state] || "disconnected",
    readyState: state,
    host: mongoose.connection.host || undefined,
    name: mongoose.connection.name || undefined,
  };
}

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB connection lost");
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB connection re-established");
});

mongoose.connection.on("error", (err) => {
  logger.error("MongoDB connection error:", err);
});
