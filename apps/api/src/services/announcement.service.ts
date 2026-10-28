import { Types } from "mongoose";
import {
  Announcement,
  IAnnouncement,
  AnnouncementTemplate,
  IAnnouncementTemplate,
  IAnnouncementAudience,
  AnnouncementPriority,
  User,
  Employee,
  Notification,
  AuditEvent,
  ICalendarEvent,
} from "../models";
import { calendarService } from "./calendar.service";
import { eventEmitterService } from "./eventEmitter.service";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, SocketEvent } from "@vorldx/shared";
import { logger } from "../utils/logger";

export interface ActorContext {
  userId?: string | null;
  employeeId?: string | null;
  role?: string | null;
}

export interface CreateManualAnnouncementInput {
  title: string;
  body: string;
  audience?: IAnnouncementAudience;
  priority?: AnnouncementPriority;
  pinned?: boolean;
  startsAt?: Date | string;
  expiresAt?: Date | string | null;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  audience?: IAnnouncementAudience;
  priority?: AnnouncementPriority;
  pinned?: boolean;
  startsAt?: Date | string;
  expiresAt?: Date | string | null;
}

export interface UpdateTemplateInput {
  titleTemplate?: string;
  bodyTemplate?: string;
  priority?: AnnouncementPriority;
  audience?: IAnnouncementAudience;
  isEnabled?: boolean;
}

export interface AnnouncementListQuery {
  page?: number;
  limit?: number;
  priority?: AnnouncementPriority;
  source?: "manual" | "auto";
  search?: string;
  unreadOnly?: boolean;
}

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

export const DEFAULT_ANNOUNCEMENT_TEMPLATES = [
  {
    key: "HOLIDAY_TOMORROW",
    name: "Tomorrow Holiday Alert",
    titleTemplate: "Tomorrow is a holiday: {title}",
    bodyTemplate:
      "Tomorrow ({date}) is an official public holiday for {title}. The office will remain closed. Wishing everyone a restful break!",
    priority: "HIGH" as AnnouncementPriority,
    audience: { scope: "all" as const, departments: [], roles: [] },
    isEnabled: true,
    variables: ["title", "date"],
    description: "Broadcasted on the eve of an upcoming gazetted public or national holiday",
  },
  {
    key: "MEETING_TODAY",
    name: "Today Meeting Reminder",
    titleTemplate: "Today: {meeting} at {time}",
    bodyTemplate:
      "Scheduled team meeting '{meeting}' is taking place today at {time}. Location: {location}.",
    priority: "MEDIUM" as AnnouncementPriority,
    audience: { scope: "all" as const, departments: [], roles: [] },
    isEnabled: true,
    variables: ["meeting", "time", "location"],
    description: "Broadcasted on the day of an organized company or departmental meeting",
  },
  {
    key: "OFFICE_CLOSED",
    name: "Office Closure Notification",
    titleTemplate: "Office closed on {date}",
    bodyTemplate:
      "Please be advised that the office will be closed on {date} for {title}. Planned on-premise access will be suspended.",
    priority: "HIGH" as AnnouncementPriority,
    audience: { scope: "all" as const, departments: [], roles: [] },
    isEnabled: true,
    variables: ["date", "title"],
    description: "Broadcasted for scheduled company off-days or facility closures",
  },
  {
    key: "POLICY_UPDATED",
    name: "Attendance Policy Updated Notice",
    titleTemplate: "Policy updated: {policyName}",
    bodyTemplate:
      "The attendance and workforce policy '{policyName}' has been updated to version {version}. Please review the updated policy in the portal.",
    priority: "HIGH" as AnnouncementPriority,
    audience: { scope: "all" as const, departments: [], roles: [] },
    isEnabled: true,
    variables: ["policyName", "version"],
    description: "Triggered whenever an HR administrator updates the attendance policy",
  },
  {
    key: "LEAVE_WFH_REMINDER",
    name: "Leave & WFH Advance Planning Reminder",
    titleTemplate: "Leave/WFH reminder: {reminderType}",
    bodyTemplate:
      "Friendly reminder: {message}. Please ensure all pending applications are submitted through the portal in advance.",
    priority: "MEDIUM" as AnnouncementPriority,
    audience: { scope: "all" as const, departments: [], roles: [] },
    isEnabled: true,
    variables: ["reminderType", "message"],
    description: "Periodic reminders regarding leave quotas, weekend planning, or cutoff dates",
  },
  {
    key: "UPDATE_AVAILABLE",
    name: "System Update Available Announcement",
    titleTemplate: "Update available: {version}",
    bodyTemplate:
      "A new system update ({version}) is now available with new improvements and stability enhancements. Details: {notes}.",
    priority: "LOW" as AnnouncementPriority,
    audience: { scope: "all" as const, departments: [], roles: [] },
    isEnabled: true,
    variables: ["version", "notes"],
    description: "Triggered when a new app or platform build is released",
  },
];

