/**
 * SMS Provider Adapter Interface
 * Provides unified abstraction for dispatching security OTP codes
 * across simulated development harnesses and production carriers.
 */

export interface SmsMessageOptions {
  to: string; // E.164 normalized mobile number
  otp: string; // Plaintext 6-digit OTP code
  purpose: "LOGIN" | "DEVICE_REGISTRATION" | "PASSWORD_RESET";
  expiresInMinutes: number;
}

export interface SmsSendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  simulatedOtp?: string; // Strictly provided only in non-production demo environments
  demoNotice?: string;
  error?: string;
}

export interface ISmsProvider {
  readonly name: string;
  sendOtp(options: SmsMessageOptions): Promise<SmsSendResult>;
}

