import { Schema, model, Document, Types } from "mongoose";
import { WorkType } from "@vorldx/shared";

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  workType: WorkType;
  shiftId?: Types.ObjectId;
  joiningDate: string;
  isActive: boolean;
  userId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Employee ID must be at least 3 characters"],
      maxlength: [20, "Employee ID cannot exceed 20 characters"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Employee name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
      index: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
      index: true,
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
    },
    workType: {
      type: String,
      enum: Object.values(WorkType),
      default: WorkType.FULL_TIME,
      required: true,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "AttendancePolicy.shifts",
      default: null,
    },
    joiningDate: {
      type: String,
      required: [true, "Joining date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Joining date must follow YYYY-MM-DD format"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Enables fast filtering for active roster vs soft-deleted employees
    },
    userId: {
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

// Indexes
EmployeeSchema.index({ department: 1, isActive: 1 });

export const Employee = model<IEmployee>("Employee", EmployeeSchema);
