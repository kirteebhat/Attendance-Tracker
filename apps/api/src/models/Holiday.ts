import { Schema, model, Document, Types } from "mongoose";

export interface IHoliday extends Document {
  _id: Types.ObjectId;
  name: string;
  dateKey: string; // YYYY-MM-DD
  description?: string;
  isRecurring: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HolidaySchema = new Schema<IHoliday>(
  {
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    dateKey: {
      type: String,
      required: [true, "Date is required"],
      unique: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD format"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Holiday = model<IHoliday>("Holiday", HolidaySchema);
