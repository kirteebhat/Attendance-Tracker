import { z } from "zod";
import { UserRole } from "../constants/enums";

export const RegisterStartRequestSchema = z.object({
  employeeId: z
    .string()
    .min(3, "Employee ID must be at least 3 characters")
    .max(20, "Employee ID cannot exceed 20 characters")
    .trim(),
});

export type RegisterStartRequest = z.infer<typeof RegisterStartRequestSchema>;

export const RegisterVerifyRequestSchema = z.object({
  employeeId: z
    .string()
    .min(3, "Employee ID must be at least 3 characters")
    .max(20, "Employee ID cannot exceed 20 characters")
    .trim(),
  otp: z
    .string()
    .trim()
    .length(6, "Verification code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Verification code must contain only numeric digits"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password cannot exceed 100 characters")
    .optional(),
});

export type RegisterVerifyRequest = z.infer<typeof RegisterVerifyRequestSchema>;

export const RegisterCompleteRequestSchema = z.object({
  employeeId: z
    .string()
    .min(3, "Employee ID must be at least 3 characters")
    .max(20, "Employee ID cannot exceed 20 characters")
    .trim(),
  verificationToken: z.string().min(1, "Verification token is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password cannot exceed 100 characters"),
});

export type RegisterCompleteRequest = z.infer<typeof RegisterCompleteRequestSchema>;

export const RegisterRequestSchema = z.object({
  employeeId: z
    .string()
    .min(3, "Employee ID must be at least 3 characters")
    .max(20, "Employee ID cannot exceed 20 characters")
    .trim(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password cannot exceed 100 characters"),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  otp: z.string().trim().length(6, "OTP must be exactly 6 characters"),
});

export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const LoginRequestSchema = z
  .object({
    employeeId: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    identifier: z.string().trim().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean(data.employeeId || data.email || data.identifier), {
    message: "An employeeId, email, or identifier is required for login",
    path: ["employeeId"],
  });

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().optional(),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const AuthUserSchema = z.object({
  _id: z.string(),
  employeeId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  department: z.string().optional(),
  designation: z.string().optional(),
  isVerified: z.boolean(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
