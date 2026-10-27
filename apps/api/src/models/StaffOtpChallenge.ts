import { Schema, model, Document, Types } from "mongoose";

export type StaffOtpPurpose = "LOGIN" | "DEVICE_REGISTRATION" | "PASSWORD_RESET";

export interface IStaffOtpChallenge extends Document {
  _id: Types.ObjectId;
  mobileNumber: string;
  user: Types.ObjectId;
  otpHash: string;
  purpose: StaffOtpPurpose;
  attempts: number;
  isConsumed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const StaffOtpChallengeSchema = new Schema<IStaffOtpChallenge>(
  {
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    otpHash: {
      type: String,
      required: [true, "Hashed OTP is required"],
    },
    purpose: {
      type: String,
      enum: ["LOGIN", "DEVICE_REGISTRATION", "PASSWORD_RESET"],
      default: "LOGIN",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: [5, "Maximum verification attempts exceeded"],
    },
    isConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration timestamp is required"],
      // TTL INDEX: Document purged automatically when expiresAt is reached
      index: { expires: 0 },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

StaffOtpChallengeSchema.index({ mobileNumber: 1, purpose: 1, isConsumed: 1 });
StaffOtpChallengeSchema.index({ user: 1, purpose: 1, isConsumed: 1 });

export const StaffOtpChallenge = model<IStaffOtpChallenge>(
  "StaffOtpChallenge",
  StaffOtpChallengeSchema
);

