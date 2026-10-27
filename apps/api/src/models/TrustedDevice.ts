import { Schema, model, Document, Types } from "mongoose";

export type DevicePlatform = "iOS" | "Android" | "Web" | "Windows" | "macOS";

export interface ITrustedDevice extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  deviceFingerprint: string;
  deviceName: string;
  platform: DevicePlatform;
  lastUsedAt: Date;
  trustedUntil: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrustedDeviceSchema = new Schema<ITrustedDevice>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    deviceFingerprint: {
      type: String,
      required: [true, "Device fingerprint is required"],
      trim: true,
      minlength: [8, "Fingerprint must be at least 8 characters"],
    },
    deviceName: {
      type: String,
      required: [true, "Device name is required"],
      trim: true,
      maxlength: [100, "Device name cannot exceed 100 characters"],
    },
    platform: {
      type: String,
      enum: ["iOS", "Android", "Web", "Windows", "macOS"],
      required: [true, "Platform is required"],
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    trustedUntil: {
      type: Date,
      required: [true, "Trusted until timestamp is required"],
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL CONSTRAINT: A device fingerprint is uniquely tracked per user account
TrustedDeviceSchema.index({ user: 1, deviceFingerprint: 1 }, { unique: true });
TrustedDeviceSchema.index({ user: 1, isRevoked: 1 });

export const TrustedDevice = model<ITrustedDevice>("TrustedDevice", TrustedDeviceSchema);

