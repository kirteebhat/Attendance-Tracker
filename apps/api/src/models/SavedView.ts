import { Schema, model, Document, Types } from "mongoose";

export interface ISavedView extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  page: string;
  name: string;
  filters: Record<string, unknown>;
  sort?: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SavedViewSchema = new Schema<ISavedView>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    page: {
      type: String,
      required: [true, "Page identifier is required"],
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Saved view name is required"],
      trim: true,
      minlength: [1, "Name must not be empty"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sort: {
      type: Schema.Types.Mixed,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// CRITICAL UNIQUE CONSTRAINT: View names are unique per user per page view
SavedViewSchema.index({ user: 1, page: 1, name: 1 }, { unique: true });

export const SavedView = model<ISavedView>("SavedView", SavedViewSchema);
