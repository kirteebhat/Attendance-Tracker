import { Types } from "mongoose";
import {
  Enquiry,
  IEnquiry,
  IEnquiryAttachment,
  EnquiryCategory,
  EnquiryStatus,
  EnquiryPriority,
} from "../models/Enquiry";
import { EnquiryMessage, IEnquiryMessage } from "../models/EnquiryMessage";
import { Employee, IEmployee } from "../models/Employee";
import { User, IUser } from "../models/User";
import { AuditEvent } from "../models/AuditEvent";
import { Notification } from "../models/Notification";
import { eventEmitterService } from "./eventEmitter.service";
import { AppError } from "../utils/AppError";
import { ApiErrorCode, UserRole } from "@vorldx/shared";
import {
  ALLOWED_ENQUIRY_ATTACHMENT_MIME_TYPES,
  MAX_ENQUIRY_ATTACHMENT_SIZE_BYTES,
  CreateEnquiryInput,
  SendEnquiryMessageInput,
} from "@vorldx/shared";

interface RateLimitEntry {
  timestamps: number[];
}

export class EnquiryService {
  private creationRateLimits = new Map<string, RateLimitEntry>();
  private readonly MAX_CREATIONS_PER_WINDOW = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly REOPEN_WINDOW_DAYS = 7;

  /**
   * Enforces sliding window rate limit for enquiry creation
   */
  public checkRateLimit(userId: string): void {
    const now = Date.now();
    const entry = this.creationRateLimits.get(userId) || { timestamps: [] };
    const validTimestamps = entry.timestamps.filter((ts) => now - ts < this.WINDOW_MS);

    if (validTimestamps.length >= this.MAX_CREATIONS_PER_WINDOW) {
      throw new AppError(
        429,
        ApiErrorCode.ERR_RATE_LIMIT_EXCEEDED,
        "Too many enquiries created. Please wait a few minutes before submitting another enquiry."
      );
    }

    validTimestamps.push(now);
    this.creationRateLimits.set(userId, { timestamps: validTimestamps });
  }

  /**
   * Resets rate limit for a user (useful for test isolation)
   */
  public resetRateLimit(userId?: string): void {
    if (userId) {
      this.creationRateLimits.delete(userId);
    } else {
      this.creationRateLimits.clear();
    }
  }

  /**
   * Validates attachments for size limit and image mime types
   */
  public validateAttachment(att: IEnquiryAttachment): void {
    if (!att.name || !att.mimeType || typeof att.sizeBytes !== "number") {
      throw AppError.badRequest(
        "Invalid attachment data: name, mimeType, and sizeBytes are required.",
        ApiErrorCode.ERR_INVALID_INPUT
      );
    }

    if (
      !(ALLOWED_ENQUIRY_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
        att.mimeType.toLowerCase()
      )
    ) {
      throw AppError.badRequest(
        `Invalid attachment file type: '${att.mimeType}'. Allowed types: ${ALLOWED_ENQUIRY_ATTACHMENT_MIME_TYPES.join(
          ", "
        )}`,
        ApiErrorCode.ERR_INVALID_INPUT
      );
    }

    if (att.sizeBytes > MAX_ENQUIRY_ATTACHMENT_SIZE_BYTES) {
      throw AppError.badRequest(
        `Attachment file size exceeds maximum limit of 5MB (${att.sizeBytes} bytes).`,
        ApiErrorCode.ERR_INVALID_INPUT
      );
    }
  }

