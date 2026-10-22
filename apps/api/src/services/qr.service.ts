import crypto from "crypto";
import { QrDisplay, IQrDisplay, QrToken, IQrToken, AuditEvent } from "../models";
import { AppError } from "../utils/AppError";
import { eventEmitterService } from "./eventEmitter.service";
import { ApiErrorCode, TerminalStatus } from "@vorldx/shared";
import { env } from "../config/env";

export interface QrValidationResult {
  isValid: boolean;
  code?: string;
  message?: string;
  displayId?: string;
  terminalId?: string;
  display?: IQrDisplay;
  tokenRecord?: IQrToken;
}

export interface DisplayResponse {
  _id: string;
  terminalId: string;
  displayId: string;
  name: string;
  location: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  isPaired: boolean;
  isActive: boolean;
  status: TerminalStatus;
  tokenEpoch: number;
  pairedAt?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strips secret credentials from QrDisplay document for safe API serialization
 */
function sanitizeDisplay(doc: IQrDisplay): DisplayResponse {
  const obj = doc.toObject();
  const lastSeenDate = obj.lastSeen || obj.lastHeartbeat;
  return {
    _id: obj._id.toString(),
    terminalId: obj.terminalId,
    displayId: obj.terminalId,
    name: obj.name,
    location: obj.location,
    pairingCode: obj.pairingCode,
    pairingCodeExpiresAt: obj.pairingCodeExpiresAt?.toISOString(),
    isPaired: obj.isPaired,
    isActive: obj.isActive,
    status: obj.status,
    tokenEpoch: obj.tokenEpoch,
    pairedAt: obj.pairedAt?.toISOString(),
    lastSeen: lastSeenDate ? new Date(lastSeenDate).toISOString() : undefined,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
  };
}

/**
 * Computes a SHA-256 hash of a credential string for secure at-rest storage
 */
export function hashCredential(credential: string): string {
  return crypto.createHash("sha256").update(credential).digest("hex");
}

/**
 * Constant-time hash verification to prevent timing attacks
 */
function verifyCredentialHash(providedCredential: string, storedHash: string): boolean {
  const candidateHash = hashCredential(providedCredential);
  if (candidateHash.length !== storedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
}

/**
 * Registers a new office display terminal (HR/Admin only).
 * Generates an initial one-time pairing code valid for 15 minutes.
 */
export async function registerDisplay(
  data: { name: string; location: string },
  actor?: { id: string; employeeId?: string; role?: string }
): Promise<DisplayResponse> {
  const terminalId = `disp_${crypto.randomBytes(4).toString("hex")}`;
  const pairingCode = `VX-${Math.floor(1000 + Math.random() * 9000)}`;
  const pairingCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const display = await QrDisplay.create({
    terminalId,
    name: data.name.trim(),
    location: data.location.trim(),
    pairingCode,
    pairingCodeExpiresAt,
    isPaired: false,
    isActive: true,
    status: TerminalStatus.UNPAIRED,
    tokenEpoch: 1,
  });

  if (actor) {
    await AuditEvent.create({
      actor: actor.id,
      actorEmployeeId: actor.employeeId || "ADMIN",
      actorRole: actor.role || "ADMIN",
      action: "CREATE",
      entityType: "TERMINAL",
      entityId: display._id,
      details: {
        terminalId: display.terminalId,
        name: display.name,
        location: display.location,
      },
    });
  }

  return sanitizeDisplay(display);
}

/**
 * Lists all registered displays with status and lastSeen timestamps
 */
export async function listDisplays(): Promise<DisplayResponse[]> {
  const displays = await QrDisplay.find().sort({ createdAt: -1 });
  return displays.map(sanitizeDisplay);
}

/**
 * Retrieves a single display by ID or terminalId
 */
export async function getDisplayById(idOrTerminalId: string): Promise<DisplayResponse> {
  const query = idOrTerminalId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: idOrTerminalId }
    : { terminalId: idOrTerminalId };

  const display = await QrDisplay.findOne(query);
  if (!display) {
    throw new AppError(404, ApiErrorCode.ERR_DISPLAY_NOT_FOUND, "Display terminal not found.");
  }

  return sanitizeDisplay(display);
}

/**
 * Pairs a physical display using a one-time pairing code.
 * Generates a display credential, stores its SHA-256 hash, and invalidates the pairing code.
 */
export async function pairDisplay(pairingCode: string): Promise<{
  success: boolean;
  displayId: string;
  terminalId: string;
  credential: string;
  name: string;
  location: string;
}> {
  const normalizedCode = pairingCode.trim().toUpperCase();

  const display = await QrDisplay.findOne({
    pairingCode: normalizedCode,
    isPaired: false,
    pairingCodeExpiresAt: { $gt: new Date() },
  });

  if (!display) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_INVALID_PAIRING_CODE,
      "Invalid or expired pairing code."
    );
  }

  if (!display.isActive || display.status === TerminalStatus.DISABLED) {
    throw new AppError(
      403,
      ApiErrorCode.ERR_DISPLAY_DISABLED,
      "Cannot pair a disabled display terminal."
    );
  }

  if (display.status === TerminalStatus.REVOKED) {
    throw new AppError(
      403,
      ApiErrorCode.ERR_DISPLAY_REVOKED,
      "Cannot pair a revoked display terminal."
    );
  }

  // Generate cryptographically secure 32-byte display credential
  const rawCredential = `disp_cred_${crypto.randomBytes(32).toString("hex")}`;
  const credentialHash = hashCredential(rawCredential);

  display.isPaired = true;
  display.status = TerminalStatus.ACTIVE;
  display.displayCredentialHash = credentialHash;
  display.terminalSecret = credentialHash;
  display.pairedAt = new Date();
  display.lastSeen = new Date();
  display.lastHeartbeat = new Date();
  display.pairingCode = undefined;
  display.pairingCodeExpiresAt = undefined;

  await display.save();

  await AuditEvent.create({
    actor: display._id,
    actorEmployeeId: display.terminalId,
    actorRole: "SYSTEM",
    action: "UPDATE",
    entityType: "TERMINAL",
    entityId: display._id,
    details: {
      action: "PAIR",
      terminalId: display.terminalId,
      pairedAt: display.pairedAt,
    },
  });

  return {
    success: true,
    displayId: display.terminalId,
    terminalId: display.terminalId,
    credential: rawCredential,
    name: display.name,
    location: display.location,
  };
}