export class AnnouncementService {
  /**
   * Initializes default announcement templates if not already present in the database.
   */
  public async ensureDefaultTemplates(): Promise<void> {
    for (const tpl of DEFAULT_ANNOUNCEMENT_TEMPLATES) {
      await AnnouncementTemplate.findOneAndUpdate(
        { key: tpl.key },
        {
          $setOnInsert: {
            name: tpl.name,
            titleTemplate: tpl.titleTemplate,
            bodyTemplate: tpl.bodyTemplate,
            priority: tpl.priority,
            audience: tpl.audience,
            isEnabled: tpl.isEnabled,
            variables: tpl.variables,
            description: tpl.description,
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  // =========================================================================
  // Template Management (HR / Admin)
  // =========================================================================

  public async listTemplates(): Promise<IAnnouncementTemplate[]> {
    await this.ensureDefaultTemplates();
    return AnnouncementTemplate.find().sort({ key: 1 });
  }

  public async getTemplateByKey(key: string): Promise<IAnnouncementTemplate> {
    await this.ensureDefaultTemplates();
    const template = await AnnouncementTemplate.findOne({ key: key.toUpperCase() });
    if (!template) {
      throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, `Announcement template '${key}' not found`);
    }
    return template;
  }

  public async updateTemplate(
    key: string,
    input: UpdateTemplateInput,
    actor?: ActorContext
  ): Promise<IAnnouncementTemplate> {
    await this.ensureDefaultTemplates();
    const template = await AnnouncementTemplate.findOne({ key: key.toUpperCase() });
    if (!template) {
      throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, `Announcement template '${key}' not found`);
    }

    if (input.titleTemplate !== undefined) template.titleTemplate = input.titleTemplate.trim();
    if (input.bodyTemplate !== undefined) template.bodyTemplate = input.bodyTemplate.trim();
    if (input.priority !== undefined) template.priority = input.priority;
    if (input.audience !== undefined) template.audience = input.audience;
    if (input.isEnabled !== undefined) template.isEnabled = input.isEnabled;

    await template.save();

    await AuditEvent.create({
      entityType: "ANNOUNCEMENT",
      entityId: template._id.toString(),
      action: "UPDATE",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      reason: `Updated announcement template '${template.key}' (Enabled: ${template.isEnabled})`,
      timestamp: new Date(),
    });

    return template;
  }

  // =========================================================================
  // Manual Announcements (HR / Admin)
  // =========================================================================

  public async createManualAnnouncement(
    input: CreateManualAnnouncementInput,
    actor?: ActorContext
  ): Promise<IAnnouncement> {
    if (!input.title || input.title.trim().length < 2) {
      throw new AppError(400, ApiErrorCode.ERR_INVALID_INPUT, "Title must be at least 2 characters");
    }
    if (!input.body || input.body.trim().length < 5) {
      throw new AppError(400, ApiErrorCode.ERR_INVALID_INPUT, "Body must be at least 5 characters");
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    if (expiresAt && expiresAt <= startsAt) {
      throw new AppError(400, ApiErrorCode.ERR_INVALID_INPUT, "Expiry date must be after start date");
    }

    const audience = input.audience || { scope: "all", departments: [], roles: [] };

    const announcement = await Announcement.create({
      title: input.title.trim(),
      body: input.body.trim(),
      audience,
      priority: input.priority || "MEDIUM",
      pinned: Boolean(input.pinned),
      startsAt,
      expiresAt,
      source: "manual",
      createdBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      readBy: [],
    });

    // Realtime broadcast event
    eventEmitterService.emit(SocketEvent.ANNOUNCEMENT_PUBLISHED, {
      id: announcement._id.toString(),
      title: announcement.title,
      priority: announcement.priority,
      pinned: announcement.pinned,
      audience: announcement.audience,
      source: announcement.source,
      startsAt: announcement.startsAt,
    });

    // High / Urgent Priority -> Create user notifications
    if (announcement.priority === "HIGH" || announcement.priority === "URGENT") {
      await this.createNotificationsForAnnouncement(announcement);
    }

    await AuditEvent.create({
      entityType: "ANNOUNCEMENT",
      entityId: announcement._id.toString(),
      action: "CREATE",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      reason: `Published manual announcement '${announcement.title}' (${announcement.priority})`,
      timestamp: new Date(),
    });

    return announcement;
  }

  public async updateAnnouncement(
    id: string,
    input: UpdateAnnouncementInput,
    actor?: ActorContext
  ): Promise<IAnnouncement> {
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, "Announcement not found");
    }

    if (input.title !== undefined) announcement.title = input.title.trim();
    if (input.body !== undefined) announcement.body = input.body.trim();
    if (input.audience !== undefined) announcement.audience = input.audience;
    if (input.priority !== undefined) announcement.priority = input.priority;
    if (input.pinned !== undefined) {
      announcement.pinned = input.pinned;
      eventEmitterService.emit(SocketEvent.ANNOUNCEMENT_PINNED, {
        id: announcement._id.toString(),
        pinned: announcement.pinned,
      });
    }
    if (input.startsAt !== undefined) announcement.startsAt = new Date(input.startsAt);
    if (input.expiresAt !== undefined) {
      announcement.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }

    await announcement.save();

    await AuditEvent.create({
      entityType: "ANNOUNCEMENT",
      entityId: announcement._id.toString(),
      action: "UPDATE",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      reason: `Updated announcement '${announcement.title}'`,
      timestamp: new Date(),
    });

    return announcement;
  }

  public async deleteAnnouncement(id: string, actor?: ActorContext): Promise<void> {
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, "Announcement not found");
    }

    await Announcement.findByIdAndDelete(id);

    await AuditEvent.create({
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action: "DELETE",
      performedBy: actor?.userId ? new Types.ObjectId(actor.userId) : null,
      performedByEmployeeId: actor?.employeeId,
      reason: `Deleted announcement '${announcement.title}'`,
      timestamp: new Date(),
    });
  }

