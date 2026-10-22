import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as qrService from "../services/qr.service";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";

/**
 * Helper to extract display credentials from various request headers or body
 */
function extractDisplayCredentials(req: Request): { displayId: string; credential: string } {
  const displayId =
    (req.headers["x-display-id"] as string) ||
    (req.headers["x-terminal-id"] as string) ||
    req.body?.displayId ||
    req.body?.terminalId;

  let credential =
    (req.headers["x-display-credential"] as string) ||
    (req.headers["x-terminal-secret"] as string) ||
    req.body?.credential ||
    req.body?.terminalSecret;

  if (!credential && req.headers.authorization?.startsWith("Bearer ")) {
    credential = req.headers.authorization.substring(7);
  }

  if (!displayId || !credential) {
    throw new AppError(
      401,
      ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED,
      "Display credentials required via headers (x-display-id, x-display-credential) or Bearer token."
    );
  }

  return { displayId, credential };
}

/**
 * HR / Admin: Register a new display terminal
 */
export const registerDisplay = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user
    ? { id: req.user.userId, employeeId: req.user.employeeId, role: req.user.role }
    : undefined;

  const display = await qrService.registerDisplay(req.body, actor);

  res.status(201).json({
    success: true,
    message: "Display terminal registered successfully",
    data: display,
  });
});

/**
 * HR / Admin: List all displays
 */
export const listDisplays = asyncHandler(async (_req: Request, res: Response) => {
  const displays = await qrService.listDisplays();

  res.status(200).json({
    success: true,
    data: displays,
  });
});

/**
 * HR / Admin: Get display by ID or terminalId
 */
export const getDisplayById = asyncHandler(async (req: Request, res: Response) => {
  const display = await qrService.getDisplayById(req.params.id);

  res.status(200).json({
    success: true,
    data: display,
  });
});

/**
 * Display Kiosk: Pair using one-time pairing code
 */
export const pairDisplay = asyncHandler(async (req: Request, res: Response) => {
  const pairingCode = req.body.pairingCode;
  if (!pairingCode) {
    throw new AppError(
      400,
      ApiErrorCode.ERR_INVALID_PAIRING_CODE,
      "Pairing code is required in request body."
    );
  }

  const result = await qrService.pairDisplay(pairingCode);

  res.status(200).json(result);
});

/**
 * HR / Admin: Reauthorize display with new pairing code
 */
export const authorizeDisplay = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user
    ? { id: req.user.userId, employeeId: req.user.employeeId, role: req.user.role }
    : undefined;

  const display = await qrService.authorizeDisplay(req.params.id, actor);

  res.status(200).json({
    success: true,
    message: "Display terminal reauthorized with new pairing code",
    data: display,
  });
});

/**
 * HR / Admin: Enable or disable display
 */
export const updateDisplayStatus = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user
    ? { id: req.user.userId, employeeId: req.user.employeeId, role: req.user.role }
    : undefined;

  const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;
  const reason = req.body.reason;

  const display = await qrService.updateDisplayStatus(req.params.id, isActive, reason, actor);

  res.status(200).json({
    success: true,
    message: `Display terminal ${isActive ? "enabled" : "disabled"} successfully`,
    data: display,
  });
});

/**
 * HR / Admin: Revoke display terminal credentials
 */
export const revokeDisplay = asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user
    ? { id: req.user.userId, employeeId: req.user.employeeId, role: req.user.role }
    : undefined;

  const reason = req.body?.reason;
  const display = await qrService.revokeDisplay(req.params.id, reason, actor);

  res.status(200).json({
    success: true,
    message: "Display terminal revoked successfully; all issued tokens invalidated",
    data: display,
  });
});

/**
 * Display Kiosk: Request new rotating QR challenge
 */
export const requestRotatingToken = asyncHandler(async (req: Request, res: Response) => {
  const { displayId, credential } = extractDisplayCredentials(req);
  const result = await qrService.requestRotatingChallenge(displayId, credential);

  res.status(200).json(result);
});

/**
 * Diagnostic / Testing: Validate a QR token
 */
export const validateToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.body.token || req.body.qrPayload;
  const result = await qrService.validateQrToken(token);

  if (!result.isValid) {
    res.status(400).json({
      success: false,
      code: result.code || ApiErrorCode.ERR_INVALID_QR_TOKEN,
      message: result.message || "Invalid QR token",
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: "QR token is valid",
    displayId: result.displayId,
    terminalId: result.terminalId,
  });
});
