import { Schema, model, Document, Types } from "mongoose";
import { IAnnouncementAudience, AnnouncementPriority } from "./Announcement";

export interface IAnnouncementTemplate extends Document {
  _id: Types.ObjectId;
  key: string;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  priority: AnnouncementPriority;
  audience: IAnnouncementAudience;
  isEnabled: boolean;
  variables: string[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementTemplateSchema = new Schema<IAnnouncementTemplate>(
  {
    key: {
      type: String,
      required: [true, "Template key is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
    },
    titleTemplate: {
      type: String,
      required: [true, "Title template is required"],
      trim: true,
    },
    bodyTemplate: {
      type: String,
      required: [true, "Body template is required"],
      trim: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    audience: {
      scope: {
        type: String,
        enum: ["all", "department", "role"],
        default: "all",
      },
      departments: [{ type: String, trim: true }],
      roles: [{ type: String, trim: true }],
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    variables: [{ type: String, trim: true }],
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const AnnouncementTemplate = model<IAnnouncementTemplate>(
  "AnnouncementTemplate",
  AnnouncementTemplateSchema
);

