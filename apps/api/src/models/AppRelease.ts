import { Schema, model, Document, Types } from "mongoose";

export type AppPlatform = "ANDROID" | "IOS" | "WEB" | "DISPLAY" | "MOBILE";

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
  channel: "production" | "development" | "staging";
  isPublished: boolean;
  publishedAt: Date;
  publishedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AppReleaseSchema = new Schema<IAppRelease>(
  {
    platform: {
      type: String,
      enum: ["ANDROID", "IOS", "WEB", "DISPLAY", "MOBILE"],
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
      default: 1,
      min: [1, "Version code must be positive"],
      index: true,
    },
    minSupportedVersion: {
      type: String,
      required: [true, "Minimum supported version is required"],
      trim: true,
      default: "1.0.0",
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
      default: "",
    },
    bundleUrl: {
      type: String,
      trim: true,
      default: "",
    },
    forceUpdate: {
      type: Boolean,
      default: false,
    },
    channel: {
      type: String,
      enum: ["production", "development", "staging"],
      default: "production",
      index: true,
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
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AppReleaseSchema.index({ platform: 1, version: 1, channel: 1 }, { unique: true });
AppReleaseSchema.index({ platform: 1, channel: 1, publishedAt: -1 });

export const AppRelease = model<IAppRelease>("AppRelease", AppReleaseSchema);
