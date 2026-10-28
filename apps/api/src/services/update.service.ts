import { Types } from "mongoose";
import { AppRelease, IAppRelease, AppPlatform } from "../models/AppRelease";
import { AuditEvent } from "../models/AuditEvent";
import { featureFlagService } from "./featureFlag.service";
import { eventEmitterService } from "./eventEmitter.service";
import { announcementService } from "./announcement.service";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import {
  CreateAppReleaseInput,
  CheckUpdateQuery,
  CheckUpdateResponse,
  compareSemver,
  isVersionOlder,
  isBelowMinSupportedVersion,
  SocketEvent,
  ApiErrorCode,
} from "@vorldx/shared";

export interface ActorContext {
  userId?: string;
  employeeId?: string;
  role?: string;
}

export class UpdateService {
  /**
   * Check for the latest release on a given platform.
   * Compares the client's current version against the latest published version and minSupportedVersion.
   */
  public async checkUpdate(query: CheckUpdateQuery): Promise<CheckUpdateResponse> {
    const isEnabled = await featureFlagService.isFeatureEnabled("otaUpdates");
    const currentVersion = query.currentVersion || "1.0.0";
    const channel = query.channel || "production";

    if (!isEnabled) {
      return {
        updateAvailable: false,
        forceUpdate: false,
        currentVersion,
        otaUpdatesEnabled: false,
        message: "OTA updates are disabled by configuration",
      };
    }

    const platformRaw = (query.platform || "MOBILE").toUpperCase();
    const platformFilter =
      platformRaw === "MOBILE"
        ? { platform: { $in: ["MOBILE", "ANDROID", "IOS"] } }
        : { platform: platformRaw };

    const latestRelease = await AppRelease.findOne({
      ...platformFilter,
      channel,
      isPublished: true,
    }).sort({ publishedAt: -1, versionCode: -1 });

    if (!latestRelease) {
      return {
        updateAvailable: false,
        forceUpdate: false,
        currentVersion,
        channel,
        otaUpdatesEnabled: true,
        message: "No releases found for this platform and channel",
      };
    }

    const isOlder = isVersionOlder(currentVersion, latestRelease.version);
    const isBelowMin = isBelowMinSupportedVersion(currentVersion, latestRelease.minSupportedVersion);
    const forceUpdate = isBelowMin || latestRelease.forceUpdate;
    const updateAvailable = isOlder || isBelowMin;

    return {
      updateAvailable,
      forceUpdate,
      currentVersion,
      latestVersion: latestRelease.version,
      minSupportedVersion: latestRelease.minSupportedVersion,
      notes: latestRelease.notes,
      downloadUrl: latestRelease.downloadUrl,
      bundleUrl: latestRelease.bundleUrl,
      channel: latestRelease.channel,
      publishedAt: latestRelease.publishedAt.toISOString(),
      otaUpdatesEnabled: true,
      message: updateAvailable
        ? forceUpdate
          ? "Immediate required update available"
          : "New version update available"
        : "App is up to date",
    };
  }

