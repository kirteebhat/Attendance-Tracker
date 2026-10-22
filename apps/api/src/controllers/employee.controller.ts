import { Request, Response } from "express";
import { employeeService, ActorContext } from "../services/employee.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, EmployeeFilterQuerySchema } from "@vorldx/shared";

/**
 * Controller for managing employee directory, self-service profile, and status workflows
 */
export class EmployeeController {
  private getActorContext(req: Request): ActorContext {
    if (!req.user) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    return {
      userId: req.user.userId,
      employeeId: req.user.employeeId,
      role: req.user.role,
    };
  }

  public list = asyncHandler(async (req: Request, res: Response) => {
    const validatedQuery = EmployeeFilterQuerySchema.parse(req.query);
    const result = await employeeService.listEmployees(validatedQuery);
    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  });

  public getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const employee = await employeeService.getEmployeeById(id);
    res.status(200).json({
      success: true,
      data: employee,
    });
  });

  public getMe = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const employee = await employeeService.getEmployeeById(actor.employeeId);
    res.status(200).json({
      success: true,
      data: employee,
    });
  });

  public create = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const employee = await employeeService.createEmployee(req.body, actor);
    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  });

  public update = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const { id } = req.params;
    const employee = await employeeService.updateEmployee(id, req.body, actor);
    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  });

  public updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const { id } = req.params;
    const { isActive, reason } = req.body;
    const employee = await employeeService.updateStatus(id, isActive, reason, actor);
    res.status(200).json({
      success: true,
      message: `Employee ${isActive ? "activated" : "deactivated"} successfully`,
      data: employee,
    });
  });
}

export const employeeController = new EmployeeController();
