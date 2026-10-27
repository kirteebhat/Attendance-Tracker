import { ISmsProvider, SmsMessageOptions, SmsSendResult } from "./ISmsProvider";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

/**
 * Simulated SMS Provider
 * Used in local development, automated testing, and evaluation sandboxes.
 * Strictly guarantees that plaintext OTPs are never exposed in production.
 */
export class SimulatedSmsProvider implements ISmsProvider {
  public readonly name = "simulated";

  public async sendOtp(options: SmsMessageOptions): Promise<SmsSendResult> {
    const isProduction = env.NODE_ENV === "production";
    const isDemoMode = env.DEMO_OTP_MODE && !isProduction;

    // Mask phone number for safe diagnostic output (e.g. +9198****3210)
    const maskedNumber =
      options.to.length > 6
        ? `${options.to.slice(0, 5)}****${options.to.slice(-4)}`
        : "****";

    if (isProduction) {
      // In production mode, never log the plaintext OTP under any circumstances
      logger.info(`[SMS][Simulated] Security OTP dispatched to ${maskedNumber} for ${options.purpose}`);
      return {
        success: true,
        provider: this.name,
        messageId: `sim_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    // In non-production testing and demo mode
    logger.info(`[SMS][Demo] Dispatched OTP to ${maskedNumber} (expires in ${options.expiresInMinutes}m)`);

    return {
      success: true,
      provider: this.name,
      messageId: `demo_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...(isDemoMode && {
        simulatedOtp: options.otp,
        demoNotice: "SIMULATED OTP FOR DEMO ENVIRONMENT ONLY — NEVER RETURNED IN PRODUCTION",
      }),
    };
  }
}