  // =========================================================================
  // Employee Viewing & Read Tracking
  // =========================================================================

  public async getAnnouncementsForUser(
    user: { userId: string; role: string; employeeId?: string },
    query: AnnouncementListQuery = {}
  ): Promise<{ data: Array<any>; total: number; unreadCount: number }> {
    const now = new Date();

    // Resolve employee department if available
    let department = "";
    if (user.employeeId) {
      const emp = await Employee.findOne({ employeeId: user.employeeId });
      if (emp && emp.department) {
        department = emp.department;
      }
    }

    // Audience filter: matches all OR user's department OR user's role
    const audienceConditions: any[] = [{ "audience.scope": "all" }];
    if (department) {
      audienceConditions.push({
        "audience.scope": "department",
        "audience.departments": department,
      });
    }
    if (user.role) {
      audienceConditions.push({
        "audience.scope": "role",
        "audience.roles": user.role,
      });
    }

    const filter: any = {
      $and: [
        { $or: audienceConditions },
        { startsAt: { $lte: now } },
        {
          $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
        },
      ],
    };

    if (query.priority) {
      filter.$and.push({ priority: query.priority });
    }
    if (query.source) {
      filter.$and.push({ source: query.source });
    }
    if (query.search) {
      const regex = new RegExp(query.search.trim(), "i");
      filter.$and.push({
        $or: [{ title: regex }, { body: regex }],
      });
    }

    const userIdObj = new Types.ObjectId(user.userId);

    if (query.unreadOnly) {
      filter.$and.push({ "readBy.user": { $ne: userIdObj } });
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total, totalUnread] = await Promise.all([
      Announcement.find(filter)
        .sort({ pinned: -1, startsAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Announcement.countDocuments(filter),
      Announcement.countDocuments({
        ...filter,
        "readBy.user": { $ne: userIdObj },
      }),
    ]);

    const formatted = items.map((item) => {
      const readReceipt = item.readBy?.find((r) => r.user.toString() === user.userId);
      return {
        ...item,
        isAuto: item.source === "auto",
        isRead: Boolean(readReceipt),
        readAt: readReceipt?.readAt || null,
        readCount: item.readBy?.length || 0,
      };
    });

    return {
      data: formatted,
      total,
      unreadCount: totalUnread,
    };
  }

  public async markAsRead(announcementId: string, userId: string): Promise<{ success: boolean; readAt: Date }> {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      throw new AppError(404, ApiErrorCode.ERR_NOT_FOUND, "Announcement not found");
    }

    const userIdObj = new Types.ObjectId(userId);
    const existingIndex = announcement.readBy.findIndex((r) => r.user.toString() === userId);

    let readAt = new Date();
    if (existingIndex === -1) {
      announcement.readBy.push({ user: userIdObj, readAt });
      await announcement.save();
    } else {
      readAt = announcement.readBy[existingIndex].readAt;
    }

    return { success: true, readAt };
  }

  public async getUnreadCount(user: { userId: string; role: string; employeeId?: string }): Promise<number> {
    const res = await this.getAnnouncementsForUser(user, { limit: 1 });
    return res.unreadCount;
  }

  public async getAdminAnnouncements(
    query: AnnouncementListQuery = {}
  ): Promise<{ data: Array<any>; total: number }> {
    const filter: any = {};

    if (query.priority) filter.priority = query.priority;
    if (query.source) filter.source = query.source;
    if (query.search) {
      const regex = new RegExp(query.search.trim(), "i");
      filter.$or = [{ title: regex }, { body: regex }];
    }

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Announcement.find(filter)
        .sort({ pinned: -1, startsAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Announcement.countDocuments(filter),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      isAuto: item.source === "auto",
      readCount: item.readBy?.length || 0,
    }));

    return { data: formatted, total };
  }

