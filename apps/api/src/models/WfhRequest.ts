import { Schema, model, Document, Types } from "mongoose";
import { WfhStatus } from "@vorldx/shared";

export interface IWfhRequest extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  employeeId: string;
  department: string;
  dateKey: string; // YYYY-MM-DD
  reason: string;
  status: WfhStatus;
  reviewedBy?: Types.ObjectId;
  reviewerRemarks?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WfhRequestSchema = new Schema<IWfhRequest>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      trim: true,
      uppercase: true,
      index: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: [true, "Date key is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "dateKey must follow YYYY-MM-DD format"],
      index: true,
    },
    reason: {
      type: String,
      required: [true, "Reason for Work From Home is required"],
      trim: true,
      minlength: [5, "Reason must be at least 5 characters"],
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: Object.values(WfhStatus),
      default: WfhStatus.PENDING,
      required: true,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewerRemarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL CONSTRAINT: Unique compound index preventing duplicate WFH requests on the same date
WfhRequestSchema.index({ employee: 1, dateKey: 1 }, { unique: true });
WfhRequestSchema.index({ status: 1, dateKey: 1 });
WfhRequestSchema.index({ department: 1, status: 1 });

export const WfhRequest = model<IWfhRequest>("WfhRequest", WfhRequestSchema);
