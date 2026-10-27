import { Schema, model, Document, Types } from "mongoose";

export interface ICarryForwardRule {
  allowed: boolean;
  maxDays: number;
  expiryMonths?: number;
}

export interface ILeaveType extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  paid: boolean;
  annualQuota: number;
  carryForwardRule: ICarryForwardRule;
  halfDayAllowed: boolean;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveTypeSchema = new Schema<ILeaveType>(
  {
    name: {
      type: String,
      required: [true, "Leave type name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    code: {
      type: String,
      required: [true, "Leave type code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      minlength: [1, "Code must be at least 1 character"],
      maxlength: [10, "Code cannot exceed 10 characters"],
    },
    paid: {
      type: Boolean,
      default: true,
    },
    annualQuota: {
      type: Number,
      required: [true, "Annual quota is required"],
      min: [0, "Quota cannot be negative"],
      default: 12,
    },
    carryForwardRule: {
      allowed: { type: Boolean, default: false },
      maxDays: { type: Number, default: 0, min: 0 },
      expiryMonths: { type: Number, min: 1 },
    },
    halfDayAllowed: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description cannot exceed 300 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const LeaveType = model<ILeaveType>("LeaveType", LeaveTypeSchema);
