import { Types } from "mongoose";
import { CalendarEvent, ICalendarEvent, CalendarEventType, CalendarEventSource } from "../models/CalendarEvent";
import { AuditEvent } from "../models/AuditEvent";
import { Holiday } from "../models/Holiday";
import { eventEmitterService } from "./eventEmitter.service";
import { policyService } from "./policy.service";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, SocketEvent } from "@vorldx/shared";
import { env } from "../config/env";
import { HolidayProviderFactory } from "./calendar/HolidayProviderFactory";

export type { CalendarEventType, CalendarEventSource };

export type DayType = "workday" | "weekly-off" | "public-holiday" | "company-off-day";

export interface ActorContext {
  userId?: string | null;
  employeeId?: string | null;
  role?: string | null;
  ipAddress?: string;
}

export interface CalendarEventInput {
  type: CalendarEventType;
  title: string;
  description?: string;
  startDate: Date | string;
  endDate: Date | string;
  isFullDay?: boolean;
  source?: CalendarEventSource;
  audience?: {
    scope: "all" | "department" | "shift" | "custom";
    departments?: string[];
    roles?: string[];
    shiftIds?: string[];
  };
  location?: string;
  externalId?: string;
}

export interface CalendarQuery {
  startDate?: string | Date;
  endDate?: string | Date;
  year?: number;
  type?: CalendarEventType;
  source?: CalendarEventSource;
  search?: string;
}

export interface HolidayImportPreview {
  provider: string;
  year: number;
  countryCode: string;
  totalFound: number;
  toImportCount: number;
  manualConflictCount: number;
  alreadyImportedCount: number;
  items: Array<{
    date: string;
    name: string;
    description?: string;
    action: "create" | "skip_manual_conflict" | "skip_already_imported";
    existingEvent?: {
      id: string;
      title: string;
      type: string;
      source: string;
    };
  }>;
}

export interface HolidayImportResult {
  provider: string;
  year: number;
  countryCode: string;
  importedCount: number;
  skippedManualCount: number;
  alreadyExistedCount: number;
  events: ICalendarEvent[];
}

