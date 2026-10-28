import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getActiveHrPresence } from "../sockets/socketServer";

export const presenceRouter = Router();

/**
 * GET /api/presence/hr
 * Returns the currently active/connected HR users and total count.
 */
presenceRouter.get("/presence/hr", authenticate, (_req, res) => {
  const presence = getActiveHrPresence();
  res.json({
    success: true,
    data: presence,
  });
});

presenceRouter.get("/api/presence/hr", authenticate, (_req, res) => {
  const presence = getActiveHrPresence();
  res.json({
    success: true,
    data: presence,
  });
});

