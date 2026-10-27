import { Schema, model, Document, Types } from "mongoose";

export interface IEnquiryMessage extends Document {
  _id: Types.ObjectId;
  enquiry: Types.ObjectId;
  sender: Types.ObjectId;
  senderRole: "EMPLOYEE" | "HR" | "ADMIN";
  message: string;
  attachments: string[];
  readByRecipient: boolean;
  createdAt: Date;
}

const EnquiryMessageSchema = new Schema<IEnquiryMessage>(
  {
    enquiry: {
      type: Schema.Types.ObjectId,
      ref: "Enquiry",
      required: [true, "Enquiry reference is required"],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender reference is required"],
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["EMPLOYEE", "HR", "ADMIN"],
      required: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      minlength: [1, "Message cannot be empty"],
      maxlength: [3000, "Message cannot exceed 3000 characters"],
    },
    attachments: [
      {
        type: String,
        trim: true,
      },
    ],
    readByRecipient: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

// High-speed conversation thread lookup
EnquiryMessageSchema.index({ enquiry: 1, createdAt: 1 });

export const EnquiryMessage = model<IEnquiryMessage>("EnquiryMessage", EnquiryMessageSchema);