  /**
   * Generates unique ticket number (e.g., ENQ-2026-92812)
   */
  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempts = 0; attempts < 10; attempts++) {
      const rand = Math.floor(10000 + Math.random() * 90000);
      const ticketNumber = `ENQ-${year}-${rand}`;
      const existing = await Enquiry.findOne({ ticketNumber });
      if (!existing) {
        return ticketNumber;
      }
    }
    return `ENQ-${year}-${Date.now().toString().slice(-5)}`;
  }

  /**
   * Resolves the Employee document linked to the caller
   */
  private async resolveEmployee(
    userId: string
  ): Promise<{ employee: IEmployee; userDoc: IUser; displayName: string }> {
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      throw AppError.notFound("User not found");
    }

    let employeeDoc = await Employee.findOne({ userId: new Types.ObjectId(userId) });
    if (!employeeDoc && userDoc.employeeId) {
      employeeDoc = await Employee.findOne({ employeeId: userDoc.employeeId });
    }

    if (!employeeDoc) {
      // Auto-provision an Employee record if missing for this user
      employeeDoc = await Employee.create({
        userId: userDoc._id,
        employeeId: userDoc.employeeId || `EMP-${Date.now().toString().slice(-4)}`,
        name: "Staff Member",
        email: userDoc.email,
        department: "General",
        designation: "Staff",
        workType: "FULL_TIME",
        joiningDate: new Date().toISOString().split("T")[0],
        isActive: true,
      });
    }

    const displayName = employeeDoc.name || userDoc.email;
    return { employee: employeeDoc, userDoc, displayName };
  }

  /**
   * Creates a new enquiry ticket by an employee
   */
  public async createEnquiry(
    userId: string,
    userRole: string,
    input: CreateEnquiryInput
  ): Promise<{ enquiry: IEnquiry; initialMessage: IEnquiryMessage }> {
    this.checkRateLimit(userId);

    const { employee, userDoc, displayName } = await this.resolveEmployee(userId);

    // Normalize and validate attachments
    const rawAttachments = [
      ...(input.attachments || []),
      ...(input.attachment ? [input.attachment] : []),
    ];

    const validatedAttachments: IEnquiryAttachment[] = [];
    for (const att of rawAttachments) {
      this.validateAttachment(att);
      validatedAttachments.push({
        name: att.name,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        url: att.url || "",
        dataUrl: att.dataUrl || "",
      });
    }

    const ticketNumber = await this.generateTicketNumber();

    const enquiry = await Enquiry.create({
      ticketNumber,
      employee: employee._id,
      employeeUser: userDoc._id,
      category: input.category as EnquiryCategory,
      subject: input.subject.trim(),
      status: "OPEN",
      priority: (input.priority || "MEDIUM") as EnquiryPriority,
      assignee: null,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      reopenDeadline: null,
      lastMessageAt: new Date(),
      attachments: validatedAttachments,
    });

    const initialMessage = await EnquiryMessage.create({
      enquiry: enquiry._id,
      sender: userDoc._id,
      senderRole: (userRole.toUpperCase() as "EMPLOYEE" | "HR" | "ADMIN") || "EMPLOYEE",
      message: input.message.trim(),
      attachments: validatedAttachments,
      readByRecipient: false,
      createdAt: new Date(),
    });

    // Audit Event
    await AuditEvent.create({
      entityType: "ENQUIRY",
      entityId: enquiry._id.toString(),
      performedBy: userDoc._id,
      performedByEmployeeId: userDoc.employeeId,
      action: "CREATE_ENQUIRY",
      newValue: {
        ticketNumber: enquiry.ticketNumber,
        category: enquiry.category,
        subject: enquiry.subject,
        priority: enquiry.priority,
      },
      timestamp: new Date(),
    }).catch(() => null);

    // Realtime Socket Event
    eventEmitterService.emit("enquiry.created", {
      enquiryId: enquiry._id.toString(),
      ticketNumber: enquiry.ticketNumber,
      category: enquiry.category,
      subject: enquiry.subject,
      priority: enquiry.priority,
      employeeId: employee._id.toString(),
      createdAt: enquiry.createdAt,
    });

    // Notify HR and Admins of the new incoming enquiry
    const hrUsers = await User.find({ role: { $in: [UserRole.HR, UserRole.ADMIN] } }).select("_id");
    for (const hr of hrUsers) {
      await Notification.create({
        user: hr._id,
        type: "ENQUIRY_REPLY",
        title: `New Enquiry: ${ticketNumber}`,
        message: `${displayName} submitted a new ${enquiry.category} enquiry: "${enquiry.subject}"`,
        payload: {
          enquiryId: enquiry._id.toString(),
          ticketNumber: enquiry.ticketNumber,
          category: enquiry.category,
        },
      }).catch(() => null);
    }

    return { enquiry, initialMessage };
  }

  /**
   * Retrieves enquiries scoped by role:
   * - Employees see only their own tickets.
   * - HR/Admins see all tickets with filtering, searching, and pagination.
   */
  public async listEnquiries(
    userId: string,
    userRole: string,
    query: {
      status?: string;
      category?: string;
      priority?: string;
      assigneeId?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    enquiries: IEnquiry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isHrOrAdmin = userRole === UserRole.HR || userRole === UserRole.ADMIN;
    const filter: Record<string, unknown> = {};

    if (!isHrOrAdmin) {
      filter.employeeUser = new Types.ObjectId(userId);
    } else {
      if (query.assigneeId) {
        filter.assignee = new Types.ObjectId(query.assigneeId);
      }
    }

    if (query.status) {
      filter.status = query.status.toUpperCase();
    }

    if (query.category) {
      filter.category = query.category.toUpperCase();
    }

    if (query.priority) {
      filter.priority = query.priority.toUpperCase();
    }

    if (query.search) {
      const term = query.search.trim();
      filter.$or = [
        { ticketNumber: { $regex: term, $options: "i" } },
        { subject: { $regex: term, $options: "i" } },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter)
        .populate("employee", "name employeeId department designation")
        .populate("assignee", "email role employeeId")
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Enquiry.countDocuments(filter),
    ]);

    return {
      enquiries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves an enquiry and its conversation thread by ID.
   * Strictly enforces access: employees cannot access tickets belonging to others.
   */
  public async getEnquiryById(
    enquiryId: string,
    userId: string,
    userRole: string
  ): Promise<{ enquiry: IEnquiry; messages: IEnquiryMessage[] }> {
    const enquiry = await Enquiry.findById(enquiryId)
      .populate("employee", "name employeeId department designation")
      .populate("assignee", "email role employeeId");

    if (!enquiry) {
      throw AppError.notFound("Enquiry not found");
    }

    const isHrOrAdmin = userRole === UserRole.HR || userRole === UserRole.ADMIN;
    if (!isHrOrAdmin && enquiry.employeeUser.toString() !== userId) {
      throw AppError.forbidden("You do not have permission to view this enquiry");
    }

    const messages = await EnquiryMessage.find({ enquiry: enquiry._id })
      .populate("sender", "email role employeeId")
      .sort({ createdAt: 1 });

    // Mark unread messages sent by others as read
    await EnquiryMessage.updateMany(
      {
        enquiry: enquiry._id,
        sender: { $ne: new Types.ObjectId(userId) },
        readByRecipient: false,
      },
      { $set: { readByRecipient: true } }
    );

    return { enquiry, messages };
  }

  /**
   * Adds a message to an enquiry thread.
   * - Records firstResponseAt timestamp on first HR reply.
   * - Automatically shifts status from OPEN to IN_PROGRESS on HR reply.
   * - Updates lastMessageAt and emits realtime socket events.
   */
  public async addMessage(
    enquiryId: string,
    userId: string,
    userRole: string,
    input: SendEnquiryMessageInput
  ): Promise<IEnquiryMessage> {
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw AppError.notFound("Enquiry not found");
    }

    const isHrOrAdmin = userRole === UserRole.HR || userRole === UserRole.ADMIN;
    if (!isHrOrAdmin && enquiry.employeeUser.toString() !== userId) {
      throw AppError.forbidden("You do not have permission to message on this enquiry");
    }

    if (enquiry.status === "CLOSED") {
      throw AppError.badRequest(
        "This enquiry is closed. Please reopen it to continue the conversation."
      );
    }

    // Validate attachments
    const rawAttachments = [
      ...(input.attachments || []),
      ...(input.attachment ? [input.attachment] : []),
    ];

    const validatedAttachments: IEnquiryAttachment[] = [];
    for (const att of rawAttachments) {
      this.validateAttachment(att);
      validatedAttachments.push({
        name: att.name,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        url: att.url || "",
        dataUrl: att.dataUrl || "",
      });
    }

    const senderRole = (userRole.toUpperCase() as "EMPLOYEE" | "HR" | "ADMIN") || "EMPLOYEE";
    const now = new Date();

    // First Response Metric & Status Transition:
    // If HR/Admin replies for the first time
    if (isHrOrAdmin && !enquiry.firstResponseAt) {
      enquiry.firstResponseAt = now;
      if (enquiry.status === "OPEN") {
        enquiry.status = "IN_PROGRESS";
      }
    }

    enquiry.lastMessageAt = now;
    await enquiry.save();

    const message = await EnquiryMessage.create({
      enquiry: enquiry._id,
      sender: new Types.ObjectId(userId),
      senderRole,
      message: input.message.trim(),
      attachments: validatedAttachments,
      readByRecipient: false,
      createdAt: now,
    });

    // Audit Event
    await AuditEvent.create({
      entityType: "ENQUIRY_MESSAGE",
      entityId: message._id.toString(),
      performedBy: new Types.ObjectId(userId),
      action: "SEND_ENQUIRY_MESSAGE",
      newValue: {
        enquiryId: enquiry._id.toString(),
        ticketNumber: enquiry.ticketNumber,
        senderRole,
        attachmentCount: validatedAttachments.length,
      },
      timestamp: now,
    }).catch(() => null);

    // Socket Event
    eventEmitterService.emit("enquiry.message_received", {
      enquiryId: enquiry._id.toString(),
      ticketNumber: enquiry.ticketNumber,
      messageId: message._id.toString(),
      senderId: userId,
      senderRole,
      message: message.message,
      attachments: message.attachments,
      createdAt: message.createdAt,
    });

    // In-App Notifications
    const senderEmp = await Employee.findOne({ userId: new Types.ObjectId(userId) });
    const senderName = senderEmp ? senderEmp.name : userRole;

    if (isHrOrAdmin) {
      // Notify Employee of HR's response
      await Notification.create({
        user: enquiry.employeeUser,
        type: "ENQUIRY_REPLY",
        title: `Reply on ${enquiry.ticketNumber}`,
        message: `${senderName} replied to your enquiry: "${enquiry.subject}"`,
        payload: {
          enquiryId: enquiry._id.toString(),
          ticketNumber: enquiry.ticketNumber,
        },
      }).catch(() => null);
    } else {
      // Notify Assigned HR (or all HR if unassigned) of Employee's reply
      const recipientIds: Types.ObjectId[] = enquiry.assignee
        ? [enquiry.assignee]
        : (await User.find({ role: { $in: [UserRole.HR, UserRole.ADMIN] } }).select("_id")).map(
            (u) => u._id
          );

      for (const recId of recipientIds) {
        await Notification.create({
          user: recId,
          type: "ENQUIRY_REPLY",
          title: `Reply on ${enquiry.ticketNumber}`,
          message: `${senderName} replied to enquiry: "${enquiry.subject}"`,
          payload: {
            enquiryId: enquiry._id.toString(),
            ticketNumber: enquiry.ticketNumber,
          },
        }).catch(() => null);
      }
    }

    return message;
  }

  /**
   * Updates enquiry status (OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED)
   */
  public async updateStatus(
    enquiryId: string,
    userId: string,
    userRole: string,
    newStatus: EnquiryStatus,
    note?: string
  ): Promise<IEnquiry> {
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw AppError.notFound("Enquiry not found");
    }

    const isHrOrAdmin = userRole === UserRole.HR || userRole === UserRole.ADMIN;
    // Employees can only mark their own enquiry as RESOLVED or CLOSED
    if (!isHrOrAdmin) {
      if (enquiry.employeeUser.toString() !== userId) {
        throw AppError.forbidden("You do not have permission to modify this enquiry");
      }
      if (newStatus !== "RESOLVED" && newStatus !== "CLOSED") {
        throw AppError.forbidden("Employees can only resolve or close their own enquiry.");
      }
    }

    const previousStatus = enquiry.status;
    const now = new Date();
    enquiry.status = newStatus;

    if (newStatus === "RESOLVED") {
      enquiry.resolvedAt = now;
      enquiry.reopenDeadline = new Date(
        now.getTime() + this.REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
    } else if (newStatus === "CLOSED") {
      enquiry.closedAt = now;
      if (!enquiry.reopenDeadline) {
        enquiry.reopenDeadline = new Date(
          now.getTime() + this.REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000
        );
      }
    } else if (newStatus === "IN_PROGRESS" || newStatus === "OPEN") {
      // Re-opening or continuing
      enquiry.closedAt = null;
    }

    enquiry.lastMessageAt = now;
    await enquiry.save();

    // If a note was provided, post an automated status change message
    if (note) {
      await EnquiryMessage.create({
        enquiry: enquiry._id,
        sender: new Types.ObjectId(userId),
        senderRole: (userRole.toUpperCase() as "EMPLOYEE" | "HR" | "ADMIN") || "HR",
        message: `Status changed to ${newStatus}: ${note}`,
        attachments: [],
        readByRecipient: false,
        createdAt: now,
      });
    }

    // Audit Event
    await AuditEvent.create({
      entityType: "ENQUIRY",
      entityId: enquiry._id.toString(),
      performedBy: new Types.ObjectId(userId),
      action: "UPDATE_ENQUIRY_STATUS",
      previousValue: { status: previousStatus },
      newValue: { status: newStatus, note },
      timestamp: now,
    }).catch(() => null);

    // Socket Event
    eventEmitterService.emit("enquiry.status_updated", {
      enquiryId: enquiry._id.toString(),
      ticketNumber: enquiry.ticketNumber,
      previousStatus,
      status: newStatus,
      updatedBy: userId,
      reopenDeadline: enquiry.reopenDeadline,
    });

    // Notify employee of status update
    await Notification.create({
      user: enquiry.employeeUser,
      type: "ENQUIRY_STATUS",
      title: `Status Updated: ${enquiry.ticketNumber}`,
      message: `Your enquiry "${enquiry.subject}" status is now ${newStatus}.`,
      payload: {
        enquiryId: enquiry._id.toString(),
        ticketNumber: enquiry.ticketNumber,
        status: newStatus,
      },
    }).catch(() => null);

    return enquiry;
  }

  /**
   * Reopens a resolved or closed enquiry within the allowed reopen window (7 days).
   * Reopening after deadline is rejected with 400 Bad Request.
   */
  public async reopenEnquiry(
    enquiryId: string,
    userId: string,
    userRole: string,
    reason: string
  ): Promise<IEnquiry> {
    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw AppError.notFound("Enquiry not found");
    }

    const isHrOrAdmin = userRole === UserRole.HR || userRole === UserRole.ADMIN;
    if (!isHrOrAdmin && enquiry.employeeUser.toString() !== userId) {
      throw AppError.forbidden("You do not have permission to reopen this enquiry");
    }

    if (enquiry.status !== "RESOLVED" && enquiry.status !== "CLOSED") {
      throw AppError.badRequest(
        `Enquiry is already active (current status: ${enquiry.status}).`
      );
    }

    // Check 7-day reopen deadline
    const now = new Date();
    if (enquiry.reopenDeadline && now.getTime() > enquiry.reopenDeadline.getTime()) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_BAD_REQUEST,
        "The 7-day window to reopen this enquiry has expired. Please create a new enquiry ticket."
      );
    }

    const previousStatus = enquiry.status;
    enquiry.status = "IN_PROGRESS";
    enquiry.closedAt = null;
    enquiry.resolvedAt = null;
    enquiry.reopenDeadline = null;
    enquiry.lastMessageAt = now;
    await enquiry.save();

    // Log reason message in the conversation thread
    await EnquiryMessage.create({
      enquiry: enquiry._id,
      sender: new Types.ObjectId(userId),
      senderRole: (userRole.toUpperCase() as "EMPLOYEE" | "HR" | "ADMIN") || "EMPLOYEE",
      message: `Ticket Reopened: ${reason}`,
      attachments: [],
      readByRecipient: false,
      createdAt: now,
    });

    // Audit Event
    await AuditEvent.create({
      entityType: "ENQUIRY",
      entityId: enquiry._id.toString(),
      performedBy: new Types.ObjectId(userId),
      action: "REOPEN_ENQUIRY",
      previousValue: { status: previousStatus },
      newValue: { status: "IN_PROGRESS", reason },
      timestamp: now,
    }).catch(() => null);

    // Socket Event
    eventEmitterService.emit("enquiry.status_updated", {
      enquiryId: enquiry._id.toString(),
      ticketNumber: enquiry.ticketNumber,
      previousStatus,
      status: "IN_PROGRESS",
      action: "REOPENED",
      reopenedBy: userId,
      reason,
    });

    // Notify assigned HR or HR team
    const hrUsers = enquiry.assignee
      ? [enquiry.assignee]
      : (await User.find({ role: { $in: [UserRole.HR, UserRole.ADMIN] } }).select("_id")).map(
          (u) => u._id
        );

    for (const hrId of hrUsers) {
      await Notification.create({
        user: hrId,
        type: "ENQUIRY_STATUS",
        title: `Enquiry Reopened: ${enquiry.ticketNumber}`,
        message: `Enquiry "${enquiry.subject}" was reopened with reason: "${reason}"`,
        payload: {
          enquiryId: enquiry._id.toString(),
          ticketNumber: enquiry.ticketNumber,
          status: "IN_PROGRESS",
        },
      }).catch(() => null);
    }

    return enquiry;
  }

  /**
   * Assigns or reassigns an enquiry ticket to an HR/Admin user.
   */
  public async assignEnquiry(
    enquiryId: string,
    assignerUserId: string,
    assignerRole: string,
    targetAssigneeUserId: string
  ): Promise<IEnquiry> {
    if (assignerRole !== UserRole.HR && assignerRole !== UserRole.ADMIN) {
      throw AppError.forbidden("Only HR and Administrators can assign enquiries.");
    }

    const enquiry = await Enquiry.findById(enquiryId);
    if (!enquiry) {
      throw AppError.notFound("Enquiry not found");
    }

    const targetUser = await User.findById(targetAssigneeUserId);
    if (!targetUser) {
      throw AppError.notFound("Target assignee user not found");
    }

    if (targetUser.role !== UserRole.HR && targetUser.role !== UserRole.ADMIN) {
      throw AppError.badRequest("Enquiries can only be assigned to HR or Admin personnel.");
    }

    const previousAssignee = enquiry.assignee ? enquiry.assignee.toString() : null;
    enquiry.assignee = targetUser._id;
    await enquiry.save();

    const now = new Date();
    const targetEmp = await Employee.findOne({ userId: targetUser._id });
    const assigneeDisplayName = targetEmp ? targetEmp.name : targetUser.email;

    // Audit Event
    await AuditEvent.create({
      entityType: "ENQUIRY",
      entityId: enquiry._id.toString(),
      performedBy: new Types.ObjectId(assignerUserId),
      action: "ASSIGN_ENQUIRY",
      previousValue: { assignee: previousAssignee },
      newValue: { assignee: targetUser._id.toString(), assigneeName: assigneeDisplayName },
      timestamp: now,
    }).catch(() => null);

    // Socket Event
    eventEmitterService.emit("enquiry.assigned", {
      enquiryId: enquiry._id.toString(),
      ticketNumber: enquiry.ticketNumber,
      assigneeId: targetUser._id.toString(),
      assigneeName: assigneeDisplayName,
      assignedBy: assignerUserId,
    });

    // Notify new assignee
    await Notification.create({
      user: targetUser._id,
      type: "ENQUIRY_ASSIGNED",
      title: `Assigned to Enquiry: ${enquiry.ticketNumber}`,
      message: `You were assigned to enquiry "${enquiry.subject}" (${enquiry.priority} priority).`,
      payload: {
        enquiryId: enquiry._id.toString(),
        ticketNumber: enquiry.ticketNumber,
        category: enquiry.category,
      },
    }).catch(() => null);

    return enquiry;
  }
}

export const enquiryService = new EnquiryService();
