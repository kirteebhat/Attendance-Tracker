import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as dashboardService from "../services/dashboard.service";

/**
 * GET /dashboard/summary (and /api/dashboard/summary, /api/admin/dashboard/summary)
 * HR/Admin executive metrics, punctuality breakdown, 7/30-day trends, and recent activity.
 */
export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const result = await dashboardService.getDashboardSummary({
    dateKey: req.query.dateKey as string | undefined,
    simulatedNow: req.query.simulatedNow as string | undefined,
  });

  res.status(200).json(result);
});
