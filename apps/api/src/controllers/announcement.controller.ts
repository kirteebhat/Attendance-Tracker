import { Request, Response } from "express";
import { announcementService } from "../services/announcement.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";
import {
  CreateAnnouncementInputSchema,
  UpdateAnnouncementInputSchema,
  UpdateAnnouncementTemplateInputSchema,
} from "@vorldx/shared";

export class AnnouncementController {
  /**
   * GET /api/announcements
   * Employee endpoint: retrieves active announcements targeted to the authenticated user.
   */
  public getAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required");
    }

    const { page, limit, priority, source, search, unreadOnly } = req.query;

    const result = await announcementService.getAnnouncementsForUser(
      {
        userId: req.user.userId,
        role: req.user.role,
        employeeId: req.user.employeeId,
      },
      {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        priority: priority as any,
        source: source as any,
        search: search as string,
        unreadOnly: unreadOnly === "true",
      }
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        unreadCount: result.unreadCount,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
    });
  });

  /**
   * GET /api/announcements/unread-count
   * Retrieves count of unread announcements for the authenticated user.
   */
  public getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required");
    }

    const count = await announcementService.getUnreadCount({
      userId: req.user.userId,
      role: req.user.role,
      employeeId: req.user.employeeId,
    });

    res.status(200).json({
      success: true,
      count,
    });
  });

  /**
   * POST /api/announcements/:id/read
   * Marks an announcement as read for the authenticated user.
   */
  public markAsRead = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(401, ApiErrorCode.ERR_UNAUTHORIZED, "Authentication required");
    }

    const { id } = req.params;
    const result = await announcementService.markAsRead(id, req.user.userId);

    res.status(200).json({
      success: true,
      message: "Announcement marked as read",
      data: result,
    });
  });

  /**
   * GET /api/announcements/admin
   * HR / Admin endpoint: retrieves all announcements with read metrics and filters.
   */
  public getAdminAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, priority, source, search } = req.query;

    const result = await announcementService.getAdminAnnouncements({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      priority: priority as any,
      source: source as any,
      search: search as string,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
    });
  });

  /**
   * POST /api/announcements
   * HR / Admin endpoint: creates a new manual announcement.
   */
  public createAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const parseResult = CreateAnnouncementInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_INVALID_INPUT,
        parseResult.error.errors[0]?.message || "Invalid announcement input",
        parseResult.error.format()
      );
    }

    const announcement = await announcementService.createManualAnnouncement(parseResult.data, {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
      role: req.user?.role,
    });

    res.status(201).json({
      success: true,
      message: "Announcement published successfully",
      data: announcement,
    });
  });

  /**
   * PUT /api/announcements/:id
   * HR / Admin endpoint: updates an announcement.
   */
  public updateAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const parseResult = UpdateAnnouncementInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_INVALID_INPUT,
        parseResult.error.errors[0]?.message || "Invalid update input",
        parseResult.error.format()
      );
    }

    const updated = await announcementService.updateAnnouncement(id, parseResult.data, {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
      role: req.user?.role,
    });

    res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data: updated,
    });
  });

  /**
   * DELETE /api/announcements/:id
   * HR / Admin endpoint: deletes an announcement.
   */
  public deleteAnnouncement = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await announcementService.deleteAnnouncement(id, {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
      role: req.user?.role,
    });

    res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  });

  /**
   * GET /api/announcements/templates
   * HR / Admin endpoint: lists all announcement templates with their switch status.
   */
  public listTemplates = asyncHandler(async (_req: Request, res: Response) => {
    const templates = await announcementService.listTemplates();
    res.status(200).json({
      success: true,
      data: templates,
    });
  });

  /**
   * GET /api/announcements/templates/:key
   * HR / Admin endpoint: gets a single announcement template by key.
   */
  public getTemplateByKey = asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const template = await announcementService.getTemplateByKey(key);
    res.status(200).json({
      success: true,
      data: template,
    });
  });

  /**
   * PUT /api/announcements/templates/:key
   * HR / Admin endpoint: edits a template (text, priority, audience, or isEnabled toggle).
   */
  public updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const parseResult = UpdateAnnouncementTemplateInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_INVALID_INPUT,
        parseResult.error.errors[0]?.message || "Invalid template update input",
        parseResult.error.format()
      );
    }

    const updated = await announcementService.updateTemplate(key, parseResult.data, {
      userId: req.user?.userId,
      employeeId: req.user?.employeeId,
      role: req.user?.role,
    });

    res.status(200).json({
      success: true,
      message: `Template '${key}' updated successfully`,
      data: updated,
    });
  });

  /**
   * POST /api/announcements/trigger-auto
   * HR / Admin endpoint: runs auto-announcements job immediately.
   */
  public triggerAutoAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const { targetDate } = req.body;
    const result = await announcementService.runScheduledJob(targetDate);

    res.status(200).json({
      success: true,
      message: `Auto-announcements evaluation completed: ${result.generated} item(s) generated`,
      data: result,
    });
  });
}

export const announcementController = new AnnouncementController();
