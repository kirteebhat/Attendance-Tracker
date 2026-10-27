import { Request, Response, NextFunction } from "express";
import { FeatureFlagKey, ApiErrorCode } from "@vorldx/shared";
import { featureFlagService } from "../services/featureFlag.service";
import { AppError } from "../utils/AppError";

/**
 * Middleware that checks if a given feature module is enabled.
 * If the flag is turned off, strictly returns 404 Not Found to obscure
 * or block access to the module.
 */
export const requireFeatureFlag = (flagKey: FeatureFlagKey) => {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const isEnabled = await featureFlagService.isFeatureEnabled(flagKey);
      if (!isEnabled) {
        throw new AppError(
          404,
          ApiErrorCode.ERR_NOT_FOUND,
          `Module '${flagKey}' is disabled on this environment.`
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

