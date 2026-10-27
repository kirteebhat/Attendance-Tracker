import { Schema, model, Document, Types } from "mongoose";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type HalfDayType = "FIRST_HALF" | "SECOND_HALF";

export interface ILeaveRequest extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  type: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  halfDayType?: HalfDayType;
  workingDays: number;
  reason: string;
  status: LeaveStatus;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  decisionNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
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
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
      index: true,
    },
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    halfDayType: {
      type: String,
      enum: ["FIRST_HALF", "SECOND_HALF"],
    },
    workingDays: {
      type: Number,
      required: [true, "Calculated working days is required"],
      min: [0.5, "Working days must be at least 0.5"],
    },
    reason: {
      type: String,
      required: [true, "Reason for leave is required"],
      trim: true,
      minlength: [3, "Reason must be at least 3 characters"],
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      required: true,
      index: true,
    },
    decidedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    decisionNote: {
      type: String,
      trim: true,
      maxlength: [500, "Decision note cannot exceed 500 characters"],
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound queries for employee leave ledger and HR review dashboard
LeaveRequestSchema.index({ employee: 1, status: 1, startDate: 1, endDate: 1 });
LeaveRequestSchema.index({ status: 1, startDate: 1 });
LeaveRequestSchema.index({ type: 1, status: 1 });

// Ensure start date <= end date
LeaveRequestSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate("endDate", "End date must be greater than or equal to start date");
  }
  next();
});

export const LeaveRequest = model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);