/**
 * Reauthorizes a display terminal by generating a new one-time pairing code
 * and invalidating previous credentials and issued tokens.
 */
export async function authorizeDisplay(
  idOrTerminalId: string,
  actor?: { id: string; employeeId?: string; role?: string }
): Promise<DisplayResponse> {
  const query = idOrTerminalId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: idOrTerminalId }
    : { terminalId: idOrTerminalId };

  const display = await QrDisplay.findOne(query);
  if (!display) {
    throw new AppError(404, ApiErrorCode.ERR_DISPLAY_NOT_FOUND, "Display terminal not found.");
  }

  const previousState = display.toObject();
  const pairingCode = `VX-${Math.floor(1000 + Math.random() * 9000)}`;
  const pairingCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  display.pairingCode = pairingCode;
  display.pairingCodeExpiresAt = pairingCodeExpiresAt;
  display.isPaired = false;
  display.isActive = true;
  display.status = TerminalStatus.UNPAIRED;
  display.displayCredentialHash = undefined;
  display.terminalSecret = undefined;
  display.tokenEpoch = (display.tokenEpoch || 1) + 1;

  await display.save();

  // Invalidate any previously active tokens for this display
  await QrToken.updateMany({ displayId: display.terminalId }, { $set: { isRevoked: true } });

  if (actor) {
    await AuditEvent.create({
      actor: actor.id,
      actorEmployeeId: actor.employeeId || "ADMIN",
      actorRole: actor.role || "ADMIN",
      action: "UPDATE",
      entityType: "TERMINAL",
      entityId: display._id,
      previousValue: previousState,
      newValue: display.toObject(),
      details: { action: "AUTHORIZE", newPairingCode: pairingCode },
    });
  }

  return sanitizeDisplay(display);
}

