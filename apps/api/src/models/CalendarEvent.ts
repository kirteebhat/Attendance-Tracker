import { Schema, model, Document, Types } from "mongoose";

export type CalendarEventType = "holiday" | "companyOffDay" | "meeting" | "event";
export type CalendarEventSource = "manual" | "imported";

export interface ICalendarAudience {
  scope: "all" | "department" | "shift" | "custom";
  departments: string[];
  roles: string[];
  shiftIds: string[];
}

export interface ICalendarEvent extends Document {
  _id: Types.ObjectId;
  type: CalendarEventType;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isFullDay: boolean;
  source: CalendarEventSource;
  audience: ICalendarAudience;
  externalId?: string;
  location?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    type: {
      type: String,
      enum: ["holiday", "companyOffDay", "meeting", "event"],
      required: [true, "Event type is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
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
    isFullDay: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      enum: ["manual", "imported"],
      default: "manual",
      index: true,
    },
    audience: {
      scope: {
        type: String,
        enum: ["all", "department", "shift", "custom"],
        default: "all",
      },
      departments: [{ type: String, trim: true }],
      roles: [{ type: String, trim: true }],
      shiftIds: [{ type: String, trim: true }],
    },
    externalId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// High-speed range queries for calendar views & monthly agendas
CalendarEventSchema.index({ startDate: 1, endDate: 1 });
CalendarEventSchema.index({ type: 1, startDate: 1 });
CalendarEventSchema.index({ "audience.scope": 1, startDate: 1 });

CalendarEventSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate("endDate", "End date must be greater than or equal to start date");
  }
  next();
});

export const CalendarEvent = model<ICalendarEvent>("CalendarEvent", CalendarEventSchema);