  // =========================================================================
  // Auto-Generated Announcements Engine (Idempotent per Template & Date)
  // =========================================================================

  /**
   * Generates an announcement using an approved template.
   * Enforces strict idempotency per templateKey and date/entity to prevent duplicate broadcasts.
   */
  public async generateAutoAnnouncement(
    templateKey: string,
    variables: Record<string, string | number>,
    metadata: Record<string, unknown> = {},
    dateKey: string,
    entityId?: string
  ): Promise<IAnnouncement | null> {
    await this.ensureDefaultTemplates();

    const template = await AnnouncementTemplate.findOne({ key: templateKey.toUpperCase() });
    if (!template) {
      logger.warn(`[Announcement Engine] Template '${templateKey}' not found. Skipping auto-broadcast.`);
      return null;
    }

    // HR individual toggle check
    if (!template.isEnabled) {
      logger.info(
        `[Announcement Engine] Template '${templateKey}' is currently disabled by HR. Skipping auto-broadcast.`
      );
      return null;
    }

    // Deterministic Idempotency Key
    const safeEntityId = entityId ? entityId.replace(/[^a-zA-Z0-9_-]/g, "") : "daily";
    const idempotencyKey = `${template.key}:${dateKey}:${safeEntityId}`;

    // Duplicate Check
    const existing = await Announcement.findOne({ idempotencyKey });
    if (existing) {
      logger.debug(
        `[Announcement Engine] Duplicate prevented: announcement for key '${idempotencyKey}' already exists.`
      );
      return existing;
    }

    const title = renderTemplate(template.titleTemplate, variables);
    const body = renderTemplate(template.bodyTemplate, variables);

    let created: IAnnouncement;
    try {
      created = await Announcement.create({
        title,
        body,
        audience: template.audience,
        priority: template.priority,
        pinned: false,
        startsAt: new Date(),
        expiresAt: null,
        source: "auto",
        templateKey: template.key,
        idempotencyKey,
        metadata: { ...metadata, generatedDate: dateKey },
        readBy: [],
      });
    } catch (err: any) {
      // Catch MongoDB unique index race condition
      if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
        logger.debug(`[Announcement Engine] Caught concurrent duplicate for '${idempotencyKey}'`);
        const found = await Announcement.findOne({ idempotencyKey });
        return found;
      }
      throw err;
    }

