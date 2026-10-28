import { z } from "zod";

export const AppPlatformSchema = z.enum(["ANDROID", "IOS", "WEB", "DISPLAY", "MOBILE"]);
export type AppPlatform = z.infer<typeof AppPlatformSchema>;

export const ReleaseChannelSchema = z.enum(["production", "development", "staging"]);
export type ReleaseChannel = z.infer<typeof ReleaseChannelSchema>;

export const AppReleaseSchema = z.object({
  _id: z.string().optional(),
  platform: AppPlatformSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Version must follow semver format (e.g. 1.2.0)"),
  versionCode: z.number().int().positive().default(1),
  minSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+/).default("1.0.0"),
  minSupportedVersionCode: z.number().int().positive().default(1),
  notes: z.string().min(3).max(3000),
  downloadUrl: z.string().url().optional().or(z.literal("")),
  bundleUrl: z.string().url().optional().or(z.literal("")),
  forceUpdate: z.boolean().default(false),
  channel: ReleaseChannelSchema.default("production"),
  isPublished: z.boolean().default(true),
  publishedAt: z.string().datetime().or(z.date()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type AppRelease = z.infer<typeof AppReleaseSchema>;

export const CreateAppReleaseInputSchema = z.object({
  platform: AppPlatformSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Semver required (e.g. 1.2.0)"),
  versionCode: z.number().int().positive().optional().default(1),
  minSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+/).optional().default("1.0.0"),
  minSupportedVersionCode: z.number().int().positive().optional().default(1),
  notes: z.string().min(3, "Release notes must be at least 3 characters").max(3000),
  downloadUrl: z.string().url().optional().or(z.literal("")),
  bundleUrl: z.string().url().optional().or(z.literal("")),
  forceUpdate: z.boolean().optional().default(false),
  channel: ReleaseChannelSchema.optional().default("production"),
});
export type CreateAppReleaseInput = z.infer<typeof CreateAppReleaseInputSchema>;

export const CheckUpdateQuerySchema = z.object({
  platform: z.string().default("MOBILE"),
  currentVersion: z.string().optional().default("1.0.0"),
  currentVersionCode: z.coerce.number().int().positive().optional().default(1),
  channel: ReleaseChannelSchema.optional().default("production"),
});
export type CheckUpdateQuery = z.infer<typeof CheckUpdateQuerySchema>;

export interface CheckUpdateResponse {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  minSupportedVersion?: string;
  notes?: string;
  downloadUrl?: string;
  bundleUrl?: string;
  channel?: string;
  publishedAt?: string;
  otaUpdatesEnabled: boolean;
  message?: string;
}
