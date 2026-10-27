import { Request, Response } from "express";
import { leaveService } from "../services/leave.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";

export class LeaveController {
  // ============================================================================
  // LEAVE TYPES (HR / ADMIN)
  // ============================================================================

  public createType = asyncHandler(async (req: Request, res: Response) => {
    const actor = {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
    };
    const leaveType = await leaveService.createLeaveType(req.body, actor);
    res.status(201).json({
      success: true,
      message: `Leave type '${leaveType.name}' created successfully.`,
      data: leaveType,
    });
  });

  public listTypes = asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === "true";
    const types = await leaveService.listLeaveTypes(includeInactive);
    res.status(200).json({
      success: true,
      count: types.length,
      data: types,
    });
  });

  public getTypeById = asyncHandler(async (req: Request, res: Response) => {
    const leaveType = await leaveService.getLeaveTypeById(req.params.id);
    res.status(200).json({
      success: true,
      data: leaveType,
    });
  });

  public updateType = asyncHandler(async (req: Request, res: Response) => {
    const actor = {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
    };
    const updated = await leaveService.updateLeaveType(req.params.id, req.body, actor);
    res.status(200).json({
      success: true,
      message: `Leave type '${updated.name}' updated successfully.`,
      data: updated,
    });
  });

  public deleteType = asyncHandler(async (req: Request, res: Response) => {
    const actor = {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
    };
    const deactivated = await leaveService.deleteLeaveType(req.params.id, actor);
    res.status(200).json({
      success: true,
      message: `Leave type '${deactivated.name}' deactivated successfully.`,
      data: deactivated,
    });
  });

  // ============================================================================
  // LEAVE BALANCES
  // ============================================================================

  public getMyBalances = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const balances = await leaveService.getEmployeeBalances(req.user.userId, year);
    res.status(200).json({
      success: true,
      data: balances,
    });
  });

  public getEmployeeBalances = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const balances = await leaveService.getEmployeeBalances(req.params.employeeId, year);
    res.status(200).json({
      success: true,
      data: balances,
    });
  });

  public listAllBalances = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const department = req.query.department as string;
    const employeeId = req.query.employeeId as string;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const result = await leaveService.listAllBalances({
      year,
      department,
      employeeId,
      page,
      limit,
    });

    res.status(200).json(result);
  });

  public adjustBalance = asyncHandler(async (req: Request, res: Response) => {
    const actor = {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
    };
    const adjusted = await leaveService.adjustBalance(req.body, actor);
    res.status(200).json({
      success: true,
      message: "Leave balance adjusted successfully.",
      data: adjusted,
    });
  });

  public carryForward = asyncHandler(async (req: Request, res: Response) => {
    const actor = {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
    };
    const result = await leaveService.carryForwardBalances(req.body, actor);
    res.status(200).json({
      success: true,
      message: `Carry-forward processed for ${result.processedCount} records.`,
      data: result,
    });
  });

  // ============================================================================
  // LEAVE APPLICATIONS (EMPLOYEE)
  // ============================================================================

  public applyLeave = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    const leaveRequest = await leaveService.applyLeave(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully and pending approval.",
      data: leaveRequest,
    });
  });

  public getMyRequests = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    const status = req.query.status as string;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const result = await leaveService.listMyLeaveRequests(req.user.userId, {
      status,
      page,
      limit,
    });

    res.status(200).json(result);
  });

  public cancelLeave = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    const reason = req.body?.reason || (req.query?.reason as string);
    const cancelled = await leaveService.cancelLeave(req.params.id, req.user.userId, reason);
    res.status(200).json({
      success: true,
      message: "Leave request cancelled successfully.",
      data: cancelled,
    });
  });

  // ============================================================================
  // HR / ADMIN DECISION QUEUE
  // ============================================================================

  public listRequests = asyncHandler(async (req: Request, res: Response) => {
    const result = await leaveService.listLeaveRequests(req.query as any);
    res.status(200).json(result);
  });

  public decideRequest = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    const actor = {
      userId: req.user.userId,
      employeeId: req.user.employeeId,
      role: req.user.role,
    };
    const decided = await leaveService.decideLeaveRequest(req.params.id, req.body, actor);
    res.status(200).json({
      success: true,
      message: `Leave request ${decided.status.toLowerCase()} successfully.`,
      data: decided,
    });
  });

  public bulkDecide = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.userId) {
      throw AppError.unauthorized("Authentication required", ApiErrorCode.ERR_UNAUTHORIZED);
    }
    const actor = {
      userId: req.user.userId,
      employeeId: req.user.employeeId,
      role: req.user.role,
    };
    const { requestIds, status, decisionNote } = req.body;
    const result = await leaveService.bulkDecideLeaveRequests(
      requestIds,
      { status, decisionNote },
      actor
    );
    res.status(200).json({
      success: true,
      message: `Processed ${result.total} requests: ${result.successful.length} succeeded, ${result.failed.length} failed.`,
      data: result,
    });
  });
}

export const leaveController = new LeaveController();
