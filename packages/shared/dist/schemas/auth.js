"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUserSchema = exports.RefreshTokenRequestSchema = exports.LoginRequestSchema = exports.VerifyOtpRequestSchema = exports.RegisterRequestSchema = exports.RegisterCompleteRequestSchema = exports.RegisterVerifyRequestSchema = exports.RegisterStartRequestSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("../constants/enums");
exports.RegisterStartRequestSchema = zod_1.z.object({
    employeeId: zod_1.z
        .string()
        .min(3, "Employee ID must be at least 3 characters")
        .max(20, "Employee ID cannot exceed 20 characters")
        .trim(),
});
exports.RegisterVerifyRequestSchema = zod_1.z.object({
    employeeId: zod_1.z
        .string()
        .min(3, "Employee ID must be at least 3 characters")
        .max(20, "Employee ID cannot exceed 20 characters")
        .trim(),
    otp: zod_1.z
        .string()
        .trim()
        .length(6, "Verification code must be exactly 6 digits")
        .regex(/^\d{6}$/, "Verification code must contain only numeric digits"),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters")
        .max(100, "Password cannot exceed 100 characters")
        .optional(),
});
exports.RegisterCompleteRequestSchema = zod_1.z.object({
    employeeId: zod_1.z
        .string()
        .min(3, "Employee ID must be at least 3 characters")
        .max(20, "Employee ID cannot exceed 20 characters")
        .trim(),
    verificationToken: zod_1.z.string().min(1, "Verification token is required"),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters")
        .max(100, "Password cannot exceed 100 characters"),
});
exports.RegisterRequestSchema = zod_1.z.object({
    employeeId: zod_1.z
        .string()
        .min(3, "Employee ID must be at least 3 characters")
        .max(20, "Employee ID cannot exceed 20 characters")
        .trim(),
    password: zod_1.z
        .string()
        .min(6, "Password must be at least 6 characters")
        .max(100, "Password cannot exceed 100 characters"),
});
exports.VerifyOtpRequestSchema = zod_1.z.object({
    employeeId: zod_1.z.string().trim().min(1, "Employee ID is required"),
    otp: zod_1.z.string().trim().length(6, "OTP must be exactly 6 characters"),
});
exports.LoginRequestSchema = zod_1.z
    .object({
    employeeId: zod_1.z.string().trim().optional(),
    email: zod_1.z.string().trim().email().optional(),
    identifier: zod_1.z.string().trim().optional(),
    password: zod_1.z.string().min(1, "Password is required"),
})
    .refine((data) => Boolean(data.employeeId || data.email || data.identifier), {
    message: "An employeeId, email, or identifier is required for login",
    path: ["employeeId"],
});
exports.RefreshTokenRequestSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().optional(),
});
exports.AuthUserSchema = zod_1.z.object({
    _id: zod_1.z.string(),
    employeeId: zod_1.z.string(),
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    role: zod_1.z.nativeEnum(enums_1.UserRole),
    department: zod_1.z.string().optional(),
    designation: zod_1.z.string().optional(),
    isVerified: zod_1.z.boolean(),
});
