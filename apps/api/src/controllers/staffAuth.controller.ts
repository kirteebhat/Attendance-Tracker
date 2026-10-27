import { Request, Response, NextFunction } from "express";
import { staffAuthService } from "../services/staffAuth.service";

export class StaffAuthController {
  /**
   * POST /api/auth/staff/otp-start
   */
  public async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
      const result = await staffAuthService.requestStaffOtp({
        mobileNumber: req.body.mobileNumber,
        purpose: req.body.purpose,
        password: req.body.password,
        deviceFingerprint: req.body.deviceFingerprint,
        ipAddress,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/staff/otp-verify
   */
  public async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = (req.headers["user-agent"] as string) || "Unknown";

      const result = await staffAuthService.verifyStaffOtp({
        mobileNumber: req.body.mobileNumber,
        otp: req.body.otp,
        purpose: req.body.purpose,
        deviceFingerprint: req.body.deviceFingerprint,
        deviceName: req.body.deviceName,
        platform: req.body.platform,
        rememberDevice: req.body.rememberDevice ?? req.body.trustDevice ?? false,
        ipAddress,
        userAgent,
      });

      // Optionally set cookie
      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: "Staff authentication verified successfully",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/staff/sessions
   */
  public async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessions = await staffAuthService.listActiveSessions(userId);

      res.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/auth/staff/sessions/:id
   */
  public async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const sessionId = req.params.id;
      const result = await staffAuthService.revokeSession(userId, sessionId);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/staff/sessions/revoke-all
   */
  public async revokeAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await staffAuthService.revokeAllSessions(userId);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/staff/force-logout/:userId
   */
  public async forceLogoutStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.userId;
      const targetUserId = req.params.userId;
      const reason = req.body?.reason;

      const result = await staffAuthService.forceLogoutStaff(adminUserId, targetUserId, reason);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/staff/devices
   */
  public async listTrustedDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const devices = await staffAuthService.listTrustedDevices(userId);

      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/auth/staff/devices/:id
   */
  public async revokeTrustedDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const deviceId = req.params.id;
      const result = await staffAuthService.revokeTrustedDevice(userId, deviceId);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const staffAuthController = new StaffAuthController();

