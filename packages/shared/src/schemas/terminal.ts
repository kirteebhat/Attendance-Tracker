import { z } from "zod";
import { TerminalStatus } from "../constants/enums";

export const QrPayloadSchema = z.object({
  v: z.number().int().default(1),
  tid: z.string().min(1, "Terminal ID is required"),
  ts: z.number().int(),
  exp: z.number().int(),
  n: z.string().min(8, "Nonce must be at least 8 characters"),
  sig: z.string().min(16, "Signature is required"),
});

export type QrPayload = z.infer<typeof QrPayloadSchema>;

export const TerminalCreateRequestSchema = z.object({
  name: z.string().min(2, "Terminal name must be at least 2 characters").max(100),
  location: z.string().min(2, "Location description is required").max(100),
});

export type TerminalCreateRequest = z.infer<typeof TerminalCreateRequestSchema>;

export const TerminalPairRequestSchema = z.object({
  pairingCode: z.string().trim().min(4, "Pairing code is required").max(12),
});

export type TerminalPairRequest = z.infer<typeof TerminalPairRequestSchema>;

export const TerminalStatusUpdateRequestSchema = z.object({
  isActive: z.boolean().optional(),
  status: z.nativeEnum(TerminalStatus).optional(),
  reason: z.string().trim().optional(),
});

export type TerminalStatusUpdateRequest = z.infer<typeof TerminalStatusUpdateRequestSchema>;

// Aliases for Display naming
export const DisplayRegisterSchema = TerminalCreateRequestSchema;
export type DisplayRegister = z.infer<typeof DisplayRegisterSchema>;

export const DisplayPairSchema = TerminalPairRequestSchema;
export type DisplayPair = z.infer<typeof DisplayPairSchema>;

export const DisplayStatusUpdateSchema = TerminalStatusUpdateRequestSchema;
export type DisplayStatusUpdate = z.infer<typeof DisplayStatusUpdateSchema>;

export const QrTokenRequestSchema = z.object({
  displayId: z.string().trim().optional(),
  terminalId: z.string().trim().optional(),
});

export type QrTokenRequest = z.infer<typeof QrTokenRequestSchema>;

export const QrTokenResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  qrPayload: z.string(),
  displayId: z.string(),
  terminalId: z.string(),
  issuedAt: z.string(),
  expiresAt: z.string(),
  ttlSeconds: z.number(),
  serverTime: z.number(),
});

export type QrTokenResponse = z.infer<typeof QrTokenResponseSchema>;

export const QrValidationRequestSchema = z.object({
  token: z.string().min(1, "QR token is required"),
});

export type QrValidationRequest = z.infer<typeof QrValidationRequestSchema>;

export const TerminalRecordSchema = z.object({
  _id: z.string(),
  terminalId: z.string(),
  name: z.string(),
  location: z.string(),
  pairingCode: z.string().optional(),
  pairingCodeExpiresAt: z.string().datetime().optional(),
  isPaired: z.boolean(),
  isActive: z.boolean(),
  status: z.nativeEnum(TerminalStatus).default(TerminalStatus.ACTIVE),
  lastHeartbeat: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type TerminalRecord = z.infer<typeof TerminalRecordSchema>;
