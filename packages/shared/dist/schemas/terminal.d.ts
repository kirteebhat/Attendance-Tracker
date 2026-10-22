import { z } from "zod";
import { TerminalStatus } from "../constants/enums";
export declare const QrPayloadSchema: z.ZodObject<{
    v: z.ZodDefault<z.ZodNumber>;
    tid: z.ZodString;
    ts: z.ZodNumber;
    exp: z.ZodNumber;
    n: z.ZodString;
    sig: z.ZodString;
}, "strip", z.ZodTypeAny, {
    v: number;
    tid: string;
    ts: number;
    exp: number;
    n: string;
    sig: string;
}, {
    tid: string;
    ts: number;
    exp: number;
    n: string;
    sig: string;
    v?: number | undefined;
}>;
export type QrPayload = z.infer<typeof QrPayloadSchema>;
export declare const TerminalCreateRequestSchema: z.ZodObject<{
    name: z.ZodString;
    location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    location: string;
}, {
    name: string;
    location: string;
}>;
export type TerminalCreateRequest = z.infer<typeof TerminalCreateRequestSchema>;
export declare const TerminalPairRequestSchema: z.ZodObject<{
    pairingCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pairingCode: string;
}, {
    pairingCode: string;
}>;
export type TerminalPairRequest = z.infer<typeof TerminalPairRequestSchema>;
export declare const TerminalStatusUpdateRequestSchema: z.ZodObject<{
    isActive: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof TerminalStatus>>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: TerminalStatus | undefined;
    reason?: string | undefined;
    isActive?: boolean | undefined;
}, {
    status?: TerminalStatus | undefined;
    reason?: string | undefined;
    isActive?: boolean | undefined;
}>;
export type TerminalStatusUpdateRequest = z.infer<typeof TerminalStatusUpdateRequestSchema>;
export declare const DisplayRegisterSchema: z.ZodObject<{
    name: z.ZodString;
    location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    location: string;
}, {
    name: string;
    location: string;
}>;
export type DisplayRegister = z.infer<typeof DisplayRegisterSchema>;
export declare const DisplayPairSchema: z.ZodObject<{
    pairingCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pairingCode: string;
}, {
    pairingCode: string;
}>;
export type DisplayPair = z.infer<typeof DisplayPairSchema>;
export declare const DisplayStatusUpdateSchema: z.ZodObject<{
    isActive: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodNativeEnum<typeof TerminalStatus>>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: TerminalStatus | undefined;
    reason?: string | undefined;
    isActive?: boolean | undefined;
}, {
    status?: TerminalStatus | undefined;
    reason?: string | undefined;
    isActive?: boolean | undefined;
}>;
export type DisplayStatusUpdate = z.infer<typeof DisplayStatusUpdateSchema>;
export declare const QrTokenRequestSchema: z.ZodObject<{
    displayId: z.ZodOptional<z.ZodString>;
    terminalId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    terminalId?: string | undefined;
    displayId?: string | undefined;
}, {
    terminalId?: string | undefined;
    displayId?: string | undefined;
}>;
export type QrTokenRequest = z.infer<typeof QrTokenRequestSchema>;
export declare const QrTokenResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    token: z.ZodString;
    qrPayload: z.ZodString;
    displayId: z.ZodString;
    terminalId: z.ZodString;
    issuedAt: z.ZodString;
    expiresAt: z.ZodString;
    ttlSeconds: z.ZodNumber;
    serverTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    qrPayload: string;
    token: string;
    terminalId: string;
    success: boolean;
    displayId: string;
    issuedAt: string;
    expiresAt: string;
    ttlSeconds: number;
    serverTime: number;
}, {
    qrPayload: string;
    token: string;
    terminalId: string;
    success: boolean;
    displayId: string;
    issuedAt: string;
    expiresAt: string;
    ttlSeconds: number;
    serverTime: number;
}>;
export type QrTokenResponse = z.infer<typeof QrTokenResponseSchema>;
export declare const QrValidationRequestSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type QrValidationRequest = z.infer<typeof QrValidationRequestSchema>;
export declare const TerminalRecordSchema: z.ZodObject<{
    _id: z.ZodString;
    terminalId: z.ZodString;
    name: z.ZodString;
    location: z.ZodString;
    pairingCode: z.ZodOptional<z.ZodString>;
    pairingCodeExpiresAt: z.ZodOptional<z.ZodString>;
    isPaired: z.ZodBoolean;
    isActive: z.ZodBoolean;
    status: z.ZodDefault<z.ZodNativeEnum<typeof TerminalStatus>>;
    lastHeartbeat: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: TerminalStatus;
    _id: string;
    name: string;
    terminalId: string;
    createdAt: string;
    location: string;
    isActive: boolean;
    isPaired: boolean;
    updatedAt?: string | undefined;
    pairingCode?: string | undefined;
    pairingCodeExpiresAt?: string | undefined;
    lastHeartbeat?: string | undefined;
}, {
    _id: string;
    name: string;
    terminalId: string;
    createdAt: string;
    location: string;
    isActive: boolean;
    isPaired: boolean;
    status?: TerminalStatus | undefined;
    updatedAt?: string | undefined;
    pairingCode?: string | undefined;
    pairingCodeExpiresAt?: string | undefined;
    lastHeartbeat?: string | undefined;
}>;
export type TerminalRecord = z.infer<typeof TerminalRecordSchema>;
//# sourceMappingURL=terminal.d.ts.map