/**
 * Enables or disables an active display terminal.
 * Disabling prevents the display from getting new tokens and blocks punch validations.
 */
export async function updateDisplayStatus(
  idOrTerminalId: string,
  isActive: boolean,
  reason?: string,
  actor?: { id: string; employeeId?: string; role?: string }
): Promise<DisplayResponse> {
  const query = idOrTerminalId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: idOrTerminalId }
    : { terminalId: idOrTerminalId };

  const display = await QrDisplay.findOne(query);
  if (!display) {
    throw new AppError(404, ApiErrorCode.ERR_DISPLAY_NOT_FOUND, "Display terminal not found.");
  }

  if (display.status === TerminalStatus.REVOKED && isActive) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_DISPLAY_REVOKED,
      "A revoked display cannot be re-enabled without reauthorization."
    );
  }

  const previousState = display.toObject();

  display.isActive = isActive;
  if (!isActive) {
    display.status = TerminalStatus.DISABLED;
  } else {
    display.status = display.isPaired ? TerminalStatus.ACTIVE : TerminalStatus.UNPAIRED;
  }

  await display.save();

  if (actor) {
    await AuditEvent.create({
      actor: actor.id,
      actorEmployeeId: actor.employeeId || "ADMIN",
      actorRole: actor.role || "ADMIN",
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      entityType: "TERMINAL",
      entityId: display._id,
      previousValue: previousState,
      newValue: display.toObject(),
      reason,
    });
  }

  eventEmitterService.emitDisplayStatus({
    terminalId: display.terminalId,
    displayId: display.terminalId,
    name: display.name,
    isActive: display.isActive,
    status: display.status,
    message: isActive
      ? "Display terminal activated."
      : "Display terminal disabled by administrator.",
  });

  return sanitizeDisplay(display);
}

/**
 * Revokes a display terminal.
 * Wipes credentials, increments tokenEpoch, and immediately marks all issued tokens as revoked.
 */
export async function revokeDisplay(
  idOrTerminalId: string,
  reason?: string,
  actor?: { id: string; employeeId?: string; role?: string }
): Promise<DisplayResponse> {
  const query = idOrTerminalId.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: idOrTerminalId }
    : { terminalId: idOrTerminalId };

  const display = await QrDisplay.findOne(query);
  if (!display) {
    throw new AppError(404, ApiErrorCode.ERR_DISPLAY_NOT_FOUND, "Display terminal not found.");
  }

  const previousState = display.toObject();

  display.status = TerminalStatus.REVOKED;
  display.isActive = false;
  display.tokenEpoch = (display.tokenEpoch || 1) + 1;
  display.displayCredentialHash = undefined;
  display.terminalSecret = undefined;

  await display.save();

  // Invalidate all tokens previously issued by this display
  await QrToken.updateMany({ displayId: display.terminalId }, { $set: { isRevoked: true } });

  if (actor) {
    await AuditEvent.create({
      actor: actor.id,
      actorEmployeeId: actor.employeeId || "ADMIN",
      actorRole: actor.role || "ADMIN",
      action: "DEACTIVATE",
      entityType: "TERMINAL",
      entityId: display._id,
      previousValue: previousState,
      newValue: display.toObject(),
      reason: reason || "Display terminal revoked",
    });
  }

  eventEmitterService.emitDisplayStatus({
    terminalId: display.terminalId,
    displayId: display.terminalId,
    name: display.name,
    isActive: display.isActive,
    status: display.status,
    message: "Display terminal revoked. Reauthorization required.",
  });

  return sanitizeDisplay(display);
}

