import { z } from "zod";
import { UserRole, WorkType } from "../constants/enums";
export declare const EmployeeRecordSchema: z.ZodObject<{
    _id: z.ZodString;
    employeeId: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodNativeEnum<typeof UserRole>;
    department: z.ZodString;
    designation: z.ZodString;
    workType: z.ZodDefault<z.ZodNativeEnum<typeof WorkType>>;
    shiftId: z.ZodOptional<z.ZodString>;
    shiftName: z.ZodOptional<z.ZodString>;
    joiningDate: z.ZodString;
    isVerified: z.ZodBoolean;
    isRegistered: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    email: string;
    _id: string;
    name: string;
    role: UserRole;
    department: string;
    designation: string;
    isVerified: boolean;
    createdAt: string;
    workType: WorkType;
    joiningDate: string;
    isRegistered: boolean;
    updatedAt?: string | undefined;
    shiftId?: string | undefined;
    shiftName?: string | undefined;
}, {
    employeeId: string;
    email: string;
    _id: string;
    name: string;
    role: UserRole;
    department: string;
    designation: string;
    isVerified: boolean;
    createdAt: string;
    joiningDate: string;
    isRegistered: boolean;
    updatedAt?: string | undefined;
    workType?: WorkType | undefined;
    shiftId?: string | undefined;
    shiftName?: string | undefined;
}>;
export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;
export declare const EmployeeCreateSchema: z.ZodObject<{
    employeeId: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof UserRole>>>;
    department: z.ZodString;
    designation: z.ZodString;
    workType: z.ZodDefault<z.ZodNativeEnum<typeof WorkType>>;
    shiftId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    joiningDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    email: string;
    name: string;
    department: string;
    designation: string;
    workType: WorkType;
    joiningDate: string;
    role?: UserRole | undefined;
    shiftId?: string | null | undefined;
}, {
    employeeId: string;
    email: string;
    name: string;
    department: string;
    designation: string;
    joiningDate: string;
    role?: UserRole | undefined;
    workType?: WorkType | undefined;
    shiftId?: string | null | undefined;
}>;
export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;
export declare const EmployeeUpdateSchema: z.ZodObject<{
    employeeId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof UserRole>>>>;
    department: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    workType: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof WorkType>>>;
    shiftId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    joiningDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    role?: UserRole | undefined;
    department?: string | undefined;
    designation?: string | undefined;
    workType?: WorkType | undefined;
    shiftId?: string | null | undefined;
    joiningDate?: string | undefined;
}, {
    employeeId?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
    role?: UserRole | undefined;
    department?: string | undefined;
    designation?: string | undefined;
    workType?: WorkType | undefined;
    shiftId?: string | null | undefined;
    joiningDate?: string | undefined;
}>;
export type EmployeeUpdate = z.infer<typeof EmployeeUpdateSchema>;
export declare const EmployeeStatusUpdateSchema: z.ZodObject<{
    isActive: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    reason?: string | undefined;
}, {
    isActive: boolean;
    reason?: string | undefined;
}>;
export type EmployeeStatusUpdate = z.infer<typeof EmployeeStatusUpdateSchema>;
export declare const EmployeeFilterQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    designation: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    isActive: z.ZodEffects<z.ZodOptional<z.ZodBoolean>, boolean | undefined, unknown>;
    shiftId: z.ZodOptional<z.ZodString>;
    workType: z.ZodOptional<z.ZodNativeEnum<typeof WorkType>>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "employeeId", "department", "designation", "joiningDate", "createdAt", "updatedAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortBy: "employeeId" | "name" | "department" | "designation" | "createdAt" | "updatedAt" | "joiningDate";
    sortOrder: "asc" | "desc";
    status?: string | undefined;
    department?: string | undefined;
    designation?: string | undefined;
    workType?: WorkType | undefined;
    search?: string | undefined;
    isActive?: boolean | undefined;
    shiftId?: string | undefined;
}, {
    status?: string | undefined;
    department?: string | undefined;
    designation?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    workType?: WorkType | undefined;
    search?: string | undefined;
    sortBy?: "employeeId" | "name" | "department" | "designation" | "createdAt" | "updatedAt" | "joiningDate" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isActive?: unknown;
    shiftId?: string | undefined;
}>;
export type EmployeeFilterQuery = z.infer<typeof EmployeeFilterQuerySchema>;
//# sourceMappingURL=employee.d.ts.map