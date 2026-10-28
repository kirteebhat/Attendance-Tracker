import { Request, Response } from "express";
import { enquiryService } from "../services/enquiry.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import {
  CreateEnquiryInput,
  SendEnquiryMessageInput,
  UpdateEnquiryStatusInput,
  AssignEnquiryInput,
  ReopenEnquiryInput,
} from "@vorldx/shared";

export class EnquiryController {
  private getAuthenticatedUser(req: Request): { userId: string; role: string } {
    const user = (req as any).user;
    if (!user || !user.userId) {
      throw AppError.unauthorized("Authentication required");
    }
    return {
      userId: user.userId,
      role: user.role || "EMPLOYEE",
    };
  }

  /**
   * POST /api/enquiries
   */
  public create = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);
    const input: CreateEnquiryInput = req.body;

    const result = await enquiryService.createEnquiry(userId, role, input);

    res.status(201).json({
      success: true,
      message: `Enquiry ${result.enquiry.ticketNumber} created successfully.`,
      data: result.enquiry,
      initialMessage: result.initialMessage,
    });
  });

  /**
   * GET /api/enquiries
   */
  public list = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);

    const query = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      priority: req.query.priority as string | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await enquiryService.listEnquiries(userId, role, query);

    res.status(200).json({
      success: true,
      ...result,
      data: result.enquiries,
    });
  });

  /**
   * GET /api/enquiries/:id
   */
  public getById = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);
    const { id } = req.params;

    const result = await enquiryService.getEnquiryById(id, userId, role);

    res.status(200).json({
      success: true,
      data: result.enquiry,
      messages: result.messages,
    });
  });

  /**
   * POST /api/enquiries/:id/messages
   */
  public addMessage = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);
    const { id } = req.params;
    const input: SendEnquiryMessageInput = req.body;

    const message = await enquiryService.addMessage(id, userId, role, input);

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: message,
    });
  });

  /**
   * PATCH /api/enquiries/:id/status
   */
  public updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);
    const { id } = req.params;
    const input: UpdateEnquiryStatusInput = req.body;

    const updated = await enquiryService.updateStatus(
      id,
      userId,
      role,
      input.status,
      input.note
    );

    res.status(200).json({
      success: true,
      message: `Enquiry status updated to ${updated.status}.`,
      data: updated,
    });
  });

  /**
   * POST /api/enquiries/:id/reopen
   */
  public reopen = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);
    const { id } = req.params;
    const input: ReopenEnquiryInput = req.body;

    const updated = await enquiryService.reopenEnquiry(id, userId, role, input.reason);

    res.status(200).json({
      success: true,
      message: `Enquiry ${updated.ticketNumber} reopened successfully.`,
      data: updated,
    });
  });

  /**
   * PATCH /api/enquiries/:id/assign
   */
  public assign = asyncHandler(async (req: Request, res: Response) => {
    const { userId, role } = this.getAuthenticatedUser(req);
    const { id } = req.params;
    const input: AssignEnquiryInput = req.body;

    const updated = await enquiryService.assignEnquiry(
      id,
      userId,
      role,
      input.assigneeId
    );

    res.status(200).json({
      success: true,
      message: `Enquiry ${updated.ticketNumber} assigned successfully.`,
      data: updated,
    });
  });
}

export const enquiryController = new EnquiryController();
