import { z } from "zod";

export const FeatureFlagKeySchema = z.enum([
  "leave",
  "announcements",
  "enquiries",
  "calendarImport",
  "threeD",
  "otaUpdates",
]);

export type FeatureFlagKey = z.infer<typeof FeatureFlagKeySchema>;

export const FeatureFlagsSchema = z.object({
  leave: z.boolean().default(false),
  announcements: z.boolean().default(false),
  enquiries: z.boolean().default(false),
  calendarImport: z.boolean().default(false),
  threeD: z.boolean().default(false),
  otaUpdates: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  leave: false,
  announcements: false,
  enquiries: false,
  calendarImport: false,
  threeD: false,
  otaUpdates: false,
};

export const UpdateFeatureFlagPayloadSchema = z.object({
  key: FeatureFlagKeySchema,
  enabled: z.boolean(),
  reason: z.string().optional(),
});

export type UpdateFeatureFlagPayload = z.infer<typeof UpdateFeatureFlagPayloadSchema>;

