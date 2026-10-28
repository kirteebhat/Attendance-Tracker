import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { analyticsService } from "../services/analytics.service";
import { LiveAnalyticsQuery } from "@vorldx/shared";

export class AnalyticsController {
  /**
   * GET /api/analytics/live
   * Live attendance analytics endpoint for dashboard, executive charts, and real-time feeds.
   */
  public getLiveAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const query: LiveAnalyticsQuery = {
      dateKey: req.query.dateKey as string | undefined,
      simulatedNow: req.query.simulatedNow as string | undefined,
      department: req.query.department as string | undefined,
    };

    const analytics = await analyticsService.getLiveAnalytics(query);
    res.status(200).json(analytics);
  });
}

export const analyticsController = new AnalyticsController();

