import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { app } from "../src/app";
import {
  Enquiry,
  EnquiryMessage,
  Notification,
  User,
  Employee,
  AuditEvent,
} from "../src/models";
import { enquiryService } from "../src/services/enquiry.service";
import { featureFlagService } from "../src/services/featureFlag.service";
import { env } from "../src/config/env";
import { UserRole } from "@vorldx/shared";

describe("Enquiries Subsystem behind Feature Flag (apps/api)", () => {
  let adminToken: string;
  let hrToken: string;
  let employeeAToken: string;
  let employeeBToken: string;

  let adminUserId: string;
  let hrUserId: string;
  let empAUserId: string;
  let empBUserId: string;

  let empAEmployeeDocId: string;
  let empBEmployeeDocId: string;

  beforeEach(async () => {
    // Clear and reset collections
    await Enquiry.deleteMany({});
    await EnquiryMessage.deleteMany({});
    await Notification.deleteMany({});
    await AuditEvent.deleteMany({});
    await User.deleteMany({});
    await Employee.deleteMany({});

    featureFlagService.clearInMemoryOverrides();
    // Enable enquiries feature flag by default for tests
    featureFlagService.setInMemoryOverride("enquiries", true);
    enquiryService.resetRateLimit();

    // 1. Seed Admin User
    const adminUser = await User.create({
      employeeId: "ADM-001",
      email: "admin@vorldx.test",
      passwordHash: "hash",
      role: UserRole.ADMIN,
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockoutUntil: null,
      refreshTokenHash: null,
    });
    adminUserId = adminUser._id.toString();
    adminToken = jwt.sign(
      { userId: adminUserId, role: UserRole.ADMIN, email: adminUser.email },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Seed HR User
    const hrUser = await User.create({
      employeeId: "HR-001",
      email: "hr@vorldx.test",
      passwordHash: "hash",
      role: UserRole.HR,
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockoutUntil: null,
      refreshTokenHash: null,
    });
    hrUserId = hrUser._id.toString();
    hrToken = jwt.sign(
      { userId: hrUserId, role: UserRole.HR, email: hrUser.email },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await Employee.create({
      userId: hrUser._id,
      employeeId: hrUser.employeeId,
      name: "Hannah Rogers",
      email: hrUser.email,
      department: "Human Resources",
      designation: "HR Officer",
      workType: "FULL_TIME",
      joiningDate: "2024-01-01",
      isActive: true,
    });

    // 3. Seed Employee A
    const empAUser = await User.create({
      employeeId: "EMP-101",
      email: "alice@vorldx.test",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockoutUntil: null,
      refreshTokenHash: null,
    });
    empAUserId = empAUser._id.toString();
    employeeAToken = jwt.sign(
      { userId: empAUserId, role: UserRole.EMPLOYEE, email: empAUser.email },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const empADoc = await Employee.create({
      userId: empAUser._id,
      employeeId: empAUser.employeeId,
      name: "Alice Smith",
      email: empAUser.email,
      department: "Engineering",
      designation: "Frontend Engineer",
      workType: "FULL_TIME",
      joiningDate: "2024-02-01",
      isActive: true,
    });
    empAEmployeeDocId = empADoc._id.toString();

    // 4. Seed Employee B
    const empBUser = await User.create({
      employeeId: "EMP-102",
      email: "bob@vorldx.test",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockoutUntil: null,
      refreshTokenHash: null,
    });
    empBUserId = empBUser._id.toString();
    employeeBToken = jwt.sign(
      { userId: empBUserId, role: UserRole.EMPLOYEE, email: empBUser.email },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const empBDoc = await Employee.create({
      userId: empBUser._id,
      employeeId: empBUser.employeeId,
      name: "Bob Jones",
      email: empBUser.email,
      department: "Operations",
      designation: "Support Specialist",
      workType: "FULL_TIME",
      joiningDate: "2024-03-01",
      isActive: true,
    });
    empBEmployeeDocId = empBDoc._id.toString();
  });

  // =========================================================================
  // 1. FEATURE FLAG ISOLATION
  // =========================================================================
  describe("Feature Flag Isolation", () => {
    it("returns 404 ERR_NOT_FOUND when enquiries feature flag is disabled", async () => {
      featureFlagService.setInMemoryOverride("enquiries", false);

      const res = await request(app)
        .get("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("ERR_NOT_FOUND");
    });
  });

  // =========================================================================
  // 2. CREATION, CATEGORIES, & RATE LIMITING
  // =========================================================================
  describe("Enquiry Creation & Rate Limiting", () => {
    it("creates an enquiry successfully with valid category and auto-generated ticket number", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "ATTENDANCE",
          subject: "Missing check-in on Monday",
          message: "I checked in via QR but the attendance ledger shows absent.",
          priority: "HIGH",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketNumber).toMatch(/^ENQ-\d{4}-\d+/);
      expect(res.body.data.status).toBe("OPEN");
      expect(res.body.data.priority).toBe("HIGH");
      expect(res.body.data.category).toBe("ATTENDANCE");
      expect(res.body.initialMessage.message).toContain("I checked in via QR");

      // Verify Audit Event created
      const audit = await AuditEvent.findOne({
        entityType: "ENQUIRY",
        action: "CREATE_ENQUIRY",
      });
      expect(audit).not.toBeNull();
      expect(audit?.entityId).toBe(res.body.data._id);

      // Verify Notification created for HR
      const notification = await Notification.findOne({
        user: new Types.ObjectId(hrUserId),
      });
      expect(notification).not.toBeNull();
      expect(notification?.title).toContain(res.body.data.ticketNumber);
    });

    it("enforces sliding rate limit of max 5 tickets per user window", async () => {
      // Create 5 tickets successfully
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post("/api/enquiries")
          .set("Authorization", `Bearer ${employeeAToken}`)
          .send({
            category: "LEAVE",
            subject: `Leave Question ${i}`,
            message: `Please check my balance for query ${i}`,
          });
        expect(res.status).toBe(201);
      }

      // 6th ticket must be rate limited
      const rateLimitedRes = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "OTHER",
          subject: "Sixth ticket attempt",
          message: "This should be blocked by rate limit",
        });

      expect(rateLimitedRes.status).toBe(429);
      expect(rateLimitedRes.body.code).toBe("ERR_RATE_LIMIT_EXCEEDED");
    });
  });

  // =========================================================================
  // 3. ATTACHMENT VALIDATION (SIZE & TYPE LIMITS)
  // =========================================================================
  describe("Attachment Validation", () => {
    it("rejects non-image mime types (e.g., pdf or exe)", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "TECHNICAL",
          subject: "System Error Log",
          message: "Attached error log file.",
          attachment: {
            name: "error.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ERR_INVALID_INPUT");
      expect(JSON.stringify(res.body.errors || res.body.message)).toContain("Invalid image type");
    });

    it("rejects attachment exceeding 5MB size limit", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "TECHNICAL",
          subject: "Huge screenshot",
          message: "Screenshot attached.",
          attachment: {
            name: "huge.png",
            mimeType: "image/png",
            sizeBytes: 6 * 1024 * 1024, // 6MB > 5MB limit
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("ERR_INVALID_INPUT");
      expect(JSON.stringify(res.body.errors || res.body.message)).toContain("cannot exceed 5MB");
    });

    it("accepts valid image attachment under 5MB", async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "WFH",
          subject: "WFH Proof",
          message: "Please see attached screenshot proof.",
          attachment: {
            name: "proof.webp",
            mimeType: "image/webp",
            sizeBytes: 350 * 1024, // 350 KB
            url: "https://cdn.vorldx.test/proof.webp",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attachments).toHaveLength(1);
      expect(res.body.data.attachments[0].mimeType).toBe("image/webp");
    });
  });

  // =========================================================================
  // 4. AUTHORIZATION & SCOPING (EMPLOYEE VS HR)
  // =========================================================================
  describe("Authorization & Scoping", () => {
    let empATicketId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "PAYROLL",
          subject: "Alice Private Payroll Note",
          message: "Clarification on tax deduction in March payslip.",
        });
      empATicketId = res.body.data._id;
    });

    it("allows Employee A to view their own ticket", async () => {
      const res = await request(app)
        .get(`/api/enquiries/${empATicketId}`)
        .set("Authorization", `Bearer ${employeeAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.subject).toBe("Alice Private Payroll Note");
      expect(res.body.messages).toHaveLength(1);
    });

    it("forbids Employee B from viewing Employee A's ticket", async () => {
      const res = await request(app)
        .get(`/api/enquiries/${empATicketId}`)
        .set("Authorization", `Bearer ${employeeBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ERR_FORBIDDEN");
    });

    it("forbids Employee B from sending message on Employee A's ticket", async () => {
      const res = await request(app)
        .post(`/api/enquiries/${empATicketId}/messages`)
        .set("Authorization", `Bearer ${employeeBToken}`)
        .send({
          message: "I am trying to snoop on this ticket.",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ERR_FORBIDDEN");
    });

    it("scopes GET /api/enquiries so employee only receives their own tickets", async () => {
      // Bob creates a ticket
      await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeBToken}`)
        .send({
          category: "OTHER",
          subject: "Bob's separate query",
          message: "Question about office badge replacement.",
        });

      // Alice lists: should only have 1 ticket
      const aliceList = await request(app)
        .get("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`);
      expect(aliceList.status).toBe(200);
      expect(aliceList.body.total).toBe(1);
      expect(aliceList.body.data[0].subject).toBe("Alice Private Payroll Note");

      // Bob lists: should only have 1 ticket
      const bobList = await request(app)
        .get("/api/enquiries")
        .set("Authorization", `Bearer ${employeeBToken}`);
      expect(bobList.status).toBe(200);
      expect(bobList.body.total).toBe(1);
      expect(bobList.body.data[0].subject).toBe("Bob's separate query");

      // HR lists: sees both tickets
      const hrList = await request(app)
        .get("/api/enquiries")
        .set("Authorization", `Bearer ${hrToken}`);
      expect(hrList.status).toBe(200);
      expect(hrList.body.total).toBe(2);
    });
  });

  // =========================================================================
  // 5. THREADING, FIRST RESPONSE TIMESTAMP & AUTO STATUS TRANSITION
  // =========================================================================
  describe("Message Threading & First Response", () => {
    it("records firstResponseAt and shifts status from OPEN to IN_PROGRESS on HR reply", async () => {
      // 1. Alice creates ticket
      const createRes = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "ATTENDANCE",
          subject: "Check-in dispute",
          message: "My check-in at 9:02 was flagged as late.",
        });

      const ticketId = createRes.body.data._id;
      expect(createRes.body.data.status).toBe("OPEN");
      expect(createRes.body.data.firstResponseAt).toBeNull();

      // 2. HR responds
      const hrReplyRes = await request(app)
        .post(`/api/enquiries/${ticketId}/messages`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          message: "We are reviewing your biometric log with the security team.",
        });

      expect(hrReplyRes.status).toBe(201);
      expect(hrReplyRes.body.data.senderRole).toBe("HR");

      // 3. Inspect ticket state
      const ticketRes = await request(app)
        .get(`/api/enquiries/${ticketId}`)
        .set("Authorization", `Bearer ${employeeAToken}`);

      expect(ticketRes.body.data.status).toBe("IN_PROGRESS");
      expect(ticketRes.body.data.firstResponseAt).not.toBeNull();
      expect(ticketRes.body.messages).toHaveLength(2);

      // Verify Notification sent to Alice
      const notif = await Notification.findOne({
        user: new Types.ObjectId(empAUserId),
        type: "ENQUIRY_REPLY",
      });
      expect(notif).not.toBeNull();
      expect(notif?.message).toContain("replied to your enquiry");
    });
  });

  // =========================================================================
  // 6. ASSIGNMENT & REASSIGNMENT
  // =========================================================================
  describe("Ticket Assignment", () => {
    it("forbids employees from assigning tickets", async () => {
      const createRes = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "TECHNICAL",
          subject: "App crashes",
          message: "Crash log on iOS 18",
        });

      const ticketId = createRes.body.data._id;

      const assignRes = await request(app)
        .patch(`/api/enquiries/${ticketId}/assign`)
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          assigneeId: hrUserId,
        });

      expect(assignRes.status).toBe(403);
    });

    it("allows HR and Admin to assign and reassign tickets", async () => {
      const createRes = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "LEAVE",
          subject: "Maternity Leave Calculation",
          message: "Need exact dates for maternity policy.",
        });

      const ticketId = createRes.body.data._id;

      // Assign to HR
      const assignRes = await request(app)
        .patch(`/api/enquiries/${ticketId}/assign`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          assigneeId: hrUserId,
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.assignee).toBe(hrUserId);

      // Verify Notification for assigned HR
      const notif = await Notification.findOne({
        user: new Types.ObjectId(hrUserId),
        type: "ENQUIRY_ASSIGNED",
      });
      expect(notif).not.toBeNull();
      expect(notif?.title).toContain("Assigned to Enquiry");
    });
  });

  // =========================================================================
  // 7. STATUS LIFECYCLE & 7-DAY REOPEN POLICY
  // =========================================================================
  describe("Status Lifecycle & Reopening", () => {
    let ticketId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post("/api/enquiries")
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          category: "TECHNICAL",
          subject: "VPN Access issue",
          message: "Cannot connect to staging VPN server.",
        });
      ticketId = createRes.body.data._id;
    });

    it("HR updates status to RESOLVED and CLOSED with note", async () => {
      // 1. Resolve ticket
      const resolveRes = await request(app)
        .patch(`/api/enquiries/${ticketId}/status`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: "RESOLVED",
          note: "Credentials regenerated and emailed to user.",
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.status).toBe("RESOLVED");
      expect(resolveRes.body.data.reopenDeadline).not.toBeNull();

      // 2. Close ticket
      const closeRes = await request(app)
        .patch(`/api/enquiries/${ticketId}/status`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: "CLOSED",
          note: "Issue verified resolved.",
        });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.data.status).toBe("CLOSED");
    });

    it("allows employee to reopen a closed enquiry within the 7-day window", async () => {
      // Resolve first
      await request(app)
        .patch(`/api/enquiries/${ticketId}/status`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ status: "RESOLVED" });

      // Employee reopens
      const reopenRes = await request(app)
        .post(`/api/enquiries/${ticketId}/reopen`)
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          reason: "VPN disconnected again after 10 minutes of active use.",
        });

      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.data.status).toBe("IN_PROGRESS");

      // Verify reopen message was added to the conversation
      const checkRes = await request(app)
        .get(`/api/enquiries/${ticketId}`)
        .set("Authorization", `Bearer ${employeeAToken}`);

      const lastMsg = checkRes.body.messages[checkRes.body.messages.length - 1];
      expect(lastMsg.message).toContain("Ticket Reopened");
      expect(lastMsg.message).toContain("VPN disconnected again");
    });

    it("rejects reopen attempts when 7-day reopen window has expired", async () => {
      // Mark as resolved with an expired deadline (e.g. 10 days ago)
      const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await Enquiry.findByIdAndUpdate(ticketId, {
        status: "RESOLVED",
        resolvedAt: expiredDate,
        reopenDeadline: expiredDate,
      });

      // Employee attempts to reopen
      const reopenRes = await request(app)
        .post(`/api/enquiries/${ticketId}/reopen`)
        .set("Authorization", `Bearer ${employeeAToken}`)
        .send({
          reason: "Trying to reopen long after closure.",
        });

      expect(reopenRes.status).toBe(400);
      expect(reopenRes.body.message).toContain("7-day window to reopen this enquiry has expired");
    });
  });
});