/**
 * Validates display authentication credentials from headers
 */
export async function authenticateDisplay(
  displayId: string,
  credential: string
): Promise<IQrDisplay> {
  if (!displayId || !credential) {
    throw new AppError(
      401,
      ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED,
      "Display ID and credential are required."
    );
  }

  const display = await QrDisplay.findOne({ terminalId: displayId });
  if (!display) {
    throw new AppError(401, ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED, "Invalid display credentials.");
  }

  if (!display.displayCredentialHash) {
    throw new AppError(
      401,
      ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED,
      "Display has no active credentials."
    );
  }

  const isValid = verifyCredentialHash(credential, display.displayCredentialHash);
  if (!isValid) {
    throw new AppError(401, ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED, "Invalid display credentials.");
  }

  if (display.status === TerminalStatus.REVOKED) {
    throw new AppError(
      403,
      ApiErrorCode.ERR_DISPLAY_REVOKED,
      "Display has been revoked. Reauthorization required."
    );
  }

  if (!display.isActive || display.status === TerminalStatus.DISABLED) {
    throw new AppError(
      403,
      ApiErrorCode.ERR_DISPLAY_DISABLED,
      "Display terminal is currently disabled."
    );
  }

  if (!display.isPaired || display.status === TerminalStatus.UNPAIRED) {
    throw new AppError(403, ApiErrorCode.ERR_DISPLAY_UNPAIRED, "Display terminal is not paired.");
  }

  // Update heartbeat and last seen timestamp
  display.lastSeen = new Date();
  display.lastHeartbeat = new Date();
  await display.save();

  return display;
}

/**
 * Requests a new rotating QR challenge for an authorized display.
 * Generates an opaque short-lived token (default 45s), stores it with displayId,
 * and returns it without any sensitive employee data or reusable secret.
 */
export async function requestRotatingChallenge(
  displayId: string,
  credential: string,
  customTtlSeconds?: number
): Promise<{
  success: boolean;
  token: string;
  qrPayload: string;
  displayId: string;
  terminalId: string;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  serverTime: number;
}> {
  const display = await authenticateDisplay(displayId, credential);

  const ttlSeconds = customTtlSeconds || env.QR_ROTATION_SECONDS + env.QR_GRACE_SECONDS; // 30 + 15 = 45s
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);

  // Cryptographically random opaque token (no employee data, no server secret)
  const opaqueToken = `qrt_${crypto.randomBytes(32).toString("base64url")}`;

  await QrToken.create({
    token: opaqueToken,
    displayId: display.terminalId,
    terminalId: display.terminalId,
    tokenEpoch: display.tokenEpoch,
    issuedAt,
    expiresAt,
    isRevoked: false,
  });

  eventEmitterService.emitQrRotated({
    terminalId: display.terminalId,
    displayId: display.terminalId,
    token: opaqueToken,
    qrPayload: opaqueToken,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttlSeconds,
    serverTime: issuedAt.getTime(),
  });

  return {
    success: true,
    token: opaqueToken,
    qrPayload: opaqueToken,
    displayId: display.terminalId,
    terminalId: display.terminalId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ttlSeconds,
    serverTime: issuedAt.getTime(),
  };
}

/**
 * Validation service used by Attendance punch logic:
 * Checks signature / lookup, expiry, revocation, and display status.
 */
