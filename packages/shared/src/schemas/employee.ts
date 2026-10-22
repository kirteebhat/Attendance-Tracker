import { z } from "zod";
import { UserRole, WorkType } from "../constants/enums";

export const EmployeeRecordSchema = z.object({
  _id: z.string(),
  employeeId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  department: z.string(),
  designation: z.string(),
  workType: z.nativeEnum(WorkType).default(WorkType.FULL_TIME),
  shiftId: z.string().optional(),
  shiftName: z.string().optional(),
  joiningDate: z.string(),
  isVerified: z.boolean(),
  isRegistered: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type EmployeeRecord = z.infer<typeof EmployeeRecordSchema>;

export const EmployeeCreateSchema = z.object({
  employeeId: z.string().min(3).max(20).trim(),
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().trim(),
  role: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE).optional(),
  department: z.string().min(2).max(100).trim(),
  designation: z.string().min(2).max(100).trim(),
  workType: z.nativeEnum(WorkType).default(WorkType.FULL_TIME),
  shiftId: z.string().nullable().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Joining date must be YYYY-MM-DD"),
});

export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();
export type EmployeeUpdate = z.infer<typeof EmployeeUpdateSchema>;

export const EmployeeStatusUpdateSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").optional(),
});

export type EmployeeStatusUpdate = z.infer<typeof EmployeeStatusUpdateSchema>;

export const EmployeeFilterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  status: z.string().trim().optional(),
  isActive: z.preprocess((val) => {
    if (val === undefined || val === "") return undefined;
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional()),
  shiftId: z.string().trim().optional(),
  workType: z.nativeEnum(WorkType).optional(),
  sortBy: z
    .enum([
      "name",
      "employeeId",
      "department",
      "designation",
      "joiningDate",
      "createdAt",
      "updatedAt",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type EmployeeFilterQuery = z.infer<typeof EmployeeFilterQuerySchema>;
