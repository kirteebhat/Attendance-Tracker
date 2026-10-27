import { z } from "zod";
import { UserRole } from "../constants/enums";
export declare const RegisterStartRequestSchema: z.ZodObject<{
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
}, {
    employeeId: string;
}>;
export type RegisterStartRequest = z.infer<typeof RegisterStartRequestSchema>;
export declare const RegisterVerifyRequestSchema: z.ZodObject<{
    employeeId: z.ZodString;
    otp: z.ZodString;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    otp: string;
    password?: string | undefined;
}, {
    employeeId: string;
    otp: string;
    password?: string | undefined;
}>;
export type RegisterVerifyRequest = z.infer<typeof RegisterVerifyRequestSchema>;
export declare const RegisterCompleteRequestSchema: z.ZodObject<{
    employeeId: z.ZodString;
    verificationToken: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    password: string;
    verificationToken: string;
}, {
    employeeId: string;
    password: string;
    verificationToken: string;
}>;
export type RegisterCompleteRequest = z.infer<typeof RegisterCompleteRequestSchema>;
export declare const RegisterRequestSchema: z.ZodObject<{
    employeeId: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    password: string;
}, {
    employeeId: string;
    password: string;
}>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export declare const VerifyOtpRequestSchema: z.ZodObject<{
    employeeId: z.ZodString;
    otp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    otp: string;
}, {
    employeeId: string;
    otp: string;
}>;
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;
export declare const LoginRequestSchema: z.ZodEffects<z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    identifier: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    employeeId?: string | undefined;
    email?: string | undefined;
    identifier?: string | undefined;
}, {
    password: string;
    employeeId?: string | undefined;
    email?: string | undefined;
    identifier?: string | undefined;
}>, {
    password: string;
    employeeId?: string | undefined;
    email?: string | undefined;
    identifier?: string | undefined;
}, {
    password: string;
    employeeId?: string | undefined;
    email?: string | undefined;
    identifier?: string | undefined;
}>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export declare const RefreshTokenRequestSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string | undefined;
}, {
    refreshToken?: string | undefined;
}>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export declare const AuthUserSchema: z.ZodObject<{
    _id: z.ZodString;
    employeeId: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodNativeEnum<typeof UserRole>;
    department: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    isVerified: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
    role: UserRole;
    isVerified: boolean;
    department?: string | undefined;
    designation?: string | undefined;
}, {
    _id: string;
    name: string;
    employeeId: string;
    email: string;
    role: UserRole;
    isVerified: boolean;
    department?: string | undefined;
    designation?: string | undefined;
}>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
//# sourceMappingURL=auth.d.ts.map