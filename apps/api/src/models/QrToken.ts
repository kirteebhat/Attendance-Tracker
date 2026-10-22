import { Schema, model, Document, Types } from "mongoose";

export interface IQrToken extends Document {
  _id: Types.ObjectId;
  token: string;
  displayId: string;
  terminalId: string;
  tokenEpoch: number;
  issuedAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

const QrTokenSchema = new Schema<IQrToken>(
  {
    token: {
      type: String,
      required: [true, "QR token string is required"],
      unique: true,
      index: true,
    },
    displayId: {
      type: String,
      required: [true, "Display ID is required"],
      index: true,
      trim: true,
    },
    terminalId: {
      type: String,
      required: [true, "Terminal ID is required"],
      index: true,
      trim: true,
    },
    tokenEpoch: {
      type: Number,
      required: true,
      default: 1,
    },
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // TTL index: auto-purged from MongoDB 10 minutes (600s) after creation
      expires: 600,
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Indexes for rapid queries and revocation checks
QrTokenSchema.index({ displayId: 1, isRevoked: 1 });
QrTokenSchema.index({ terminalId: 1, isRevoked: 1 });

export const QrToken = model<IQrToken>("QrToken", QrTokenSchema);
