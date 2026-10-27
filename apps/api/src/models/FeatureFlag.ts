import { Schema, model, Document, Types } from "mongoose";
import { FeatureFlagKey } from "@vorldx/shared";

export interface IFeatureFlag extends Document {
  _id: Types.ObjectId;
  key: FeatureFlagKey;
  enabled: boolean;
  description: string;
  updatedBy?: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: {
      type: String,
      required: [true, "Feature flag key is required"],
      unique: true,
      index: true,
      enum: ["leave", "announcements", "enquiries", "calendarImport", "threeD", "otaUpdates"],
    },
    enabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    updatedBy: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const FeatureFlag = model<IFeatureFlag>("FeatureFlag", FeatureFlagSchema);

