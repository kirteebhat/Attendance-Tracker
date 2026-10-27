import { Request, Response } from "express";
import { featureFlagService } from "../services/featureFlag.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import {
  UpdateFeatureFlagPayloadSchema,
  FeatureFlagKey,
  ApiErrorCode,
  UserRole,
} from "@vorldx/shared";

export class FeatureFlagController {
  /**
   * Public/Client retrieval of active feature flags dictionary
   */
  public getFlags = asyncHandler(async (_req: Request, res: Response) => {
    const flags = await featureFlagService.getFeatureFlags();
    res.status(200).json({
      success: true,
      data: flags,
    });
  });

  /**
   * Administrative view of detailed feature flags with descriptions and metadata
   */
  public getFlagsDetailed = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.HR && req.user.role !== UserRole.HR_ADMIN)) {
      throw AppError.forbidden("Administrative privileges required to inspect feature flag details", ApiErrorCode.ERR_FORBIDDEN);
    }
    const flags = await featureFlagService.getFeatureFlagsDetailed();
    res.status(200).json({
      success: true,
      data: flags,
    });
  });

  /**
   * Administrative update/toggle for a specific feature flag
   */
  public updateFlag = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      throw AppError.forbidden("Only system administrators may toggle feature flags", ApiErrorCode.ERR_FORBIDDEN);
    }

    const parseResult = UpdateFeatureFlagPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.badRequest("Invalid feature flag payload", ApiErrorCode.ERR_INVALID_INPUT, parseResult.error.format());
    }

    const { key, enabled, reason } = parseResult.data;
    const updated = await featureFlagService.updateFeatureFlag(
      key as FeatureFlagKey,
      enabled,
      {
        userId: req.user.userId,
        employeeId: req.user.employeeId,
        role: req.user.role,
      },
      reason
    );

    res.status(200).json({
      success: true,
      message: `Feature flag '${key}' updated to ${enabled ? "ENABLED" : "DISABLED"}`,
      data: updated,
    });
  });
}

export const featureFlagController = new FeatureFlagController();
