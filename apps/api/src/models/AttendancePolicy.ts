import { Schema, model, Document, Types } from "mongoose";

export interface IShift {
  _id: Types.ObjectId;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  graceMinutes: number;
  checkInWindowStartMinutes: number;
  checkInWindowEndMinutes: number;
  checkOutWindowStartMinutes: number;
  checkOutWindowEndMinutes: number;
  isOvernight: boolean;
  isActive: boolean;
}

export interface IWfhPolicyRules {
  monthlyQuota: number;
  advanceNoticeDays: number;
  allowedDaysPerWeek: number;
  autoApproval: boolean;
}

export interface IAttendancePolicy extends Document {
  _id: Types.ObjectId;
  name: string;
  version: number;
  timezone: string;
  defaultGraceMinutes: number;
  minFullDayHours: number;
  minHalfDayHours: number;
  monthlyWfhQuota: number;
  absenceEvaluationCutoffTime: string;
  wfhRules: IWfhPolicyRules;
  qrRotationSeconds: number;
  qrGraceSeconds: number;
  punchCooldownMinutes: number;
  allowOvertime: boolean;
  workdays: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  shifts: Types.DocumentArray<IShift & Document>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftSubSchema = new Schema<IShift>(
  {
    name: {
      type: String,
      required: [true, "Shift name is required"],
      trim: true,
    },
    startTime: {
      type: String,
      required: [true, "Shift start time is required"],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm format"],
    },
    endTime: {
      type: String,
      required: [true, "Shift end time is required"],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm format"],
    },
    graceMinutes: {
      type: Number,
      default: 15,
      min: [0, "Grace period cannot be negative"],
      max: [60, "Grace period cannot exceed 60 minutes"],
    },
    checkInWindowStartMinutes: {
      type: Number,
      default: 60,
      min: [0, "Window start minutes cannot be negative"],
    },
    checkInWindowEndMinutes: {
      type: Number,
      default: 180,
      min: [0, "Window end minutes cannot be negative"],
    },
    checkOutWindowStartMinutes: {
      type: Number,
      default: 60,
      min: [0, "Window start minutes cannot be negative"],
    },
    checkOutWindowEndMinutes: {
      type: Number,
      default: 180,
      min: [0, "Window end minutes cannot be negative"],
    },
    isOvernight: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const WfhPolicyRulesSubSchema = new Schema<IWfhPolicyRules>(
  {
    monthlyQuota: {
      type: Number,
      default: 4,
      min: [0, "Quota cannot be negative"],
    },
    advanceNoticeDays: {
      type: Number,
      default: 1,
      min: [0, "Notice days cannot be negative"],
    },
    allowedDaysPerWeek: {
      type: Number,
      default: 2,
      min: [1, "Must allow at least 1 day per week"],
      max: [7, "Cannot exceed 7 days per week"],
    },
    autoApproval: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const AttendancePolicySchema = new Schema<IAttendancePolicy>(
  {
    name: {
      type: String,
      required: [true, "Policy name is required"],
      trim: true,
      default: "Default Company Attendance Policy",
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: "Asia/Kolkata",
    },
    defaultGraceMinutes: {
      type: Number,
      required: true,
      default: 15,
      min: [0, "Grace period cannot be negative"],
      max: [60, "Grace period cannot exceed 60 minutes"],
    },
    minFullDayHours: {
      type: Number,
      required: true,
      default: 8,
      min: [1, "Full day hours must be at least 1"],
    },
    minHalfDayHours: {
      type: Number,
      required: true,
      default: 4,
      min: [0.5, "Half day hours must be at least 0.5"],
    },
    monthlyWfhQuota: {
      type: Number,
      required: true,
      default: 4,
      min: [0, "WFH quota cannot be negative"],
    },
    absenceEvaluationCutoffTime: {
      type: String,
      required: true,
      default: "23:59",
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm format"],
    },
    wfhRules: {
      type: WfhPolicyRulesSubSchema,
      default: () => ({}),
    },
    qrRotationSeconds: {
      type: Number,
      required: true,
      default: 30,
      min: [10, "QR rotation cannot be less than 10 seconds"],
      max: [120, "QR rotation cannot exceed 120 seconds"],
    },
    qrGraceSeconds: {
      type: Number,
      required: true,
      default: 15,
      min: [5, "QR grace window cannot be less than 5 seconds"],
    },
    punchCooldownMinutes: {
      type: Number,
      required: true,
      default: 2,
      min: [0, "Cooldown cannot be negative"],
    },
    allowOvertime: {
      type: Boolean,
      default: false,
    },
    workdays: {
      type: [Number],
      default: [1, 2, 3, 4, 5], // Monday through Friday
      validate: {
        validator: (days: number[]) => days.every((d) => d >= 0 && d <= 6),
        message: "Workdays must contain valid day-of-week integers (0 to 6)",
      },
    },
    shifts: {
      type: [ShiftSubSchema],
      default: [
        {
          name: "Morning General Shift",
          startTime: "09:00",
          endTime: "17:00",
          graceMinutes: 15,
          isOvernight: false,
          isActive: true,
        },
      ],
    },
    isDefault: {
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

export const AttendancePolicy = model<IAttendancePolicy>(
  "AttendancePolicy",
  AttendancePolicySchema
);
