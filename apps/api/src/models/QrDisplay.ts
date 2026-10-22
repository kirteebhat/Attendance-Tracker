import { Schema, model, Document, Types } from "mongoose";
import { TerminalStatus } from "@vorldx/shared";

export interface IQrDisplay extends Document {
  _id: Types.ObjectId;
  terminalId: string;
  name: string;
  location: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: Date;
  isPaired: boolean;
  isActive: boolean;
  status: TerminalStatus;
  displayCredentialHash?: string;
  terminalSecret?: string;
  tokenEpoch: number;
  pairedAt?: Date;
  lastSeen?: Date;
  lastHeartbeat?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QrDisplaySchema = new Schema<IQrDisplay>(
  {
    terminalId: {
      type: String,
      required: [true, "Terminal ID is required"],
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Terminal name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    location: {
      type: String,
      required: [true, "Location description is required"],
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
    },
    pairingCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true, // Only index documents that have a pairing code
      index: true,
    },
    pairingCodeExpiresAt: {
      type: Date,
      default: null,
    },
    isPaired: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TerminalStatus),
      default: TerminalStatus.UNPAIRED,
      required: true,
      index: true,
    },
    terminalSecret: {
      type: String,
      default: null,
    },
    displayCredentialHash: {
      type: String,
      default: null,
    },
    tokenEpoch: {
      type: Number,
      default: 1,
    },
    pairedAt: {
      type: Date,
      default: null,
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    lastHeartbeat: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const QrDisplay = model<IQrDisplay>("QrDisplay", QrDisplaySchema);
