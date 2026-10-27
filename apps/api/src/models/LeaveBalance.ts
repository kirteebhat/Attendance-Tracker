import { Schema, model, Document, Types } from "mongoose";

export interface ILeaveBalance extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  type: Types.ObjectId;
  year: number;
  allotted: number;
  used: number;
  pending: number;
  carriedOver: number;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },
    type: {
      type: Schema.Types.ObjectId,
      ref: "LeaveType",
      required: [true, "LeaveType reference is required"],
      index: true,
    },
    year: {
      type: Number,
      required: [true, "Year is required"],
      min: [2020, "Year must be at least 2020"],
      max: [2100, "Year cannot exceed 2100"],
      index: true,
    },
    allotted: {
      type: Number,
      required: [true, "Allotted days are required"],
      min: [0, "Allotted days cannot be negative"],
    },
    used: {
      type: Number,
      default: 0,
      min: [0, "Used days cannot be negative"],
    },
    pending: {
      type: Number,
      default: 0,
      min: [0, "Pending days cannot be negative"],
    },
    carriedOver: {
      type: Number,
      default: 0,
      min: [0, "Carried over days cannot be negative"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL UNIQUE CONSTRAINT: One balance record per employee per leave type per year
LeaveBalanceSchema.index({ employee: 1, type: 1, year: 1 }, { unique: true });
LeaveBalanceSchema.index({ employee: 1, year: 1 });

export const LeaveBalance = model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);
