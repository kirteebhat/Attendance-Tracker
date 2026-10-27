import mongoose, { Types } from "mongoose";
import { FeatureFlag, IFeatureFlag } from "../models/FeatureFlag";
import { AuditEvent } from "../models/AuditEvent";
import { env } from "../config/env";
import {
  FeatureFlagKey,
  FeatureFlags,
  DEFAULT_FEATURE_FLAGS,
} from "@vorldx/shared";

interface CacheEntry {
  flags: FeatureFlags;
  cachedAt: number;
}

let memoryCache: CacheEntry | null = null;
const CACHE_TTL_MS = 3000; // 3 seconds cache

export class FeatureFlagService {
  private inMemoryOverrides: Partial<FeatureFlags> = {};

  private getEnvDefaults(): FeatureFlags {
    return {
      leave: env.FEATURE_FLAG_LEAVE ?? false,
      announcements: env.FEATURE_FLAG_ANNOUNCEMENTS ?? false,
      enquiries: env.FEATURE_FLAG_ENQUIRIES ?? false,
      calendarImport: env.FEATURE_FLAG_CALENDAR_IMPORT ?? false,
      threeD: env.FEATURE_FLAG_THREE_D ?? false,
      otaUpdates: env.FEATURE_FLAG_OTA_UPDATES ?? false,
    };
  }

  public setInMemoryOverride(key: FeatureFlagKey, enabled: boolean): void {
    this.inMemoryOverrides[key] = enabled;
    this.invalidateCache();
  }

  public clearInMemoryOverrides(): void {
    this.inMemoryOverrides = {};
    this.invalidateCache();
  }

  public async initializeDefaultFlags(): Promise<void> {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
    try {
      const envDefaults = this.getEnvDefaults();
      const keys: FeatureFlagKey[] = [
        "leave",
        "announcements",
        "enquiries",
        "calendarImport",
        "threeD",
        "otaUpdates",
      ];

      const descriptions: Record<FeatureFlagKey, string> = {
        leave: "Employee leave requests and managerial approval workflows",
        announcements: "Company-wide broadcasts with auto-generated messages and targeting",
        enquiries: "Internal employee ticketing, HR queries, and attendance dispute enquiries",
        calendarImport: "Working calendar synchronization with public holidays and off-days",
        threeD: "Advanced 3D interactive workforce and spatial floor visualizer",
        otaUpdates: "One-click in-app update checks and deployment bundles",
      };

      for (const key of keys) {
        const existing = await FeatureFlag.findOne({ key });
        if (!existing) {
          await FeatureFlag.create({
            key,
            enabled: envDefaults[key] ?? DEFAULT_FEATURE_FLAGS[key] ?? false,
            description: descriptions[key] || `Feature flag for ${key}`,
            reason: "Default system initialization",
          });
        }
      }
      this.invalidateCache();
    } catch (err) {
      console.warn("FeatureFlagService: failed to initialize flags in DB:", err);
    }
  }

  public async getFeatureFlags(): Promise<FeatureFlags> {
    const now = Date.now();
    if (memoryCache && now - memoryCache.cachedAt < CACHE_TTL_MS) {
      return memoryCache.flags;
    }

    const envDefaults = this.getEnvDefaults();
    const result: FeatureFlags = { ...envDefaults, ...this.inMemoryOverrides };

    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await FeatureFlag.find({});
        for (const doc of docs) {
          if (doc.key in result) {
            // DB values take precedence unless explicitly overridden in memory during test
            if (this.inMemoryOverrides[doc.key] === undefined) {
              result[doc.key] = doc.enabled;
            }
          }
        }
      } catch {
        // Fallback to defaults + inMemoryOverrides
      }
    }

    memoryCache = {
      flags: result,
      cachedAt: now,
    };

    return result;
  }

  public async getFeatureFlagsDetailed(): Promise<IFeatureFlag[]> {
    if (mongoose.connection.readyState === 1) {
      return FeatureFlag.find({}).sort({ key: 1 });
    }
    // Fallback when DB is not ready
    const flags = await this.getFeatureFlags();
    const result = Object.entries(flags).map(([key, enabled]) => ({
      key: key as FeatureFlagKey,
      enabled,
      description: `Feature module ${key}`,
      updatedAt: new Date(),
    }));
    return result as unknown as IFeatureFlag[];
  }

  public async isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    return Boolean(flags[key]);
  }

  public async updateFeatureFlag(
    key: FeatureFlagKey,
    enabled: boolean,
    actor: { userId?: string; employeeId?: string; role?: string },
    reason?: string
  ): Promise<Partial<IFeatureFlag>> {
    this.inMemoryOverrides[key] = enabled;
    this.invalidateCache();

    if (mongoose.connection.readyState === 1) {
      const existing = await FeatureFlag.findOne({ key });
      const previousValue = existing ? existing.toObject() : null;

      const doc = await FeatureFlag.findOneAndUpdate(
        { key },
        {
          $set: {
            enabled,
            updatedBy: actor.employeeId || actor.userId || "ADMIN",
            reason: reason || `Toggled ${key} to ${enabled ? "ENABLED" : "DISABLED"}`,
          },
        },
        { upsert: true, new: true }
      );

      try {
        await AuditEvent.create({
          entityType: "FEATURE_FLAG",
          entityId: key,
          performedBy: actor.userId && Types.ObjectId.isValid(actor.userId) ? new Types.ObjectId(actor.userId) : null,
          performedByEmployeeId: actor.employeeId || "ADMIN",
          action: "UPDATE",
          previousValue,
          newValue: doc.toObject(),
          reason: reason || `Admin toggled feature flag '${key}' to ${enabled}`,
          timestamp: new Date(),
          metadata: {
            flagKey: key,
            newState: enabled,
            actorRole: actor.role || "ADMIN",
          },
        });
      } catch (auditErr) {
        console.warn("Failed to write audit log for feature flag toggle:", auditErr);
      }

      return doc;
    }

    return {
      key,
      enabled,
      updatedBy: actor.employeeId || "ADMIN",
      reason,
      updatedAt: new Date(),
    };
  }

  public invalidateCache(): void {
    memoryCache = null;
  }
}

export const featureFlagService = new FeatureFlagService();

