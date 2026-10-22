import { Request, Response } from "express";
import { policyService } from "../services/policy.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";
import { ActorContext } from "../services/employee.service";

/**
 * Controller for attendance policies, shifts, punctuality thresholds, and holiday calendar
 */
export class PolicyController {
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

  public getPolicy = asyncHandler(async (_req: Request, res: Response) => {
    const policy = await policyService.getActivePolicy();
    res.status(200).json({
      success: true,
      data: policy,
    });
  });

  public updatePolicy = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const policy = await policyService.updatePolicy(req.body, actor);
    res.status(200).json({
      success: true,
      message: "Attendance policy updated successfully",
      data: policy,
    });
  });

  public listHolidays = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const holidays = await policyService.listHolidays(year);
    res.status(200).json({
      success: true,
      data: holidays,
    });
  });

  public getHolidayById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const holiday = await policyService.getHolidayById(id);
    res.status(200).json({
      success: true,
      data: holiday,
    });
  });

  public createHoliday = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const holiday = await policyService.createHoliday(req.body, actor);
    res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: holiday,
    });
  });

  public updateHoliday = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const { id } = req.params;
    const holiday = await policyService.updateHoliday(id, req.body, actor);
    res.status(200).json({
      success: true,
      message: "Holiday updated successfully",
      data: holiday,
    });
  });

  public deleteHoliday = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const { id } = req.params;
    await policyService.deleteHoliday(id, actor);
    res.status(200).json({
      success: true,
      message: "Holiday deleted successfully",
    });
  });
}

export const policyController = new PolicyController();