export class CalendarService {
  private cache = new Map<string, { dayType: DayType; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Clears the in-memory calendar evaluation cache.
   * Triggered automatically after any calendar write.
   */
  public invalidateCache(): void {
    this.cache.clear();
  }

  // =========================================================================
  // Timezone and Date Utility Methods
  // =========================================================================

  public toDateKey(date: Date | string, timezone?: string): string {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const tz = timezone || env.DEFAULT_TIMEZONE || "Asia/Kolkata";
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  public getDayOfWeek(dateKey: string): number {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  public addDays(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + days));
    const year = next.getUTCFullYear();
    const month = String(next.getUTCMonth() + 1).padStart(2, "0");
    const day = String(next.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // =========================================================================
  // Core Calendar Engine Functions
  // =========================================================================

  /**
   * Computes the day type: 'workday' | 'weekly-off' | 'public-holiday' | 'company-off-day'
   * Cached for high-throughput evaluation.
   */
  public async getDayType(
    date: Date | string,
    timezone?: string,
    shiftWorkdays?: number[]
  ): Promise<DayType> {
    const tz = timezone || env.DEFAULT_TIMEZONE || "Asia/Kolkata";
    const dateKey = this.toDateKey(date, tz);

    const cacheKey = `${dateKey}:${tz}:${shiftWorkdays ? shiftWorkdays.sort().join(",") : "def"}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.dayType;
    }

    const dayType = await this.calculateDayType(dateKey, tz, shiftWorkdays);
    this.cache.set(cacheKey, { dayType, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return dayType;
  }

  private async calculateDayType(
    dateKey: string,
    _timezone: string,
    shiftWorkdays?: number[]
  ): Promise<DayType> {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

    // 1. Check for official public holidays or company off-days in CalendarEvent collection
    const activeEvents = await CalendarEvent.find({
      type: { $in: ["holiday", "companyOffDay"] },
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    }).lean();

    if (activeEvents.length > 0) {
      const isPublicHoliday = activeEvents.some((e) => e.type === "holiday");
      if (isPublicHoliday) return "public-holiday";

      const isCompanyOffDay = activeEvents.some((e) => e.type === "companyOffDay");
      if (isCompanyOffDay) return "company-off-day";
    }

    // 1b. Check legacy Holiday collection for backward compatibility
    const legacyHoliday = await Holiday.findOne({ dateKey }).lean();
    if (legacyHoliday) {
      return "public-holiday";
    }

    // 2. Check weekly-off according to shift workdays or global policy
    let workdays = shiftWorkdays;
    if (!workdays) {
      try {
        const policy = await policyService.getActivePolicy();
        workdays = policy.workdays || [1, 2, 3, 4, 5];
      } catch {
        workdays = [1, 2, 3, 4, 5];
      }
    }

    const dayOfWeek = this.getDayOfWeek(dateKey);
    if (!workdays.includes(dayOfWeek)) {
      return "weekly-off";
    }

    return "workday";
  }

  /**
   * Returns true if the given date is a workday.
   */
  public async isWorkingDay(
    date: Date | string,
    timezone?: string,
    shiftWorkdays?: number[]
  ): Promise<boolean> {
    const dayType = await this.getDayType(date, timezone, shiftWorkdays);
    return dayType === "workday";
  }

  /**
   * Counts the number of working days between start and end (both inclusive).
   * Automatically excludes weekly-offs, public holidays, and company off-days.
   */
  public async countWorkingDays(
    start: Date | string,
    end: Date | string,
    timezone?: string,
    shiftWorkdays?: number[]
  ): Promise<number> {
    const tz = timezone || env.DEFAULT_TIMEZONE || "Asia/Kolkata";
    const startKey = this.toDateKey(start, tz);
    const endKey = this.toDateKey(end, tz);

    if (startKey > endKey) {
      return 0;
    }

    let workingDays = 0;
    let curr = startKey;

    while (curr <= endKey) {
      const type = await this.getDayType(curr, tz, shiftWorkdays);
      if (type === "workday") {
        workingDays++;
      }
      curr = this.addDays(curr, 1);
    }

    return workingDays;
  }

  /**
   * Returns the next working day strictly after the specified date.
   */
  public async nextWorkingDay(
    date: Date | string,
    timezone?: string,
    shiftWorkdays?: number[]
  ): Promise<Date> {
    const tz = timezone || env.DEFAULT_TIMEZONE || "Asia/Kolkata";
    const initialKey = this.toDateKey(date, tz);
    let curr = this.addDays(initialKey, 1);

    // Limit lookahead to 60 days to prevent infinite loops in pathological configs
    for (let i = 0; i < 60; i++) {
      const type = await this.getDayType(curr, tz, shiftWorkdays);
      if (type === "workday") {
        const [y, m, d] = curr.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d));
      }
      curr = this.addDays(curr, 1);
    }

    throw new AppError(500, ApiErrorCode.ERR_INTERNAL_SERVER, "No working day found in the next 60 days");
  }

  /**
   * Returns a list of dateKeys (YYYY-MM-DD) for all working days in range.
   */
  public async getWorkingDaysInRange(
    start: Date | string,
    end: Date | string,
    timezone?: string,
    shiftWorkdays?: number[]
  ): Promise<string[]> {
    const tz = timezone || env.DEFAULT_TIMEZONE || "Asia/Kolkata";
    const startKey = this.toDateKey(start, tz);
    const endKey = this.toDateKey(end, tz);

    if (startKey > endKey) return [];

    const result: string[] = [];
    let curr = startKey;

    while (curr <= endKey) {
      const type = await this.getDayType(curr, tz, shiftWorkdays);
      if (type === "workday") {
        result.push(curr);
      }
      curr = this.addDays(curr, 1);
    }

    return result;
  }

  // =========================================================================
  // CalendarEvent CRUD with Audit Logging & Sockets
  // =========================================================================

  public async listEvents(query: CalendarQuery = {}): Promise<ICalendarEvent[]> {
    const filter: Record<string, unknown> = {};

    if (query.year) {
      const yearStart = new Date(Date.UTC(query.year, 0, 1));
      const yearEnd = new Date(Date.UTC(query.year, 11, 31, 23, 59, 59, 999));
      filter.startDate = { $lte: yearEnd };
      filter.endDate = { $gte: yearStart };
    } else if (query.startDate && query.endDate) {
      const s = new Date(query.startDate);
      const e = new Date(query.endDate);
      filter.startDate = { $lte: e };
      filter.endDate = { $gte: s };
    } else if (query.startDate) {
      filter.endDate = { $gte: new Date(query.startDate) };
    } else if (query.endDate) {
      filter.startDate = { $lte: new Date(query.endDate) };
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.source) {
      filter.source = query.source;
    }

    if (query.search && query.search.trim()) {
      filter.$or = [
        { title: new RegExp(query.search.trim(), "i") },
        { description: new RegExp(query.search.trim(), "i") },
      ];
    }

    return CalendarEvent.find(filter).sort({ startDate: 1 });
  }

  public async getEventById(id: string): Promise<ICalendarEvent> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.notFound(`Calendar event '${id}' not found`, ApiErrorCode.ERR_NOT_FOUND);
    }
    const event = await CalendarEvent.findById(id);
    if (!event) {
      throw AppError.notFound(`Calendar event '${id}' not found`, ApiErrorCode.ERR_NOT_FOUND);
    }
    return event;
  }

  public async createEvent(
    input: CalendarEventInput,
    actor?: ActorContext
  ): Promise<ICalendarEvent> {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (startDate > endDate) {
      throw new AppError(400, ApiErrorCode.ERR_INVALID_INPUT, "End date cannot be earlier than start date");
    }

    const event = await CalendarEvent.create({
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim(),
      startDate,
      endDate,
      isFullDay: input.isFullDay !== false,
      source: input.source || "manual",
      audience: input.audience || { scope: "all", departments: [], roles: [], shiftIds: [] },
      location: input.location?.trim(),
      externalId: input.externalId,
      createdBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
    });

    // Audit logging
    await AuditEvent.create({
      entityType: "CALENDAR",
      entityId: event._id.toString(),
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      action: "CREATE_CALENDAR_EVENT",
      newValue: event.toObject(),
      reason: `Created ${event.type} '${event.title}'`,
      timestamp: new Date(),
      metadata: { actorRole: actor?.role, source: event.source },
    });

    this.invalidateCache();

    // Socket notification
    eventEmitterService.emit(SocketEvent.CALENDAR_UPDATED, {
      action: "create",
      event: event.toObject(),
      timestamp: new Date().toISOString(),
    });

    return event;
  }

  public async updateEvent(
    id: string,
    input: Partial<CalendarEventInput>,
    actor?: ActorContext
  ): Promise<ICalendarEvent> {
    const event = await this.getEventById(id);
    const beforeState = event.toObject();

    if (input.title !== undefined) event.title = input.title.trim();
    if (input.description !== undefined) event.description = input.description?.trim();
    if (input.type !== undefined) event.type = input.type;
    if (input.isFullDay !== undefined) event.isFullDay = input.isFullDay;
    if (input.location !== undefined) event.location = input.location?.trim();
    if (input.audience !== undefined) {
      event.audience = {
        scope: input.audience.scope || "all",
        departments: input.audience.departments || [],
        roles: input.audience.roles || [],
        shiftIds: input.audience.shiftIds || [],
      };
    }
    if (input.startDate !== undefined) event.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) event.endDate = new Date(input.endDate);

    if (event.startDate > event.endDate) {
      throw new AppError(400, ApiErrorCode.ERR_INVALID_INPUT, "End date cannot be earlier than start date");
    }

    await event.save();

    // Audit logging
    await AuditEvent.create({
      entityType: "CALENDAR",
      entityId: event._id.toString(),
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      action: "UPDATE_CALENDAR_EVENT",
      previousValue: beforeState,
      newValue: event.toObject(),
      reason: `Updated calendar event '${event.title}'`,
      timestamp: new Date(),
      metadata: { actorRole: actor?.role },
    });

    this.invalidateCache();

    eventEmitterService.emit(SocketEvent.CALENDAR_UPDATED, {
      action: "update",
      event: event.toObject(),
      timestamp: new Date().toISOString(),
    });

    return event;
  }

  public async deleteEvent(id: string, actor?: ActorContext): Promise<void> {
    const event = await this.getEventById(id);
    const beforeState = event.toObject();

    await CalendarEvent.deleteOne({ _id: event._id });

    // Audit logging
    await AuditEvent.create({
      entityType: "CALENDAR",
      entityId: event._id.toString(),
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      action: "DELETE_CALENDAR_EVENT",
      previousValue: beforeState,
      newValue: null,
      reason: `Deleted calendar event '${event.title}'`,
      timestamp: new Date(),
      metadata: { actorRole: actor?.role },
    });

    this.invalidateCache();

    eventEmitterService.emit(SocketEvent.CALENDAR_UPDATED, {
      action: "delete",
      eventId: id,
      deletedTitle: event.title,
      timestamp: new Date().toISOString(),
    });
  }

  // =========================================================================
  // Holiday Import via Provider Adapter (Preview & Merge Safe)
  // =========================================================================

  /**
   * Previews holidays from external/stub provider before importing.
   * Identifies conflicts with existing manual entries to guarantee zero overwrites.
   */
  public async previewImportHolidays(
    year: number,
    countryCode = "IN",
    providerOverride?: string
  ): Promise<HolidayImportPreview> {
    const provider = HolidayProviderFactory.getProvider(providerOverride);
    const externalHolidays = await provider.fetchHolidays(year, countryCode);

    // Load existing events in DB for that year
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const existingEvents = await CalendarEvent.find({
      startDate: { $lte: yearEnd },
      endDate: { $gte: yearStart },
    });

    let toImportCount = 0;
    let manualConflictCount = 0;
    let alreadyImportedCount = 0;

    const items = externalHolidays.map((ext) => {
      const extDateKey = ext.date;

      // Check if any existing event covers this date
      const match = existingEvents.find((evt) => {
        const startKey = this.toDateKey(evt.startDate);
        const endKey = this.toDateKey(evt.endDate);
        return extDateKey >= startKey && extDateKey <= endKey;
      });

      if (!match) {
        toImportCount++;
        return {
          date: ext.date,
          name: ext.name,
          description: ext.description,
          action: "create" as const,
        };
      }

      if (match.source === "manual") {
        manualConflictCount++;
        return {
          date: ext.date,
          name: ext.name,
          description: ext.description,
          action: "skip_manual_conflict" as const,
          existingEvent: {
            id: match._id.toString(),
            title: match.title,
            type: match.type,
            source: match.source,
          },
        };
      }

      alreadyImportedCount++;
      return {
        date: ext.date,
        name: ext.name,
        description: ext.description,
        action: "skip_already_imported" as const,
        existingEvent: {
          id: match._id.toString(),
          title: match.title,
          type: match.type,
          source: match.source,
        },
      };
    });

    return {
      provider: provider.providerName,
      year,
      countryCode,
      totalFound: externalHolidays.length,
      toImportCount,
      manualConflictCount,
      alreadyImportedCount,
      items,
    };
  }

  /**
   * Executes holiday import with strict guarantees:
   * 1. Never overwrites manual entries.
   * 2. Marks imported events with source='imported'.
   * 3. Emits calendar.updated socket event.
   */
  public async importHolidays(
    year: number,
    countryCode = "IN",
    actor?: ActorContext,
    providerOverride?: string
  ): Promise<HolidayImportResult> {
    const preview = await this.previewImportHolidays(year, countryCode, providerOverride);
    const createdEvents: ICalendarEvent[] = [];

    for (const item of preview.items) {
      if (item.action !== "create") {
        continue;
      }

      const [y, m, d] = item.date.split("-").map(Number);
      const startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

      const event = await CalendarEvent.create({
        type: "holiday",
        title: item.name,
        description: item.description || `Official public holiday (${countryCode})`,
        startDate,
        endDate,
        isFullDay: true,
        source: "imported",
        audience: { scope: "all", departments: [], roles: [], shiftIds: [] },
        externalId: `holiday-${countryCode}-${item.date}`,
        createdBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      });

      createdEvents.push(event);
    }

    if (createdEvents.length > 0) {
      await AuditEvent.create({
        entityType: "CALENDAR",
        entityId: `import-${year}-${countryCode}`,
        performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
        performedByEmployeeId: actor?.employeeId,
        action: "IMPORT_HOLIDAYS",
        newValue: { count: createdEvents.length, year, countryCode },
        reason: `Imported ${createdEvents.length} public holidays from ${preview.provider}`,
        timestamp: new Date(),
        metadata: { actorRole: actor?.role, provider: preview.provider },
      });

      this.invalidateCache();

      eventEmitterService.emit(SocketEvent.CALENDAR_UPDATED, {
        action: "import",
        importedCount: createdEvents.length,
        year,
        countryCode,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      provider: preview.provider,
      year,
      countryCode,
      importedCount: createdEvents.length,
      skippedManualCount: preview.manualConflictCount,
      alreadyExistedCount: preview.alreadyImportedCount,
      events: createdEvents,
    };
  }

  // =========================================================================
  // ICS Calendar Export (RFC 5545 Compliant)
  // =========================================================================

  /**
   * Generates standard RFC 5545 iCalendar content.
   */
  public async exportIcs(year?: number, types?: CalendarEventType[]): Promise<string> {
    const filter: Record<string, unknown> = {};

    if (year) {
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      filter.startDate = { $lte: yearEnd };
      filter.endDate = { $gte: yearStart };
    }

    if (types && types.length > 0) {
      filter.type = { $in: types };
    }

    const events = await CalendarEvent.find(filter).sort({ startDate: 1 });
    const nowStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const formatIcsDate = (date: Date, isFullDay: boolean): string => {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");

      if (isFullDay) {
        return `VALUE=DATE:${y}${m}${d}`;
      }

      const hh = String(date.getUTCHours()).padStart(2, "0");
      const mm = String(date.getUTCMinutes()).padStart(2, "0");
      const ss = String(date.getUTCSeconds()).padStart(2, "0");
      return `${y}${m}${d}T${hh}${mm}${ss}Z`;
    };

    const escapeIcs = (str?: string): string => {
      if (!str) return "";
      return str
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
    };

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//VorldX//Attendance & Calendar Engine 2.0//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:VorldX Corporate Calendar",
      "X-WR-TIMEZONE:Asia/Kolkata",
    ];

    for (const evt of events) {
      const dtStart = formatIcsDate(evt.startDate, evt.isFullDay);
      // For all-day events in RFC 5545, DTEND is exclusive (day after last day)
      let endForIcs = evt.endDate;
      if (evt.isFullDay) {
        endForIcs = new Date(evt.endDate.getTime() + 24 * 60 * 60 * 1000);
      }
      const dtEnd = formatIcsDate(endForIcs, evt.isFullDay);

      lines.push(
        "BEGIN:VEVENT",
        `UID:${evt._id}@vorldx.com`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;${dtStart}`,
        `DTEND;${dtEnd}`,
        `SUMMARY:${escapeIcs(evt.title)}`,
        `DESCRIPTION:${escapeIcs(evt.description || "")}`,
        `CATEGORIES:${evt.type.toUpperCase()}`,
        `STATUS:CONFIRMED`,
        `TRANSP:${evt.type === "holiday" || evt.type === "companyOffDay" ? "TRANSPARENT" : "OPAQUE"}`,
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
}

export const calendarService = new CalendarService();
