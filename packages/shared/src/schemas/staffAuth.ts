import { z } from "zod";

export const StaffOtpPurposeSchema = z.enum([
  "LOGIN",
  "DEVICE_REGISTRATION",
  "PASSWORD_RESET",
]);
export type StaffOtpPurpose = z.infer<typeof StaffOtpPurposeSchema>;

export const DevicePlatformSchema = z.enum([
  "iOS",
  "Android",
  "Web",
  "Windows",
  "macOS",
]);
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

export const StaffOtpChallengeSchema = z.object({
  _id: z.string().optional(),
  mobileNumber: z.string().min(10).max(15),
  user: z.string(), // ObjectId
  otpHash: z.string(),
  purpose: StaffOtpPurposeSchema.default("LOGIN"),
  attempts: z.number().int().nonnegative().default(0),
  isConsumed: z.boolean().default(false),
  expiresAt: z.string().datetime().or(z.date()),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type StaffOtpChallenge = z.infer<typeof StaffOtpChallengeSchema>;

export const TrustedDeviceSchema = z.object({
  _id: z.string().optional(),
  user: z.string(),
  deviceFingerprint: z.string().min(8),
  deviceName: z.string().min(1).max(100),
  platform: DevicePlatformSchema,
  lastUsedAt: z.string().datetime().or(z.date()),
  trustedUntil: z.string().datetime().or(z.date()),
  isRevoked: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type TrustedDevice = z.infer<typeof TrustedDeviceSchema>;

export const StaffSessionSchema = z.object({
  _id: z.string().optional(),
  user: z.string(),
  tokenHash: z.string(),
  deviceId: z.string().optional().nullable(),
  ipAddress: z.string(),
  userAgent: z.string(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().or(z.date()),
  lastActivityAt: z.string().datetime().or(z.date()),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type StaffSession = z.infer<typeof StaffSessionSchema>;

export const StaffOtpStartInputSchema = z.object({
  mobileNumber: z.string().min(10, "Mobile number must be at least 10 digits").max(15),
  purpose: StaffOtpPurposeSchema.default("LOGIN"),
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().optional(),
  platform: DevicePlatformSchema.optional(),
});
export type StaffOtpStartInput = z.infer<typeof StaffOtpStartInputSchema>;

export const StaffOtpVerifyInputSchema = z.object({
  mobileNumber: z.string().min(10).max(15),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  purpose: StaffOtpPurposeSchema.default("LOGIN"),
  deviceFingerprint: z.string().optional(),
  deviceName: z.string().optional(),
  platform: DevicePlatformSchema.optional(),
  trustDevice: z.boolean().default(false),
});
export type StaffOtpVerifyInput = z.infer<typeof StaffOtpVerifyInputSchema>;
