import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { app } from "../src/app";
import {
  Announcement,
  AnnouncementTemplate,
  Notification,
  AttendancePolicy,
  User,
  Employee,
  CalendarEvent,
} from "../src/models";
import { announcementService } from "../src/services/announcement.service";
import { calendarService } from "../src/services/calendar.service";
import { featureFlagService } from "../src/services/featureFlag.service";
import { env } from "../src/config/env";
import { UserRole, WorkType, SocketEvent } from "@vorldx/shared";

describe("Announcements Subsystem behind Feature Flag (apps/api)", () => {
  let adminToken: string;
  let hrToken: string;
  let engEmpToken: string;
  let opsEmpToken: string;

  let adminUserId: string;
  let hrUserId: string;
  let engUserId: string;
  let opsUserId: string;

  let engEmployeeId: string;
  let opsEmployeeId: string;

  beforeEach(async () => {
    // Clear and reset database & caches
    await Announcement.deleteMany({});
    await AnnouncementTemplate.deleteMany({});
    await Notification.deleteMany({});
    await CalendarEvent.deleteMany({});
    await User.deleteMany({});
    await Employee.deleteMany({});
    await AttendancePolicy.deleteMany({});

    calendarService.invalidateCache();
    featureFlagService.clearInMemoryOverrides();
    // Enable announcements feature flag for the test suite by default
    featureFlagService.setInMemoryOverride("announcements", true);

    // Initialize default announcement templates
    await announcementService.ensureDefaultTemplates();

    // 1. Seed Policy
    const policy = await AttendancePolicy.create({
      name: "Standard Attendance Policy",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      isDefault: true,
      workdays: [1, 2, 3, 4, 5],
      shifts: [
        {
          name: "General Day Shift",
          startTime: "09:00",
          endTime: "18:00",
          graceMinutes: 15,
          checkInWindowStartMinutes: 60,
          checkInWindowEndMinutes: 180,
          checkOutWindowStartMinutes: 60,
          checkOutWindowEndMinutes: 180,
          isOvernight: false,
          isActive: true,
        },
      ],
    });

    // 2. Seed Users & Employees
    adminUserId = new Types.ObjectId().toString();
    hrUserId = new Types.ObjectId().toString();
    engUserId = new Types.ObjectId().toString();
    opsUserId = new Types.ObjectId().toString();

    engEmployeeId = "EMP-ENG-001";
    opsEmployeeId = "EMP-OPS-002";

    await User.create([
      {
        _id: adminUserId,
        employeeId: "ADM-001",
        email: "admin@vorldx.demo",
        passwordHash: "hashedPassword123",
        role: UserRole.ADMIN,
        status: "ACTIVE",
      },
      {
        _id: hrUserId,
        employeeId: "HR-001",
        email: "hr@vorldx.demo",
        passwordHash: "hashedPassword123",
        role: UserRole.HR,
        status: "ACTIVE",
      },
      {
        _id: engUserId,
        employeeId: engEmployeeId,
        email: "engineer@vorldx.demo",
        passwordHash: "hashedPassword123",
        role: UserRole.EMPLOYEE,
        status: "ACTIVE",
      },
      {
        _id: opsUserId,
        employeeId: opsEmployeeId,
        email: "operations@vorldx.demo",
        passwordHash: "hashedPassword123",
        role: UserRole.EMPLOYEE,
        status: "ACTIVE",
      },
    ]);

    await Employee.create([
      {
        employeeId: engEmployeeId,
        name: "Priya Sharma",
        email: "engineer@vorldx.demo",
        department: "Engineering",
        designation: "Software Engineer",
        workType: WorkType.FULL_TIME,
        shiftId: policy.shifts[0]._id,
        joiningDate: "2024-01-01",
        isActive: true,
      },
      {
        employeeId: opsEmployeeId,
        name: "Arun Patel",
        email: "operations@vorldx.demo",
        department: "Operations",
        designation: "Operations Lead",
        workType: WorkType.FULL_TIME,
        shiftId: policy.shifts[0]._id,
        joiningDate: "2024-02-01",
        isActive: true,
      },
    ]);

    // Generate JWT tokens
    adminToken = jwt.sign(
      { userId: adminUserId, employeeId: "ADM-001", email: "admin@vorldx.demo", role: UserRole.ADMIN },
      env.JWT_SECRET
    );
    hrToken = jwt.sign(
      { userId: hrUserId, employeeId: "HR-001", email: "hr@vorldx.demo", role: UserRole.HR },
      env.JWT_SECRET
    );
    engEmpToken = jwt.sign(
      { userId: engUserId, employeeId: engEmployeeId, email: "engineer@vorldx.demo", role: UserRole.EMPLOYEE },
      env.JWT_SECRET
    );
    opsEmpToken = jwt.sign(
      { userId: opsUserId, employeeId: opsEmployeeId, email: "operations@vorldx.demo", role: UserRole.EMPLOYEE },
      env.JWT_SECRET
    );
  });

  // =========================================================================
  // 1. Feature Flag Guard
  // =========================================================================
  it("blocks all announcement endpoints with 404 when 'announcements' feature flag is disabled", async () => {
    featureFlagService.setInMemoryOverride("announcements", false);

    const getRes = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.message).toContain("disabled");

    const postRes = await request(app)
      .post("/api/announcements")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ title: "Test Announcement", body: "Sample content here" });
    expect(postRes.status).toBe(404);

    const unreadRes = await request(app)
      .get("/api/announcements/unread-count")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(unreadRes.status).toBe(404);
  });

  // =========================================================================
  // 2. Manual Announcements (Create, Read, Update, Delete)
  // =========================================================================
  it("allows HR / Admin to create a manual announcement with audience, priority, and pinning", async () => {
    const res = await request(app)
      .post("/api/announcements")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        title: "All-Hands Meeting Q4",
        body: "Join us this Friday at 4 PM for the Q4 all-hands presentation.",
        audience: { scope: "all", departments: [], roles: [] },
        priority: "HIGH",
        pinned: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe("All-Hands Meeting Q4");
    expect(res.body.data.priority).toBe("HIGH");
    expect(res.body.data.pinned).toBe(true);
    expect(res.body.data.source).toBe("manual");
  });

  it("prevents standard employees from creating or deleting announcements", async () => {
    const createRes = await request(app)
      .post("/api/announcements")
      .set("Authorization", `Bearer ${engEmpToken}`)
      .send({ title: "Unauthorized Title", body: "Unauthorized Body Content" });
    expect(createRes.status).toBe(403);

    // Create an announcement via Admin
    const announcement = await announcementService.createManualAnnouncement(
      { title: "Legit Broadcast", body: "Important company broadcast" },
      { userId: adminUserId, role: UserRole.ADMIN }
    );

    const deleteRes = await request(app)
      .delete(`/api/announcements/${announcement._id}`)
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(deleteRes.status).toBe(403);
  });

  it("allows Admin to update and delete an existing announcement", async () => {
    const announcement = await announcementService.createManualAnnouncement(
      { title: "Original Title", body: "Original body text here" },
      { userId: adminUserId, role: UserRole.ADMIN }
    );

    const updateRes = await request(app)
      .put(`/api/announcements/${announcement._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Updated Title Headline",
        pinned: true,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe("Updated Title Headline");
    expect(updateRes.body.data.pinned).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/announcements/${announcement._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(200);

    const check = await Announcement.findById(announcement._id);
    expect(check).toBeNull();
  });

  // =========================================================================
  // 3. Audience Filtering (all, department, role)
  // =========================================================================
  it("filters announcements accurately based on audience scope (all, department, role)", async () => {
    // 1. All employees
    await announcementService.createManualAnnouncement(
      {
        title: "Company-Wide Broadcast",
        body: "Relevant to all staff members",
        audience: { scope: "all", departments: [], roles: [] },
      },
      { userId: adminUserId }
    );

    // 2. Department targeted: Engineering only
    await announcementService.createManualAnnouncement(
      {
        title: "Engineering Hackathon",
        body: "Mandatory tech briefing for engineers",
        audience: { scope: "department", departments: ["Engineering"], roles: [] },
      },
      { userId: adminUserId }
    );

    // 3. Role targeted: HR only
    await announcementService.createManualAnnouncement(
      {
        title: "HR Compliance Notice",
        body: "Confidential HR audit checklist",
        audience: { scope: "role", departments: [], roles: ["HR", "ADMIN"] },
      },
      { userId: adminUserId }
    );

    // Engineering employee query
    const engRes = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(engRes.status).toBe(200);
    expect(engRes.body.data.length).toBe(2);
    const engTitles = engRes.body.data.map((a: any) => a.title);
    expect(engTitles).toContain("Company-Wide Broadcast");
    expect(engTitles).toContain("Engineering Hackathon");
    expect(engTitles).not.toContain("HR Compliance Notice");

    // Operations employee query
    const opsRes = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${opsEmpToken}`);
    expect(opsRes.status).toBe(200);
    expect(opsRes.body.data.length).toBe(1);
    expect(opsRes.body.data[0].title).toBe("Company-Wide Broadcast");

    // HR user query
    const hrRes = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(hrRes.status).toBe(200);
    const hrTitles = hrRes.body.data.map((a: any) => a.title);
    expect(hrTitles).toContain("Company-Wide Broadcast");
    expect(hrTitles).toContain("HR Compliance Notice");
    expect(hrTitles).not.toContain("Engineering Hackathon");
  });

  // =========================================================================
  // 4. Expiry & Start Dates Filtering
  // =========================================================================
  it("excludes expired and future scheduled announcements from the active employee view", async () => {
    const now = Date.now();

    // 1. Active announcement
    await announcementService.createManualAnnouncement(
      {
        title: "Active Notice",
        body: "Currently live and valid announcement",
        startsAt: new Date(now - 3600000), // 1 hour ago
        expiresAt: new Date(now + 86400000), // tomorrow
      },
      { userId: adminUserId }
    );

    // 2. Expired announcement
    await announcementService.createManualAnnouncement(
      {
        title: "Past Expired Notice",
        body: "This should be hidden from active list",
        startsAt: new Date(now - 86400000),
        expiresAt: new Date(now - 3600000), // expired 1 hour ago
      },
      { userId: adminUserId }
    );

    // 3. Future scheduled announcement
    await announcementService.createManualAnnouncement(
      {
        title: "Future Notice",
        body: "Starts tomorrow",
        startsAt: new Date(now + 86400000),
        expiresAt: new Date(now + 172800000),
      },
      { userId: adminUserId }
    );

    const res = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe("Active Notice");
  });

  // =========================================================================
  // 5. Read Tracking & Unread Count
  // =========================================================================
  it("tracks read status per user, supports unread filtering, and decrements unread count", async () => {
    const ann1 = await announcementService.createManualAnnouncement(
      { title: "Broadcast Alpha", body: "Alpha message details" },
      { userId: adminUserId }
    );
    const ann2 = await announcementService.createManualAnnouncement(
      { title: "Broadcast Beta", body: "Beta message details" },
      { userId: adminUserId }
    );

    // Initial unread count should be 2
    const unreadBefore = await request(app)
      .get("/api/announcements/unread-count")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(unreadBefore.body.count).toBe(2);

    // Mark ann1 as read
    const readRes = await request(app)
      .post(`/api/announcements/${ann1._id}/read`)
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.success).toBe(true);

    // Unread count should now be 1
    const unreadAfter = await request(app)
      .get("/api/announcements/unread-count")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(unreadAfter.body.count).toBe(1);

    // Fetch active list and verify isRead flag
    const listRes = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${engEmpToken}`);
    const foundAnn1 = listRes.body.data.find((a: any) => a._id === ann1._id.toString());
    const foundAnn2 = listRes.body.data.find((a: any) => a._id === ann2._id.toString());
    expect(foundAnn1.isRead).toBe(true);
    expect(foundAnn2.isRead).toBe(false);

    // Test unreadOnly filter
    const unreadOnlyRes = await request(app)
      .get("/api/announcements?unreadOnly=true")
      .set("Authorization", `Bearer ${engEmpToken}`);
    expect(unreadOnlyRes.body.data.length).toBe(1);
    expect(unreadOnlyRes.body.data[0]._id).toBe(ann2._id.toString());
  });

  // =========================================================================
  // 6. Duplicate Prevention (Idempotent per Template and Date)
  // =========================================================================
  it("strictly prevents duplicate auto-announcements for the same template, date, and entity", async () => {
    const todayStr = "2026-11-01";

    // 1st generation
    const first = await announcementService.generateAutoAnnouncement(
      "HOLIDAY_TOMORROW",
      { title: "Diwali (Festival of Lights)", date: todayStr },
      { test: 1 },
      todayStr,
      "diwali-2026"
    );
    expect(first).not.toBeNull();
    expect(first?.source).toBe("auto");
    expect(first?.isAuto).toBe(true);

    // 2nd generation with identical key
    const second = await announcementService.generateAutoAnnouncement(
      "HOLIDAY_TOMORROW",
      { title: "Diwali (Festival of Lights)", date: todayStr },
      { test: 2 },
      todayStr,
      "diwali-2026"
    );

    // Should return existing without creating another document
    expect(second?._id.toString()).toBe(first?._id.toString());

    const count = await Announcement.countDocuments({ templateKey: "HOLIDAY_TOMORROW" });
    expect(count).toBe(1);
  });

  // =========================================================================
  // 7. Holiday Trigger using CalendarService
  // =========================================================================
  it("automatically generates 'Tomorrow is a holiday: {title}' using CalendarService", async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateKey = tomorrow.toISOString().split("T")[0];

    // Seed holiday in CalendarService
    await calendarService.createEvent(
      {
        title: "Republic Day",
        type: "holiday",
        startDate: `${tomorrowDateKey}T00:00:00.000Z`,
        endDate: `${tomorrowDateKey}T23:59:59.999Z`,
        isFullDay: true,
      },
      { userId: adminUserId }
    );

    // Run scheduled evaluation
    const jobResult = await announcementService.runScheduledJob(now);
    expect(jobResult.evaluated.some((e) => e.includes("HOLIDAY_TOMORROW"))).toBe(true);

    const holidayAnnouncement = await Announcement.findOne({
      templateKey: "HOLIDAY_TOMORROW",
    });
    expect(holidayAnnouncement).not.toBeNull();
    expect(holidayAnnouncement?.title).toBe("Tomorrow is a holiday: Republic Day");
    expect(holidayAnnouncement?.priority).toBe("HIGH");
    expect(holidayAnnouncement?.source).toBe("auto");
    expect(holidayAnnouncement?.body).toContain(tomorrowDateKey);
  });

  // =========================================================================
  // 8. Meeting Trigger using CalendarService
  // =========================================================================
  it("automatically generates 'Today: {meeting} at {time}' using CalendarService", async () => {
    const now = new Date();
    const todayDateKey = now.toISOString().split("T")[0];

    // Seed meeting today at 3:30 PM (15:30)
    await calendarService.createEvent(
      {
        title: "Product Roadmap Review",
        type: "meeting",
        startDate: `${todayDateKey}T15:30:00.000Z`,
        endDate: `${todayDateKey}T16:30:00.000Z`,
        location: "Boardroom 3 & Google Meet",
        isFullDay: false,
      },
      { userId: adminUserId }
    );

    // Run scheduled evaluation
    const jobResult = await announcementService.runScheduledJob(now);
    expect(jobResult.evaluated.some((e) => e.includes("MEETING_TODAY"))).toBe(true);

    const meetingAnnouncement = await Announcement.findOne({
      templateKey: "MEETING_TODAY",
    });
    expect(meetingAnnouncement).not.toBeNull();
    expect(meetingAnnouncement?.title).toContain("Today: Product Roadmap Review at");
    expect(meetingAnnouncement?.body).toContain("Boardroom 3 & Google Meet");
    expect(meetingAnnouncement?.source).toBe("auto");
  });

  // =========================================================================
  // 9. Office Closed Trigger
  // =========================================================================
  it("automatically generates 'Office closed on {date}' for company off-days", async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateKey = tomorrow.toISOString().split("T")[0];

    await calendarService.createEvent(
      {
        title: "Annual Electrical Grid Maintenance",
        type: "companyOffDay",
        startDate: `${tomorrowDateKey}T00:00:00.000Z`,
        endDate: `${tomorrowDateKey}T23:59:59.999Z`,
      },
      { userId: adminUserId }
    );

    await announcementService.runScheduledJob(now);

    const closedAnnouncement = await Announcement.findOne({
      templateKey: "OFFICE_CLOSED",
    });
    expect(closedAnnouncement).not.toBeNull();
    expect(closedAnnouncement?.title).toBe(`Office closed on ${tomorrowDateKey}`);
    expect(closedAnnouncement?.body).toContain("Annual Electrical Grid Maintenance");
  });

  // =========================================================================
  // 10. Policy Updated & Leave/WFH Reminder Hooks
  // =========================================================================
  it("automatically generates announcements on policy updated and leave/WFH reminder hooks", async () => {
    // 1. Policy update hook
    await announcementService.onPolicyUpdatedHook({
      name: "Corporate Standard Policy",
      version: 4,
    });

    const policyAnn = await Announcement.findOne({ templateKey: "POLICY_UPDATED" });
    expect(policyAnn).not.toBeNull();
    expect(policyAnn?.title).toBe("Policy updated: Corporate Standard Policy");
    expect(policyAnn?.body).toContain("version 4");
    expect(policyAnn?.priority).toBe("HIGH");

    // 2. Leave / WFH reminder hook
    await announcementService.onLeaveWfhReminderHook(
      "End of Month Submission",
      "Kindly submit all pending WFH tickets before Friday 6 PM"
    );

    const reminderAnn = await Announcement.findOne({ templateKey: "LEAVE_WFH_REMINDER" });
    expect(reminderAnn).not.toBeNull();
    expect(reminderAnn?.title).toBe("Leave/WFH reminder: End of Month Submission");
    expect(reminderAnn?.body).toContain("before Friday 6 PM");

    // 3. Update Available hook
    await announcementService.onUpdateAvailableHook("v2.5.0", "New Calendar & Announcements system");
    const updateAnn = await Announcement.findOne({ templateKey: "UPDATE_AVAILABLE" });
    expect(updateAnn).not.toBeNull();
    expect(updateAnn?.title).toBe("Update available: v2.5.0");
    expect(updateAnn?.body).toContain("New Calendar & Announcements system");
  });

  // =========================================================================
  // 11. Templates Editable by HR & Individually Switchable
  // =========================================================================
  it("allows HR to edit templates and respects individual template switch toggles", async () => {
    // 1. List templates via Admin endpoint
    const listRes = await request(app)
      .get("/api/announcements/templates")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(6);

    // 2. Edit template text
    const updateRes = await request(app)
      .put("/api/announcements/templates/HOLIDAY_TOMORROW")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        titleTemplate: "Holiday Notice: Tomorrow is {title}",
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.titleTemplate).toBe("Holiday Notice: Tomorrow is {title}");

    // Test that new auto announcement uses modified template
    const genRes = await announcementService.generateAutoAnnouncement(
      "HOLIDAY_TOMORROW",
      { title: "Gandhi Jayanti", date: "2026-10-02" },
      {},
      "2026-10-02",
      "gandhi"
    );
    expect(genRes?.title).toBe("Holiday Notice: Tomorrow is Gandhi Jayanti");

    // 3. Disable template
    const disableRes = await request(app)
      .put("/api/announcements/templates/MEETING_TODAY")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ isEnabled: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.isEnabled).toBe(false);

    // Attempting to generate disabled template returns null
    const skippedMeeting = await announcementService.generateAutoAnnouncement(
      "MEETING_TODAY",
      { meeting: "Sprint Planning", time: "10:00 AM", location: "Room 101" },
      {},
      "2026-10-02",
      "meeting-1"
    );
    expect(skippedMeeting).toBeNull();
  });

  // =========================================================================
  // 12. High-Priority Notifications Dispatch
  // =========================================================================
  it("creates Notification records for targeted users when a high-priority announcement is created", async () => {
    await announcementService.createManualAnnouncement(
      {
        title: "Urgent Server Outage Maintenance",
        body: "All office services will undergo maintenance tonight.",
        priority: "URGENT",
        audience: { scope: "all", departments: [], roles: [] },
      },
      { userId: adminUserId }
    );

    const notifications = await Notification.find({ type: "ANNOUNCEMENT" });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].title).toContain("[URGENT] Urgent Server Outage Maintenance");
  });

  // =========================================================================
  // 13. Public / Display Kiosk Announcements (Ticker API)
  // =========================================================================
  it("serves active company-wide announcements on GET /api/announcements/public without authentication", async () => {
    // 1. Company-wide active announcement
    await announcementService.createManualAnnouncement(
      {
        title: "Annual Company Retreat",
        body: "All employees please assemble in main courtyard.",
        priority: "HIGH",
        pinned: true,
        audience: { scope: "all", departments: [], roles: [] },
      },
      { userId: adminUserId }
    );

    // 2. Department-specific announcement (should NOT appear on public kiosk)
    await announcementService.createManualAnnouncement(
      {
        title: "Confidential Finance Audit",
        body: "Finance department internal metrics only.",
        priority: "HIGH",
        audience: { scope: "department", departments: ["Finance"], roles: [] },
      },
      { userId: adminUserId }
    );

    // Call public endpoint without Bearer token
    const publicRes = await request(app).get("/api/announcements/public");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.success).toBe(true);
    expect(Array.isArray(publicRes.body.data)).toBe(true);
    expect(publicRes.body.data.length).toBe(1);
    expect(publicRes.body.data[0].title).toBe("Annual Company Retreat");
    expect(publicRes.body.data[0].pinned).toBe(true);
  });
});