  /**
   * Publish a new release record (Admin only).
   */
  public async publishRelease(
    input: CreateAppReleaseInput,
    actor?: ActorContext
  ): Promise<IAppRelease> {
    // Validate semver: minSupportedVersion must not be greater than target version
    if (compareSemver(input.minSupportedVersion || "1.0.0", input.version) > 0) {
      throw AppError.badRequest(
        `minSupportedVersion (${input.minSupportedVersion}) cannot be higher than release version (${input.version})`,
        ApiErrorCode.ERR_INVALID_INPUT
      );
    }

    const platform = input.platform as AppPlatform;
    const channel = input.channel || "production";

    // Upsert or create new release for this platform + version + channel
    let release = await AppRelease.findOne({
      platform,
      version: input.version,
      channel,
    });

    const previousValue = release ? release.toObject() : null;

    if (release) {
      release.notes = input.notes.trim();
      release.minSupportedVersion = input.minSupportedVersion || release.minSupportedVersion;
      release.versionCode = input.versionCode || release.versionCode;
      release.minSupportedVersionCode = input.minSupportedVersionCode || release.minSupportedVersionCode;
      release.downloadUrl = input.downloadUrl || release.downloadUrl;
      release.bundleUrl = input.bundleUrl || release.bundleUrl;
      release.forceUpdate = input.forceUpdate ?? release.forceUpdate;
      release.isPublished = true;
      release.publishedAt = new Date();
      if (actor?.userId) {
        release.publishedBy = new Types.ObjectId(actor.userId);
      }
      await release.save();
    } else {
      release = await AppRelease.create({
        platform,
        version: input.version.trim(),
        versionCode: input.versionCode || 1,
        minSupportedVersion: input.minSupportedVersion || "1.0.0",
        minSupportedVersionCode: input.minSupportedVersionCode || 1,
        notes: input.notes.trim(),
        downloadUrl: input.downloadUrl || "",
        bundleUrl: input.bundleUrl || "",
        forceUpdate: input.forceUpdate ?? false,
        channel,
        isPublished: true,
        publishedAt: new Date(),
        publishedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      });
    }

    // Audit Logging
    await AuditEvent.create({
      entityType: "APP_RELEASE",
      entityId: release._id.toString(),
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      action: previousValue ? "UPDATE_APP_RELEASE" : "PUBLISH_APP_RELEASE",
      previousValue,
      newValue: release.toObject(),
      reason: `Published ${release.platform} v${release.version} (min: ${release.minSupportedVersion}, force: ${release.forceUpdate})`,
      timestamp: new Date(),
      metadata: { actorRole: actor?.role, platform: release.platform, channel: release.channel },
    });

    // Realtime socket broadcast
    eventEmitterService.emit(SocketEvent.APP_RELEASE_PUBLISHED, {
      releaseId: release._id.toString(),
      platform: release.platform,
      version: release.version,
      forceUpdate: release.forceUpdate,
      channel: release.channel,
      notes: release.notes,
      publishedAt: release.publishedAt.toISOString(),
    });

    // Auto-create notification/announcement hook if template is active
    try {
      if (announcementService && typeof announcementService.onUpdateAvailableHook === "function") {
        await announcementService
          .onUpdateAvailableHook(release.version, release.notes)
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`[UpdateService] Non-critical auto-announcement failed: ${msg}`);
          });
      }
    } catch {
      // Ignore if announcement service fails
    }

    logger.info(`[UpdateService] Published release ${release.platform} v${release.version} on channel ${release.channel}`);
    return release;
  }

  /**
   * List releases with optional platform and channel filtering.
   */
  public async listReleases(filters: {
    platform?: string;
    channel?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (filters.platform && filters.platform !== "ALL") {
      query.platform = filters.platform.toUpperCase();
    }
    if (filters.channel && filters.channel !== "ALL") {
      query.channel = filters.channel.toLowerCase();
    }

    const [releases, total] = await Promise.all([
      AppRelease.find(query)
        .sort({ publishedAt: -1, versionCode: -1 })
        .skip(skip)
        .limit(limit)
        .populate("publishedBy", "name email employeeId"),
      AppRelease.countDocuments(query),
    ]);

    return {
      releases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Delete or archive a release.
   */
  public async deleteRelease(id: string, actor?: ActorContext) {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.badRequest("Invalid release ID", ApiErrorCode.ERR_INVALID_INPUT);
    }

    const release = await AppRelease.findById(id);
    if (!release) {
      throw AppError.notFound("Release record not found", ApiErrorCode.ERR_NOT_FOUND);
    }

    await AppRelease.findByIdAndDelete(id);

    await AuditEvent.create({
      entityType: "APP_RELEASE",
      entityId: id,
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      action: "DELETE_APP_RELEASE",
      previousValue: release.toObject(),
      reason: `Deleted ${release.platform} v${release.version}`,
      timestamp: new Date(),
    });

    return { success: true, message: `Release ${release.version} deleted` };
  }

  /**
   * Returns current active build version information for Web, Display, and Mobile.
   */
  public async getDeploymentVersion() {
    const isEnabled = await featureFlagService.isFeatureEnabled("otaUpdates");
    return {
      version: "1.2.0",
      buildNumber: 120,
      timestamp: new Date().toISOString(),
      otaUpdatesEnabled: isEnabled,
      environment: process.env.NODE_ENV || "development",
    };
  }
}

export const updateService = new UpdateService();
