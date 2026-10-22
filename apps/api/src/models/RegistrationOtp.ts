import { Schema, model, Document, Types } from "mongoose";

export interface IRegistrationOtp extends Document {
  _id: Types.ObjectId;
  employeeId: string;
  email: string;
  hashedCode: string;
  expiresAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
}

const RegistrationOtpSchema = new Schema<IRegistrationOtp>(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true,
    },
    hashedCode: {
      type: String,
      required: [true, "Hashed OTP is required"],
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration timestamp is required"],
      // TTL INDEX: Document automatically purged by MongoDB when expiresAt is reached
      index: { expires: 0 },
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: [5, "Maximum verification attempts exceeded"],
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
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

RegistrationOtpSchema.index({ employeeId: 1, isUsed: 1 });

export const RegistrationOtp = model<IRegistrationOtp>("RegistrationOtp", RegistrationOtpSchema);
