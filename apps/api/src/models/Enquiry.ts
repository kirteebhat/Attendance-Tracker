import { Schema, model, Document, Types } from "mongoose";

export type EnquiryCategory =
  | "PAYROLL"
  | "ATTENDANCE"
  | "LEAVE"
  | "BENEFITS"
  | "IT"
  | "GENERAL";

export type EnquiryStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type EnquiryPriority = "LOW" | "MEDIUM" | "HIGH";

export interface IEnquiry extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  category: EnquiryCategory;
  subject: string;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  assignee?: Types.ObjectId | null;
  lastMessageAt: Date;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EnquirySchema = new Schema<IEnquiry>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },
    category: {
      type: String,
      enum: ["PAYROLL", "ATTENDANCE", "LEAVE", "BENEFITS", "IT", "GENERAL"],
      required: [true, "Category is required"],
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      minlength: [3, "Subject must be at least 3 characters"],
      maxlength: [150, "Subject cannot exceed 150 characters"],
    },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
      index: true,
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// High-speed indexes for HR ticket assignment & employee inbox
EnquirySchema.index({ employee: 1, status: 1 });
EnquirySchema.index({ assignee: 1, status: 1 });
EnquirySchema.index({ category: 1, status: 1 });
EnquirySchema.index({ lastMessageAt: -1 });

export const Enquiry = model<IEnquiry>("Enquiry", EnquirySchema);

