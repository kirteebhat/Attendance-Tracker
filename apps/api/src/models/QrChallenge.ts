import { Schema, model, Document, Types } from "mongoose";

export interface IQrChallenge extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  employeeId: string;
  qrNonce: string;
  terminalId: string;
  redeemedAt: Date;
  createdAt: Date;
}

const QrChallengeSchema = new Schema<IQrChallenge>(
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
    },
    qrNonce: {
      type: String,
      required: [true, "QR Nonce is required"],
      trim: true,
    },
    terminalId: {
      type: String,
      required: [true, "Terminal ID is required"],
      trim: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      // TTL INDEX: Document automatically deletes from MongoDB 120 seconds after creation
      expires: 120,
    },
  },
  {
    versionKey: false,
  }
);

// CRITICAL REPLAY DEFENSE: Unique compound index prevents the same employee from redeeming the same nonce twice
QrChallengeSchema.index({ employee: 1, qrNonce: 1 }, { unique: true });
QrChallengeSchema.index({ employeeId: 1, qrNonce: 1 });

export const QrChallenge = model<IQrChallenge>("QrChallenge", QrChallengeSchema);