export async function validateQrToken(tokenString: string): Promise<QrValidationResult> {
  if (!tokenString || typeof tokenString !== "string" || !tokenString.trim()) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_INVALID_QR_TOKEN,
      message: "QR token payload is required.",
    };
  }

  let candidateToken = tokenString.trim();

  // Support JSON payload wrapper if scanned
  if (candidateToken.startsWith("{") && candidateToken.endsWith("}")) {
    try {
      const parsed = JSON.parse(candidateToken);
      if (parsed.token) candidateToken = parsed.token;
      else if (parsed.qrPayload) candidateToken = parsed.qrPayload;
    } catch {
      // Continue with raw token string
    }
  }

  // 1. Direct Lookup in QrToken collection
  const tokenRecord = await QrToken.findOne({ token: candidateToken });

  if (!tokenRecord) {
    // Check if it's an HMAC-signed token payload
    return validateHmacSignedToken(candidateToken);
  }

  // 2. Token Revocation Check
  if (tokenRecord.isRevoked) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_QR_REVOKED,
      message: "This QR token has been revoked.",
    };
  }

  // 3. Token Expiry Check
  const now = Date.now();
  if (tokenRecord.expiresAt.getTime() < now) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_QR_EXPIRED,
      message: "QR token has expired. Please scan the current code on screen.",
    };
  }

  // 4. Associated Display Lookup & Status Check
  const display = await QrDisplay.findOne({ terminalId: tokenRecord.displayId });
  if (!display) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_DISPLAY_NOT_FOUND,
      message: "Associated display terminal not found.",
    };
  }

  if (display.status === TerminalStatus.REVOKED) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_DISPLAY_REVOKED,
      message: "Associated display terminal has been revoked.",
    };
  }

  if (!display.isActive || display.status === TerminalStatus.DISABLED) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_DISPLAY_DISABLED,
      message: "Associated display terminal is currently disabled.",
    };
  }

  if (tokenRecord.tokenEpoch !== display.tokenEpoch) {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_DISPLAY_REVOKED,
      message: "QR token belongs to a previous revoked display epoch.",
    };
  }

  return {
    isValid: true,
    displayId: display.terminalId,
    terminalId: display.terminalId,
    display,
    tokenRecord,
  };
}

interface SignedTokenPayload {
  v?: number;
  tid: string;
  ts: number;
  exp: number;
  n: string;
  sig: string;
}

/**
 * Fallback validator for HMAC-signed structured tokens
 */
async function validateHmacSignedToken(rawPayload: string): Promise<QrValidationResult> {
  try {
    let payloadObj: SignedTokenPayload | null = null;
    if (rawPayload.startsWith("{")) {
      payloadObj = JSON.parse(rawPayload) as SignedTokenPayload;
    }

    if (!payloadObj || !payloadObj.tid || !payloadObj.sig || !payloadObj.ts || !payloadObj.exp) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_INVALID_QR_TOKEN,
        message: "Invalid or forged QR token.",
      };
    }

    const { tid, ts, exp, n, sig } = payloadObj;

    const display = await QrDisplay.findOne({ terminalId: tid });
    if (!display) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_DISPLAY_NOT_FOUND,
        message: "Associated display terminal not found.",
      };
    }

    if (display.status === TerminalStatus.REVOKED) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_DISPLAY_REVOKED,
        message: "Associated display terminal has been revoked.",
      };
    }

    if (!display.isActive || display.status === TerminalStatus.DISABLED) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_DISPLAY_DISABLED,
        message: "Associated display terminal is currently disabled.",
      };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const latencyGrace = env.QR_GRACE_SECONDS; // 15s

    if (nowSeconds > exp + latencyGrace) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_QR_EXPIRED,
        message: "QR token has expired.",
      };
    }

    const secret = display.displayCredentialHash || display.terminalSecret;
    if (!secret) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_INVALID_QR_SIGNATURE,
        message: "Display has no active signing key.",
      };
    }

    const expectedPayload = `1:${tid}:${ts}:${exp}:${n}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

    if (
      expectedSig.length !== sig.length ||
      !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig))
    ) {
      return {
        isValid: false,
        code: ApiErrorCode.ERR_INVALID_QR_SIGNATURE,
        message: "Invalid or forged QR token signature.",
      };
    }

    return {
      isValid: true,
      displayId: display.terminalId,
      terminalId: display.terminalId,
      display,
    };
  } catch {
    return {
      isValid: false,
      code: ApiErrorCode.ERR_INVALID_QR_TOKEN,
      message: "Invalid or forged QR token.",
    };
  }
}
