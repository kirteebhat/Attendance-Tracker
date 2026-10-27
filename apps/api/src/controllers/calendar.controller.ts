import { Request, Response } from "express";
import { calendarService } from "../services/calendar.service";
import { CalendarEventType } from "../models/CalendarEvent";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { ApiErrorCode } from "@vorldx/shared";

export class CalendarController {
  private getActorContext(req: Request) {
    return {
      userId: req.user?.userId || null,
      employeeId: req.user?.employeeId || null,
      role: req.user?.role || null,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1",
    };
  }

  /**
   * GET /api/calendar/events
   */
  public listEvents = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const type = req.query.type as CalendarEventType | undefined;
    const source = req.query.source as "manual" | "imported" | undefined;
    const search = req.query.search as string | undefined;

    const events = await calendarService.listEvents({
      year,
      startDate,
      endDate,
      type,
      source,
      search,
    });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  });

  /**
   * GET /api/calendar/events/:id
   */
  public getEventById = asyncHandler(async (req: Request, res: Response) => {
    const event = await calendarService.getEventById(req.params.id);
    res.status(200).json({
      success: true,
      data: event,
    });
  });

  /**
   * POST /api/calendar/events
   */
  public createEvent = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const event = await calendarService.createEvent(req.body, actor);

    res.status(201).json({
      success: true,
      message: "Calendar event created successfully",
      data: event,
    });
  });

  /**
   * PUT /api/calendar/events/:id
   */
  public updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    const event = await calendarService.updateEvent(req.params.id, req.body, actor);

    res.status(200).json({
      success: true,
      message: "Calendar event updated successfully",
      data: event,
    });
  });

  /**
   * DELETE /api/calendar/events/:id
   */
  public deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const actor = this.getActorContext(req);
    await calendarService.deleteEvent(req.params.id, actor);

    res.status(200).json({
      success: true,
      message: "Calendar event deleted successfully",
    });
  });

  /**
   * GET /api/calendar/day-type?date=YYYY-MM-DD&timezone=Asia/Kolkata
   */
  public getDayType = asyncHandler(async (req: Request, res: Response) => {
    const dateStr = (req.query.date as string) || new Date().toISOString();
    const timezone = req.query.timezone as string | undefined;

    const dayType = await calendarService.getDayType(dateStr, timezone);
    const dateKey = calendarService.toDateKey(dateStr, timezone);

    res.status(200).json({
      success: true,
      dateKey,
      dayType,
      isWorkday: dayType === "workday",
      timezone: timezone || "Asia/Kolkata",
    });
  });

  /**
   * GET /api/calendar/working-days?start=YYYY-MM-DD&end=YYYY-MM-DD&timezone=Asia/Kolkata
   */
  public countWorkingDays = asyncHandler(async (req: Request, res: Response) => {
    const start = req.query.start as string || req.query.startDate as string;
    const end = req.query.end as string || req.query.endDate as string;
    const timezone = req.query.timezone as string | undefined;

    if (!start || !end) {
      throw new AppError(400, ApiErrorCode.ERR_INVALID_INPUT, "Both 'start' and 'end' query parameters are required");
    }

    const count = await calendarService.countWorkingDays(start, end, timezone);
    const days = await calendarService.getWorkingDaysInRange(start, end, timezone);

    res.status(200).json({
      success: true,
      startDate: calendarService.toDateKey(start, timezone),
      endDate: calendarService.toDateKey(end, timezone),
      workingDaysCount: count,
      workingDays: days,
    });
  });

  /**
   * GET /api/calendar/next-working-day?date=YYYY-MM-DD&timezone=Asia/Kolkata
   */
  public getNextWorkingDay = asyncHandler(async (req: Request, res: Response) => {
    const dateStr = (req.query.date as string) || new Date().toISOString();
    const timezone = req.query.timezone as string | undefined;

    const nextDate = await calendarService.nextWorkingDay(dateStr, timezone);
    const nextDateKey = calendarService.toDateKey(nextDate, timezone);

    res.status(200).json({
      success: true,
      fromDate: calendarService.toDateKey(dateStr, timezone),
      nextWorkingDay: nextDateKey,
    });
  });

  /**
   * POST /api/calendar/holidays/preview
   */
  public previewHolidays = asyncHandler(async (req: Request, res: Response) => {
    const year = Number(req.body.year) || new Date().getFullYear();
    const countryCode = req.body.countryCode || "IN";
    const provider = req.body.provider;

    const preview = await calendarService.previewImportHolidays(year, countryCode, provider);

    res.status(200).json({
      success: true,
      data: preview,
    });
  });

  /**
   * POST /api/calendar/holidays/import
   */
  public importHolidays = asyncHandler(async (req: Request, res: Response) => {
    const year = Number(req.body.year) || new Date().getFullYear();
    const countryCode = req.body.countryCode || "IN";
    const provider = req.body.provider;
    const actor = this.getActorContext(req);

    const result = await calendarService.importHolidays(year, countryCode, actor, provider);

    res.status(200).json({
      success: true,
      message: `Successfully imported ${result.importedCount} holidays from ${result.provider}`,
      data: result,
    });
  });

  /**
   * GET /api/calendar/export.ics
   */
  public exportIcs = asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const types = req.query.types
      ? (String(req.query.types).split(",") as CalendarEventType[])
      : undefined;

    const icsContent = await calendarService.exportIcs(year, types);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="vorldx_calendar_${year || "all"}.ics"`);
    res.status(200).send(icsContent);
  });
}

export const calendarController = new CalendarController();
