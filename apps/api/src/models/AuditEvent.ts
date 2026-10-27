import { Schema, model, Document, Types } from "mongoose";

export type AuditEntityType =
  | "ATTENDANCE_RECORD"
  | "WFH_REQUEST"
  | "EMPLOYEE"
  | "POLICY"
  | "TERMINAL"
  | "AUTH"
  | "USER"
  | "STAFF_SESSION"
  | "TRUSTED_DEVICE"
  | "FEATURE_FLAG"
  | "CALENDAR"
  | "CALENDAR_EVENT"
  | "LEAVE_REQUEST"
  | "LEAVE_TYPE"
  | "LEAVE_BALANCE";

export interface IAuditEvent extends Document {
  _id: Types.ObjectId;
  entityType: AuditEntityType;
  entityId: string;
  performedBy?: Types.ObjectId;
  performedByEmployeeId?: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    entityType: {
      type: String,
      enum: [
        "ATTENDANCE_RECORD",
        "WFH_REQUEST",
        "EMPLOYEE",
        "POLICY",
        "TERMINAL",
        "AUTH",
        "USER",
        "STAFF_SESSION",
        "TRUSTED_DEVICE",
        "FEATURE_FLAG",
        "CALENDAR",
        "CALENDAR_EVENT",
        "LEAVE_REQUEST",
        "LEAVE_TYPE",
        "LEAVE_BALANCE",
      ],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    performedByEmployeeId: {
      type: String,
      trim: true,
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    previousValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: false, // Immutable timestamp is explicitly managed
    versionKey: false,
  }
);

AuditEventSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditEvent = model<IAuditEvent>("AuditEvent", AuditEventSchema);
