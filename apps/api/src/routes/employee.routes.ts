import { Router } from "express";
import { employeeController } from "../controllers/employee.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
  EmployeeStatusUpdateSchema,
  EmployeeFilterQuerySchema,
  UserRole,
} from "@vorldx/shared";

const router = Router();

/**
 * @route   GET /api/employees/me
 * @desc    Allow authenticated employees to view their own profile
 * @access  Protected (All authenticated employees)
 */
router.get("/api/employees/me", authenticate, employeeController.getMe);

/**
 * @route   GET /api/employees
 * @desc    List employees with multi-column filtering, search, sorting and pagination
 * @access  Protected (HR & Admin only)
 */
router.get(
  "/api/employees",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ query: EmployeeFilterQuerySchema }),
  employeeController.list
);

/**
 * @route   GET /api/employees/:id
 * @desc    Get detailed employee profile by Mongo ID or Employee ID
 * @access  Protected (HR & Admin only)
 */
router.get(
  "/api/employees/:id",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  employeeController.getById
);

/**
 * @route   POST /api/employees
 * @desc    Onboard a new employee with duplicate prevention and audit logging
 * @access  Protected (HR & Admin only)
 */
router.post(
  "/api/employees",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: EmployeeCreateSchema }),
  employeeController.create
);

/**
 * @route   PATCH /api/employees/:id
 * @desc    Update employee profile details with audit logging
 * @access  Protected (HR & Admin only)
 */
router.patch(
  "/api/employees/:id",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: EmployeeUpdateSchema }),
  employeeController.update
);

/**
 * @route   PATCH /api/employees/:id/status
 * @desc    Activate or deactivate employee status and sync login/QR access
 * @access  Protected (HR & Admin only)
 */
router.patch(
  "/api/employees/:id/status",
  authenticate,
  requireRole(UserRole.HR, UserRole.ADMIN),
  validate({ body: EmployeeStatusUpdateSchema }),
  employeeController.updateStatus
);

export default router;
