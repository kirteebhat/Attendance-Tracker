import { Schema, model, Document, Types } from "mongoose";
import { AttendanceStatus } from "@vorldx/shared";

export interface IOriginalAttendanceValues {
  checkInTime: Date | null;
  checkOutTime: Date | null;
  status: AttendanceStatus;
  durationMinutes: number;
  isLate: boolean;
  lateMinutes: number;
}

export interface ICorrectionHistoryEntry {
  correctionReason: string;
  correctedBy: Types.ObjectId;
  correctedAt: Date;
  previousValues: {
    checkInTime: Date | null;
    checkOutTime: Date | null;
    status: AttendanceStatus;
    durationMinutes: number;
    isLate: boolean;
    lateMinutes: number;
    isMissingCheckout: boolean;
  };
  newValues: {
    checkInTime: Date | null;
    checkOutTime: Date | null;
    status: AttendanceStatus;
    durationMinutes: number;
    isLate: boolean;
    lateMinutes: number;
    isMissingCheckout: boolean;
  };
}

export interface IAttendanceRecord extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  employeeId: string;
  department: string;
  dateKey: string; // YYYY-MM-DD
  checkInTime: Date | null;
  checkOutTime: Date | null;
  durationMinutes: number;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  isWfh: boolean;
  isMissingCheckout: boolean;
  isManuallyCorrected: boolean;
  policyId?: Types.ObjectId;
  policyVersion?: number;
  terminalId?: string;
  systemNotes?: string;
  // History preservation: stores original values before administrative correction
  originalValues?: IOriginalAttendanceValues;
  corrections?: ICorrectionHistoryEntry[];
  correctionReason?: string;
  correctedBy?: Types.ObjectId;
  correctedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OriginalValuesSubSchema = new Schema<IOriginalAttendanceValues>(
  {
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status: { type: String, enum: Object.values(AttendanceStatus) },
    durationMinutes: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const CorrectionHistorySubSchema = new Schema<ICorrectionHistoryEntry>(
  {
    correctionReason: { type: String, required: true },
    correctedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    correctedAt: { type: Date, default: Date.now },
    previousValues: { type: Schema.Types.Mixed, required: true },
    newValues: { type: Schema.Types.Mixed, required: true },
  },
  { _id: true, timestamps: false }
);

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
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
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: [0, "Duration cannot be negative"],
    },
    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      default: AttendanceStatus.NOT_PUNCHED,
      required: true,
      index: true,
    },
    isLate: {
      type: Boolean,
      default: false,
      index: true,
    },
    lateMinutes: {
      type: Number,
      default: 0,
      min: [0, "Late minutes cannot be negative"],
    },
    isWfh: {
      type: Boolean,
      default: false,
      index: true,
    },
    isMissingCheckout: {
      type: Boolean,
      default: false,
      index: true,
    },
    isManuallyCorrected: {
      type: Boolean,
      default: false,
      index: true,
    },
    policyId: {
      type: Schema.Types.ObjectId,
      ref: "AttendancePolicy",
      default: null,
      index: true,
    },
    policyVersion: {
      type: Number,
      default: 1,
    },
    terminalId: {
      type: String,
      default: null,
    },
    systemNotes: {
      type: String,
      default: null,
    },
    // Historical audit trail for corrections
    originalValues: {
      type: OriginalValuesSubSchema,
      default: null,
    },
    correctionReason: {
      type: String,
      default: null,
    },
    correctedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    correctedAt: {
      type: Date,
      default: null,
    },
    corrections: {
      type: [CorrectionHistorySubSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL CONSTRAINT: Unique compound index on (employee, dateKey)
// Guarantees zero duplicate attendance documents per employee per day
AttendanceRecordSchema.index({ employee: 1, dateKey: 1 }, { unique: true });

// Query optimization indexes for dashboard, exports, and analytics
AttendanceRecordSchema.index({ dateKey: 1, department: 1, status: 1 });
AttendanceRecordSchema.index({ employeeId: 1, dateKey: 1 });
AttendanceRecordSchema.index({ status: 1, dateKey: 1 });

export const AttendanceRecord = model<IAttendanceRecord>(
  "AttendanceRecord",
  AttendanceRecordSchema
);
