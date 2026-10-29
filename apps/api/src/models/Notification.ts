import { Schema, model, Document, Types } from "mongoose";

export type NotificationType =
  | "LEAVE_STATUS"
  | "WFH_STATUS"
  | "ANNOUNCEMENT"
  | "ENQUIRY_REPLY"
  | "ENQUIRY_STATUS"
  | "ENQUIRY_ASSIGNED"
  | "SYSTEM"
  | "SECURITY";

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  readAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    type: {
      type: String,
      enum: [
        "LEAVE_STATUS",
        "WFH_STATUS",
        "ANNOUNCEMENT",
        "ENQUIRY_REPLY",
        "ENQUIRY_STATUS",
        "ENQUIRY_ASSIGNED",
        "SYSTEM",
        "SECURITY",
      ],
      required: [true, "Notification type is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Notification title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    message: {
      type: String,
      required: [true, "Notification message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      // TTL INDEX: Document purged automatically when expiresAt is set and reached
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", NotificationSchema);

