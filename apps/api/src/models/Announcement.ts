import { Schema, model, Document, Types } from "mongoose";

export type AnnouncementPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type AnnouncementSource = "manual" | "auto";

export interface IAnnouncementAudience {
  scope: "all" | "department" | "role";
  departments: string[];
  roles: string[];
}

export interface IAnnouncementReadReceipt {
  user: Types.ObjectId;
  readAt: Date;
}

export interface IAnnouncement extends Document {
  _id: Types.ObjectId;
  title: string;
  body: string;
  audience: IAnnouncementAudience;
  priority: AnnouncementPriority;
  pinned: boolean;
  startsAt: Date;
  expiresAt?: Date | null;
  source: AnnouncementSource;
  templateKey?: string;
  readBy: IAnnouncementReadReceipt[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    body: {
      type: String,
      required: [true, "Announcement body is required"],
      trim: true,
      minlength: [5, "Body must be at least 5 characters"],
      maxlength: [5000, "Body cannot exceed 5000 characters"],
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
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    startsAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      // TTL INDEX: Automatically cleans up expired announcements when expiresAt is reached
      index: { expires: 0 },
    },
    source: {
      type: String,
      enum: ["manual", "auto"],
      default: "manual",
      index: true,
    },
    templateKey: {
      type: String,
      trim: true,
    },
    readBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
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

// Pinned & Urgent announcements float to the top
AnnouncementSchema.index({ pinned: -1, priority: -1, startsAt: -1 });
AnnouncementSchema.index({ "audience.scope": 1, startsAt: -1 });
AnnouncementSchema.index({ "readBy.user": 1 });

export const Announcement = model<IAnnouncement>("Announcement", AnnouncementSchema);
