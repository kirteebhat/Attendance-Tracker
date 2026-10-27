import { Schema, model, Document, Types } from "mongoose";

export type AppPlatform = "ANDROID" | "IOS" | "WEB" | "DISPLAY";

export interface IAppRelease extends Document {
  _id: Types.ObjectId;
  platform: AppPlatform;
  version: string;
  versionCode: number;
  minSupportedVersion: string;
  minSupportedVersionCode: number;
  notes: string;
  downloadUrl?: string;
  bundleUrl?: string;
  forceUpdate: boolean;
  isPublished: boolean;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppReleaseSchema = new Schema<IAppRelease>(
  {
    platform: {
      type: String,
      enum: ["ANDROID", "IOS", "WEB", "DISPLAY"],
      required: [true, "Platform is required"],
      index: true,
    },
    version: {
      type: String,
      required: [true, "Version string is required"],
      trim: true,
      match: [/^\d+\.\d+\.\d+/, "Version must adhere to SemVer"],
    },
    versionCode: {
      type: Number,
      required: [true, "Version code is required"],
      min: [1, "Version code must be positive"],
      index: true,
    },
    minSupportedVersion: {
      type: String,
      required: [true, "Minimum supported version is required"],
      trim: true,
    },
    minSupportedVersionCode: {
      type: Number,
      required: [true, "Minimum supported version code is required"],
      default: 1,
    },
    notes: {
      type: String,
      required: [true, "Release notes are required"],
      trim: true,
      maxlength: [3000, "Notes cannot exceed 3000 characters"],
    },
    downloadUrl: {
      type: String,
      trim: true,
    },
    bundleUrl: {
      type: String,
      trim: true,
    },
    forceUpdate: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL UNIQUE CONSTRAINT: Exactly one release per platform per semver string
AppReleaseSchema.index({ platform: 1, version: 1 }, { unique: true });
AppReleaseSchema.index({ platform: 1, versionCode: -1 });

export const AppRelease = model<IAppRelease>("AppRelease", AppReleaseSchema);
