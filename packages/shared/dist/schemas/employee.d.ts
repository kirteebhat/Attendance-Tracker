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
    _id: string;
    name: string;
    createdAt: string;
    employeeId: string;
    department: string;
    email: string;
    role: UserRole;
    designation: string;
    isVerified: boolean;
    workType: WorkType;
    joiningDate: string;
    isRegistered: boolean;
    updatedAt?: string | undefined;
    shiftId?: string | undefined;
    shiftName?: string | undefined;
}, {
    _id: string;
    name: string;
    createdAt: string;
    employeeId: string;
    department: string;
    email: string;
    role: UserRole;
    designation: string;
    isVerified: boolean;
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
    name: string;
    employeeId: string;
    department: string;
    email: string;
    designation: string;
    workType: WorkType;
    joiningDate: string;
    role?: UserRole | undefined;
    shiftId?: string | null | undefined;
}, {
    name: string;
    employeeId: string;
    department: string;
    email: string;
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
    name?: string | undefined;
    employeeId?: string | undefined;
    department?: string | undefined;
    email?: string | undefined;
    role?: UserRole | undefined;
    designation?: string | undefined;
    workType?: WorkType | undefined;
    shiftId?: string | null | undefined;
    joiningDate?: string | undefined;
}, {
    name?: string | undefined;
    employeeId?: string | undefined;
    department?: string | undefined;
    email?: string | undefined;
    role?: UserRole | undefined;
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
    sortBy: "name" | "createdAt" | "updatedAt" | "employeeId" | "department" | "designation" | "joiningDate";
    sortOrder: "asc" | "desc";
    status?: string | undefined;
    isActive?: boolean | undefined;
    department?: string | undefined;
    search?: string | undefined;
    designation?: string | undefined;
    workType?: WorkType | undefined;
    shiftId?: string | undefined;
}, {
    status?: string | undefined;
    isActive?: unknown;
    department?: string | undefined;
    search?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    designation?: string | undefined;
    workType?: WorkType | undefined;
    sortBy?: "name" | "createdAt" | "updatedAt" | "employeeId" | "department" | "designation" | "joiningDate" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    shiftId?: string | undefined;
}>;
export type EmployeeFilterQuery = z.infer<typeof EmployeeFilterQuerySchema>;
//# sourceMappingURL=employee.d.ts.map