import { Schema, model, Document, Types } from "mongoose";

export type EnquiryCategory =
  | "ATTENDANCE"
  | "LEAVE"
  | "WFH"
  | "PAYROLL"
  | "TECHNICAL"
  | "OTHER"
  | "BENEFITS"
  | "IT"
  | "GENERAL";

export type EnquiryStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type EnquiryPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface IEnquiryAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  dataUrl?: string;
}

export interface IEnquiry extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  employee: Types.ObjectId; // Employee model ref
  employeeUser: Types.ObjectId; // User model ref (for fast auth scoping)
  category: EnquiryCategory;
  subject: string;
  status: EnquiryStatus;
  priority: EnquiryPriority;
  assignee?: Types.ObjectId | null; // User model ref
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  reopenDeadline?: Date | null;
  lastMessageAt: Date;
  attachments: IEnquiryAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const EnquiryAttachmentSubschema = new Schema<IEnquiryAttachment>(
  {
    name: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true },
    url: { type: String, trim: true },
    dataUrl: { type: String, trim: true },
  },
  { _id: false }
);

const EnquirySchema = new Schema<IEnquiry>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employee: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
      index: true,
    },
    employeeUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    category: {
      type: String,
      enum: [
        "ATTENDANCE",
        "LEAVE",
        "WFH",
        "PAYROLL",
        "TECHNICAL",
        "OTHER",
        "BENEFITS",
        "IT",
        "GENERAL",
      ],
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
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    reopenDeadline: {
      type: Date,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    attachments: [EnquiryAttachmentSubschema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// High-speed compound indexes for fast lookups & scoping
EnquirySchema.index({ employeeUser: 1, status: 1 });
EnquirySchema.index({ employee: 1, status: 1 });
EnquirySchema.index({ assignee: 1, status: 1 });
EnquirySchema.index({ category: 1, status: 1 });
EnquirySchema.index({ priority: 1, status: 1 });
EnquirySchema.index({ lastMessageAt: -1 });

export const Enquiry = model<IEnquiry>("Enquiry", EnquirySchema);
