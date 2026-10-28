import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { updateService } from "../services/update.service";
import { CheckUpdateQuerySchema, CreateAppReleaseInputSchema } from "@vorldx/shared";

export class UpdateController {
  private getActorContext(req: Request) {
    const user = req.user as { _id?: string; employeeId?: string; role?: string } | undefined;
    return {
      userId: user?._id?.toString(),
      employeeId: user?.employeeId,
      role: user?.role,
    };
  }

  /**
   * GET /api/updates/check
   * Public or authenticated check for platform updates.
   */
  public checkUpdate = asyncHandler(async (req: Request, res: Response) => {
    const query = CheckUpdateQuerySchema.parse({
      platform: (req.query.platform as string) || "MOBILE",
      currentVersion: (req.query.currentVersion as string) || (req.query.version as string) || "1.0.0",
      currentVersionCode: req.query.currentVersionCode || req.query.buildNumber || 1,
      channel: (req.query.channel as string) || "production",
    });

    const result = await updateService.checkUpdate(query);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
    });
  });

  /**
   * POST /api/updates/releases
   * Admin publishes a new release.
   */
  public publishRelease = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const input = CreateAppReleaseInputSchema.parse(req.body);
    const release = await updateService.publishRelease(input, actor);

    res.status(201).json({
      success: true,
      message: `Release ${release.platform} v${release.version} published successfully`,
      data: release,
    });
  });

  /**
   * GET /api/updates/releases
   * List release records with platform and channel filtering.
   */
  public listReleases = asyncHandler(async (req: Request, res: Response) => {
    const platform = req.query.platform as string | undefined;
    const channel = req.query.channel as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await updateService.listReleases({ platform, channel, page, limit });

    res.status(200).json({
      success: true,
      data: result.releases,
      pagination: result.pagination,
    });
  });

  /**
   * DELETE /api/updates/releases/:id
   * Admin removes a release.
   */
  public deleteRelease = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const result = await updateService.deleteRelease(req.params.id, actor);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  });

  /**
   * GET /api/version or GET /api/updates/version
   * Public deployment version endpoint for polling.
   */
  public getVersion = asyncHandler(async (_req: Request, res: Response) => {
    const versionInfo = await updateService.getDeploymentVersion();
    res.status(200).json({
      success: true,
      data: versionInfo,
      ...versionInfo,
    });
  });
}

export const updateController = new UpdateController();
