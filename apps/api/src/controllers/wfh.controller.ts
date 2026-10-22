import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as wfhService from "../services/wfh.service";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, WfhFilterQuery } from "@vorldx/shared";

/**
 * Employee: Check WFH eligibility, quotas and policy rules
 */
export const checkEligibility = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const result = await wfhService.checkWfhEligibility(req.user.userId);
  res.status(200).json(result);
});

/**
 * Employee: Submit a new Work From Home request
 */
export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const simulatedNow = req.body.simulatedNow ? new Date(req.body.simulatedNow) : undefined;
  const request = await wfhService.createWfhRequest(
    req.user.userId,
    {
      dateKey: req.body.dateKey,
      reason: req.body.reason,
    },
    simulatedNow
  );

  res.status(201).json({
    success: true,
    message: "Work From Home request submitted successfully.",
    request,
  });
});

/**
 * Employee: List own submitted WFH requests
 */
export const listMyRequests = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const result = await wfhService.listMyWfhRequests(req.user.userId, {
    status: req.query.status as string | undefined,
    month: req.query.month as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  });

  res.status(200).json(result);
});

/**
 * Employee: Cancel a pending WFH request
 */
export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const request = await wfhService.cancelWfhRequest(req.user.userId, req.params.id);

  res.status(200).json({
    success: true,
    message: "WFH request cancelled successfully.",
    request,
  });
});

/**
 * HR / Admin: List all WFH requests with filtering and pagination
 */
export const listAllRequests = asyncHandler(async (req: Request, res: Response) => {
  const query: WfhFilterQuery = {
    status: req.query.status as WfhFilterQuery["status"],
    department: req.query.department as string | undefined,
    month: req.query.month as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  };

  const result = await wfhService.listAllWfhRequests(query);
  res.status(200).json(result);
});

/**
 * HR / Admin: Review (Approve or Reject) a WFH request
 */
export const reviewRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required.");
  }

  const actor = {
    userId: req.user.userId,
    employeeId: req.user.employeeId,
    role: req.user.role,
  };

  const result = await wfhService.reviewWfhRequest(
    req.params.id,
    {
      status: req.body.status,
      remarks: req.body.remarks,
    },
    actor
  );

  res.status(200).json(result);
});