    logger.info(`[Announcement Engine] Auto-generated broadcast created: '${created.title}' (ID: ${created._id})`);

    // Emit Realtime Event
    eventEmitterService.emit(SocketEvent.ANNOUNCEMENT_PUBLISHED, {
      id: created._id.toString(),
      title: created.title,
      priority: created.priority,
      pinned: created.pinned,
      audience: created.audience,
      source: "auto",
      isAuto: true,
      startsAt: created.startsAt,
    });

    // Create high-priority notifications
    if (created.priority === "HIGH" || created.priority === "URGENT") {
      await this.createNotificationsForAnnouncement(created);
    }

    return created;
  }

  // =========================================================================
  // Scheduled Job & Event Trigger Handlers
  // =========================================================================

  /**
   * Main evaluation runner invoked by the scheduled cron job (or manually for testing).
   */
  public async runScheduledJob(
    targetDate: Date | string = new Date()
  ): Promise<{ evaluated: string[]; generated: number }> {
    const today = new Date(targetDate);
    const todayDateKey = today.toISOString().split("T")[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateKey = tomorrow.toISOString().split("T")[0];

    const tomorrowStart = new Date(`${tomorrowDateKey}T00:00:00.000Z`);
    const tomorrowEnd = new Date(`${tomorrowDateKey}T23:59:59.999Z`);

    const todayStart = new Date(`${todayDateKey}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayDateKey}T23:59:59.999Z`);

    const evaluated: string[] = [];
    let generatedCount = 0;

    // 1. Check for Tomorrow's Public Holiday
    try {
      const tomorrowEvents = await calendarService.listEvents({
        startDate: tomorrowStart,
        endDate: tomorrowEnd,
        type: "holiday",
      });

      for (const hol of tomorrowEvents) {
        const item = await this.generateAutoAnnouncement(
          "HOLIDAY_TOMORROW",
          {
            title: hol.title,
            date: tomorrowDateKey,
          },
          { eventId: hol._id.toString() },
          tomorrowDateKey,
          hol._id.toString()
        );
        if (item) {
          evaluated.push(`HOLIDAY_TOMORROW:${hol.title}`);
          generatedCount++;
        }
      }
    } catch (err) {
      logger.error("[Announcement Engine] Error evaluating tomorrow holidays:", err);
    }

    // 2. Check for Office Closed on Date (e.g. tomorrow is company off-day)
    try {
      const offDayEvents = await calendarService.listEvents({
        startDate: tomorrowStart,
        endDate: tomorrowEnd,
        type: "companyOffDay",
      });

      for (const offDay of offDayEvents) {
        const item = await this.generateAutoAnnouncement(
          "OFFICE_CLOSED",
          {
            title: offDay.title || "Scheduled Company Off-Day",
            date: tomorrowDateKey,
          },
          { eventId: offDay._id.toString() },
          tomorrowDateKey,
          offDay._id.toString()
        );
        if (item) {
          evaluated.push(`OFFICE_CLOSED:${offDay.title}`);
          generatedCount++;
        }
      }
    } catch (err) {
      logger.error("[Announcement Engine] Error evaluating company off days:", err);
    }

    // 3. Check for Today's Scheduled Meetings
    try {
      const todayMeetings = await calendarService.listEvents({
        startDate: todayStart,
        endDate: todayEnd,
        type: "meeting",
      });

      for (const m of todayMeetings) {
        const sDate = new Date(m.startDate);
        const timeStr = sDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        const item = await this.generateAutoAnnouncement(
          "MEETING_TODAY",
          {
            meeting: m.title,
            time: timeStr,
            location: m.location || "Office Conference Room / Online",
          },
          { eventId: m._id.toString() },
          todayDateKey,
          m._id.toString()
        );
        if (item) {
          evaluated.push(`MEETING_TODAY:${m.title}`);
          generatedCount++;
        }
      }
    } catch (err) {
      logger.error("[Announcement Engine] Error evaluating today meetings:", err);
    }

    return { evaluated, generated: generatedCount };
  }

  // =========================================================================
  // Direct Event Hooks
  // =========================================================================

  /**
   * Hook called when a CalendarEvent is created or updated.
   */
  public async onCalendarEventHook(event: ICalendarEvent): Promise<IAnnouncement | null> {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const eventDateStr = new Date(event.startDate).toISOString().split("T")[0];

    if (event.type === "holiday" && eventDateStr === tomorrowStr) {
      return this.generateAutoAnnouncement(
        "HOLIDAY_TOMORROW",
        { title: event.title, date: eventDateStr },
        { eventId: event._id.toString() },
        eventDateStr,
        event._id.toString()
      );
    }

    if (event.type === "companyOffDay" && (eventDateStr === tomorrowStr || eventDateStr === todayStr)) {
      return this.generateAutoAnnouncement(
        "OFFICE_CLOSED",
        { title: event.title, date: eventDateStr },
        { eventId: event._id.toString() },
        eventDateStr,
        event._id.toString()
      );
    }

    if (event.type === "meeting" && eventDateStr === todayStr) {
      const sDate = new Date(event.startDate);
      const timeStr = sDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      return this.generateAutoAnnouncement(
        "MEETING_TODAY",
        {
          meeting: event.title,
          time: timeStr,
          location: event.location || "Office / Hybrid",
        },
        { eventId: event._id.toString() },
        eventDateStr,
        event._id.toString()
      );
    }

    return null;
  }

  /**
   * Hook called when an Attendance Policy is created or updated.
   */
  public async onPolicyUpdatedHook(policy: { name: string; version: number }): Promise<IAnnouncement | null> {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return this.generateAutoAnnouncement(
      "POLICY_UPDATED",
      { policyName: policy.name, version: String(policy.version) },
      { version: policy.version },
      todayStr,
      `v${policy.version}`
    );
  }

  /**
   * Hook called when a Leave or WFH reminder is triggered.
   */
  public async onLeaveWfhReminderHook(reminderType: string, message: string): Promise<IAnnouncement | null> {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return this.generateAutoAnnouncement(
      "LEAVE_WFH_REMINDER",
      { reminderType, message },
      { reminderType },
      todayStr,
      reminderType.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
    );
  }

  /**
   * Hook called when a new platform/application update is published.
   */
  public async onUpdateAvailableHook(version: string, notes: string): Promise<IAnnouncement | null> {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return this.generateAutoAnnouncement(
      "UPDATE_AVAILABLE",
      { version, notes },
      { version },
      todayStr,
      version
    );
  }

  // =========================================================================
  // Internal Notification Delivery
  // =========================================================================

  private async createNotificationsForAnnouncement(announcement: IAnnouncement): Promise<void> {
    try {
      let targetUserQuery: any = { status: "ACTIVE" };

      if (announcement.audience.scope === "role" && announcement.audience.roles.length > 0) {
        targetUserQuery.role = { $in: announcement.audience.roles };
      } else if (
        announcement.audience.scope === "department" &&
        announcement.audience.departments.length > 0
      ) {
        // Resolve employees in matching departments
        const emps = await Employee.find({
          department: { $in: announcement.audience.departments },
          isActive: true,
        }).select("employeeId");
        const empIds = emps.map((e) => e.employeeId);
        targetUserQuery.employeeId = { $in: empIds };
      }

      const users = await User.find(targetUserQuery).select("_id");
      if (users.length === 0) return;

      const notifications = users.map((u) => ({
        user: u._id,
        type: "ANNOUNCEMENT",
        title: `[${announcement.priority}] ${announcement.title}`,
        message: announcement.body.substring(0, 250),
        payload: {
          announcementId: announcement._id.toString(),
          priority: announcement.priority,
          source: announcement.source,
          pinned: announcement.pinned,
        },
      }));

      await Notification.insertMany(notifications, { ordered: false });
    } catch (err) {
      logger.error("[Announcement Engine] Failed to dispatch notifications:", err);
    }
  }
}

export const announcementService = new AnnouncementService();
