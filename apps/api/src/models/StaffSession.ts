import { Schema, model, Document, Types } from "mongoose";

export interface IStaffSession extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  tokenHash: string;
  deviceId?: Types.ObjectId | null;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  expiresAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSessionSchema = new Schema<IStaffSession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, "Session token hash is required"],
      unique: true,
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "TrustedDevice",
      default: null,
    },
    ipAddress: {
      type: String,
      required: [true, "IP address is required"],
      trim: true,
    },
    userAgent: {
      type: String,
      required: [true, "User agent is required"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration timestamp is required"],
      // TTL INDEX: Automatic session expiration purge
      index: { expires: 0 },
    },
    lastActivityAt: {
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

StaffSessionSchema.index({ user: 1, isActive: 1 });

export const StaffSession = model<IStaffSession>("StaffSession", StaffSessionSchema);
