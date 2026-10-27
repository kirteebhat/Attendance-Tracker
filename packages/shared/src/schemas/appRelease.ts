import { z } from "zod";

export const AppPlatformSchema = z.enum(["ANDROID", "IOS", "WEB", "DISPLAY"]);
export type AppPlatform = z.infer<typeof AppPlatformSchema>;

export const AppReleaseSchema = z.object({
  _id: z.string().optional(),
  platform: AppPlatformSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Version must follow semver format (e.g. 1.2.0)"),
  versionCode: z.number().int().positive(),
  minSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+/),
  minSupportedVersionCode: z.number().int().positive().default(1),
  notes: z.string().min(5).max(3000),
  downloadUrl: z.string().url().optional(),
  bundleUrl: z.string().url().optional(),
  forceUpdate: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  publishedAt: z.string().datetime().or(z.date()),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type AppRelease = z.infer<typeof AppReleaseSchema>;

export const CreateAppReleaseInputSchema = z.object({
  platform: AppPlatformSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+/, "Semver required (e.g. 1.2.0)"),
  versionCode: z.number().int().positive(),
  minSupportedVersion: z.string().regex(/^\d+\.\d+\.\d+/),
  minSupportedVersionCode: z.number().int().positive().default(1),
  notes: z.string().min(5).max(3000),
  downloadUrl: z.string().url().optional(),
  bundleUrl: z.string().url().optional(),
  forceUpdate: z.boolean().default(false),
});
export type CreateAppReleaseInput = z.infer<typeof CreateAppReleaseInputSchema>;

export const CheckUpdateQuerySchema = z.object({
  platform: AppPlatformSchema,
  currentVersion: z.string(),
  currentVersionCode: z.coerce.number().int().positive().optional(),
});
export type CheckUpdateQuery = z.infer<typeof CheckUpdateQuerySchema>;

