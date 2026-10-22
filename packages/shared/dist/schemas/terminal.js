"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalRecordSchema = exports.QrValidationRequestSchema = exports.QrTokenResponseSchema = exports.QrTokenRequestSchema = exports.DisplayStatusUpdateSchema = exports.DisplayPairSchema = exports.DisplayRegisterSchema = exports.TerminalStatusUpdateRequestSchema = exports.TerminalPairRequestSchema = exports.TerminalCreateRequestSchema = exports.QrPayloadSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.QrPayloadSchema = zod_1.z.object({
    v: zod_1.z.number().int().default(1),
    tid: zod_1.z.string().min(1, "Terminal ID is required"),
    ts: zod_1.z.number().int(),
    exp: zod_1.z.number().int(),
    n: zod_1.z.string().min(8, "Nonce must be at least 8 characters"),
    sig: zod_1.z.string().min(16, "Signature is required"),
});
exports.TerminalCreateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Terminal name must be at least 2 characters").max(100),
    location: zod_1.z.string().min(2, "Location description is required").max(100),
});
exports.TerminalPairRequestSchema = zod_1.z.object({
    pairingCode: zod_1.z.string().trim().min(4, "Pairing code is required").max(12),
});
exports.TerminalStatusUpdateRequestSchema = zod_1.z.object({
    isActive: zod_1.z.boolean().optional(),
    status: zod_1.z.nativeEnum(enums_1.TerminalStatus).optional(),
    reason: zod_1.z.string().trim().optional(),
});
// Aliases for Display naming
exports.DisplayRegisterSchema = exports.TerminalCreateRequestSchema;
exports.DisplayPairSchema = exports.TerminalPairRequestSchema;
exports.DisplayStatusUpdateSchema = exports.TerminalStatusUpdateRequestSchema;
exports.QrTokenRequestSchema = zod_1.z.object({
    displayId: zod_1.z.string().trim().optional(),
    terminalId: zod_1.z.string().trim().optional(),
});
exports.QrTokenResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    token: zod_1.z.string(),
    qrPayload: zod_1.z.string(),
    displayId: zod_1.z.string(),
    terminalId: zod_1.z.string(),
    issuedAt: zod_1.z.string(),
    expiresAt: zod_1.z.string(),
    ttlSeconds: zod_1.z.number(),
    serverTime: zod_1.z.number(),
});
exports.QrValidationRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "QR token is required"),
});
exports.TerminalRecordSchema = zod_1.z.object({
    _id: zod_1.z.string(),
    terminalId: zod_1.z.string(),
    name: zod_1.z.string(),
    location: zod_1.z.string(),
    pairingCode: zod_1.z.string().optional(),
    pairingCodeExpiresAt: zod_1.z.string().datetime().optional(),
    isPaired: zod_1.z.boolean(),
    isActive: zod_1.z.boolean(),
    status: zod_1.z.nativeEnum(enums_1.TerminalStatus).default(enums_1.TerminalStatus.ACTIVE),
    lastHeartbeat: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
