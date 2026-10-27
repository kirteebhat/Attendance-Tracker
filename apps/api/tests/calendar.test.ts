import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { calendarService } from "../src/services/calendar.service";
import { CalendarEvent, AttendancePolicy, User, AuditEvent } from "../src/models";
import { UserRole } from "@vorldx/shared";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env";

describe("Calendar Service & Engine", () => {
  let adminToken: string;

  beforeEach(async () => {
    await CalendarEvent.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await AuditEvent.deleteMany({});
    await User.deleteMany({});

    calendarService.invalidateCache();

    // Default company policy: Monday - Friday are workdays (1,2,3,4,5)
    await AttendancePolicy.create({
      name: "Default Standard Policy",
      timezone: "Asia/Kolkata",
      workdays: [1, 2, 3, 4, 5],
      standardWorkHours: 8,
      isDefault: true,
    });

    const adminUser = await User.create({
      employeeId: "ADM-001",
      email: "admin@vorldx.demo",
      passwordHash: "dummy-hash",
      role: UserRole.ADMIN,
      status: "ACTIVE",
    });

    adminToken = jwt.sign(
      {
        userId: adminUser._id.toString(),
        employeeId: adminUser.employeeId,
        email: adminUser.email,
        role: adminUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  describe("Core Day Type & Weekend Evaluation", () => {
    it("correctly identifies Monday to Friday as workdays and Saturday/Sunday as weekly-off", async () => {
      // 2026-10-26 is Monday
      expect(await calendarService.getDayType("2026-10-26")).toBe("workday");
      expect(await calendarService.isWorkingDay("2026-10-26")).toBe(true);

      // 2026-10-27 is Tuesday
      expect(await calendarService.getDayType("2026-10-27")).toBe("workday");

      // 2026-10-30 is Friday
      expect(await calendarService.getDayType("2026-10-30")).toBe("workday");

      // 2026-10-31 is Saturday (weekly-off)
      expect(await calendarService.getDayType("2026-10-31")).toBe("weekly-off");
      expect(await calendarService.isWorkingDay("2026-10-31")).toBe(false);

      // 2026-11-01 is Sunday (weekly-off)
      expect(await calendarService.getDayType("2026-11-01")).toBe("weekly-off");
      expect(await calendarService.isWorkingDay("2026-11-01")).toBe(false);
    });

    it("respects custom shift workdays when specified", async () => {
      // Tuesday (2026-10-27) is normally a workday.
      // If shift only works weekends [0, 6], Tuesday is weekly-off.
      const weekendOnlyShift = [0, 6];
      expect(await calendarService.getDayType("2026-10-27", "Asia/Kolkata", weekendOnlyShift)).toBe("weekly-off");

      // Saturday (2026-10-31) becomes a workday for this shift
      expect(await calendarService.getDayType("2026-10-31", "Asia/Kolkata", weekendOnlyShift)).toBe("workday");
    });
  });

  describe("Holidays and Company Off Days", () => {
    it("identifies official public holidays and overrides workdays", async () => {
      // Wednesday 2026-01-26 (Republic Day)
      await CalendarEvent.create({
        type: "holiday",
        title: "Republic Day",
        startDate: new Date("2026-01-26T00:00:00Z"),
        endDate: new Date("2026-01-26T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      calendarService.invalidateCache();

      expect(await calendarService.getDayType("2026-01-26")).toBe("public-holiday");
      expect(await calendarService.isWorkingDay("2026-01-26")).toBe(false);
    });

    it("identifies company off days and overrides workdays", async () => {
      // Monday 2026-11-02 (Founder's Day Company Off Day)
      await CalendarEvent.create({
        type: "companyOffDay",
        title: "Founder's Celebration Off Day",
        startDate: new Date("2026-11-02T00:00:00Z"),
        endDate: new Date("2026-11-02T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      calendarService.invalidateCache();

      expect(await calendarService.getDayType("2026-11-02")).toBe("company-off-day");
      expect(await calendarService.isWorkingDay("2026-11-02")).toBe(false);
    });
  });

  describe("Range Counting & Next Working Day", () => {
    it("accurately counts working days in a standard week", async () => {
      // 2026-10-26 (Mon) to 2026-11-01 (Sun) = 5 workdays (Mon-Fri) + 2 weekend days
      const count = await calendarService.countWorkingDays("2026-10-26", "2026-11-01");
      expect(count).toBe(5);

      const days = await calendarService.getWorkingDaysInRange("2026-10-26", "2026-11-01");
      expect(days).toEqual([
        "2026-10-26",
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
      ]);
    });

    it("deducts holidays and company off days from working days count", async () => {
      // Add a holiday on Wednesday 2026-10-28
      await CalendarEvent.create({
        type: "holiday",
        title: "Midweek Holiday",
        startDate: new Date("2026-10-28T00:00:00Z"),
        endDate: new Date("2026-10-28T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      // Add a company off day on Thursday 2026-10-29
      await CalendarEvent.create({
        type: "companyOffDay",
        title: "Special Off Day",
        startDate: new Date("2026-10-29T00:00:00Z"),
        endDate: new Date("2026-10-29T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      calendarService.invalidateCache();

      // Mon to Sun: 5 standard workdays - 1 holiday - 1 company off day = 3 working days (Mon, Tue, Fri)
      const count = await calendarService.countWorkingDays("2026-10-26", "2026-11-01");
      expect(count).toBe(3);

      const days = await calendarService.getWorkingDaysInRange("2026-10-26", "2026-11-01");
      expect(days).toEqual(["2026-10-26", "2026-10-27", "2026-10-30"]);
    });

    it("returns 0 if start date is after end date", async () => {
      const count = await calendarService.countWorkingDays("2026-11-05", "2026-11-01");
      expect(count).toBe(0);
    });

    it("finds the next working day skipping weekends and holidays", async () => {
      // Friday 2026-10-30 -> next day is Saturday (off), Sunday (off), next workday is Monday 2026-11-02
      const nextDay = await calendarService.nextWorkingDay("2026-10-30");
      expect(calendarService.toDateKey(nextDay)).toBe("2026-11-02");

      // Now add a holiday on Monday 2026-11-02
      await CalendarEvent.create({
        type: "holiday",
        title: "Monday Holiday",
        startDate: new Date("2026-11-02T00:00:00Z"),
        endDate: new Date("2026-11-02T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });
      calendarService.invalidateCache();

      // Next workday after Friday should now jump to Tuesday 2026-11-03
      const nextDayAfterHoliday = await calendarService.nextWorkingDay("2026-10-30");
      expect(calendarService.toDateKey(nextDayAfterHoliday)).toBe("2026-11-03");
    });
  });

  describe("Leap Year and Year Boundary Safety", () => {
    it("handles leap year (Feb 29) seamlessly", async () => {
      // 2024 is a leap year.
      // 2024-02-28 (Wednesday = workday)
      // 2024-02-29 (Thursday = workday)
      // 2024-03-01 (Friday = workday)
      // 2024-03-02 (Saturday = weekend)
      // 2024-03-03 (Sunday = weekend)
      const count = await calendarService.countWorkingDays("2024-02-28", "2024-03-03");
      // Wed 28th, Thu 29th, Fri 1st = 3 working days
      expect(count).toBe(3);

      const days = await calendarService.getWorkingDaysInRange("2024-02-28", "2024-03-03");
      expect(days).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);

      // Next working day after Feb 28 2024 is Feb 29 2024
      const next = await calendarService.nextWorkingDay("2024-02-28");
      expect(calendarService.toDateKey(next)).toBe("2024-02-29");
    });

    it("handles year boundaries seamlessly across Dec 31 to Jan 5", async () => {
      // 2025-12-31 (Wednesday = workday)
      // 2026-01-01 (Thursday = holiday)
      // 2026-01-02 (Friday = workday)
      // 2026-01-03 (Saturday = weekend)
      // 2026-01-04 (Sunday = weekend)
      // 2026-01-05 (Monday = workday)
      await CalendarEvent.create({
        type: "holiday",
        title: "New Year's Day",
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2026-01-01T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      calendarService.invalidateCache();

      const count = await calendarService.countWorkingDays("2025-12-31", "2026-01-05");
      // Dec 31 (Wed: 1), Jan 1 (Holiday: 0), Jan 2 (Fri: 1), Jan 3 (Sat: 0), Jan 4 (Sun: 0), Jan 5 (Mon: 1) = 3
      expect(count).toBe(3);

      const days = await calendarService.getWorkingDaysInRange("2025-12-31", "2026-01-05");
      expect(days).toEqual(["2025-12-31", "2026-01-02", "2026-01-05"]);

      // Next working day after Dec 31 with Jan 1 being holiday is Jan 2
      const next = await calendarService.nextWorkingDay("2025-12-31");
      expect(calendarService.toDateKey(next)).toBe("2026-01-02");
    });
  });

  describe("Holiday Import & Safe Merge", () => {
    it("previews holidays and never overwrites manual entries", async () => {
      // 1. Manually create custom holiday on Republic Day (2026-01-26) with custom title
      await CalendarEvent.create({
        type: "holiday",
        title: "Custom Company Republic Day Gala",
        description: "Special internal celebration",
        startDate: new Date("2026-01-26T00:00:00Z"),
        endDate: new Date("2026-01-26T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      // 2. Preview import for 2026
      const preview = await calendarService.previewImportHolidays(2026, "IN");
      expect(preview.totalFound).toBeGreaterThan(5);
      expect(preview.manualConflictCount).toBe(1);

      const conflictedItem = preview.items.find((i) => i.date === "2026-01-26");
      expect(conflictedItem).toBeDefined();
      expect(conflictedItem!.action).toBe("skip_manual_conflict");
      expect(conflictedItem!.existingEvent?.title).toBe("Custom Company Republic Day Gala");

      // 3. Execute import
      const result = await calendarService.importHolidays(2026, "IN");
      expect(result.skippedManualCount).toBe(1);
      expect(result.importedCount).toBe(preview.totalFound - 1);

      // 4. Verify manual event was PRESERVED unchanged
      const jan26Events = await CalendarEvent.find({
        startDate: { $gte: new Date("2026-01-26T00:00:00Z"), $lte: new Date("2026-01-26T23:59:59Z") },
      });
      expect(jan26Events.length).toBe(1);
      expect(jan26Events[0].title).toBe("Custom Company Republic Day Gala");
      expect(jan26Events[0].source).toBe("manual");

      // 5. Verify newly imported events have source='imported'
      const importedIndependenceDay = await CalendarEvent.findOne({
        startDate: { $gte: new Date("2026-08-15T00:00:00Z"), $lte: new Date("2026-08-15T23:59:59Z") },
      });
      expect(importedIndependenceDay).not.toBeNull();
      expect(importedIndependenceDay!.source).toBe("imported");
    });
  });

  describe("Calendar HTTP API Endpoints", () => {
    it("GET /api/calendar/day-type returns accurate status", async () => {
      const res = await request(app).get("/api/calendar/day-type?date=2026-10-31");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dayType).toBe("weekly-off");
      expect(res.body.isWorkday).toBe(false);
    });

    it("GET /api/calendar/working-days returns accurate count and list", async () => {
      const res = await request(app).get("/api/calendar/working-days?start=2026-10-26&end=2026-10-30");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.workingDaysCount).toBe(5);
      expect(res.body.workingDays.length).toBe(5);
    });

    it("POST /api/calendar/events creates event with audit log and emits event", async () => {
      const res = await request(app)
        .post("/api/calendar/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          type: "meeting",
          title: "All-Hands Quarterly Planning",
          startDate: "2026-11-15T10:00:00.000Z",
          endDate: "2026-11-15T12:00:00.000Z",
          isFullDay: false,
          location: "Main Boardroom & Zoom",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("All-Hands Quarterly Planning");

      // Verify Audit Log was recorded
      const auditLog = await AuditEvent.findOne({
        action: "CREATE_CALENDAR_EVENT",
        entityId: res.body.data._id,
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog!.entityType).toBe("CALENDAR");
    });

    it("GET /api/calendar/export.ics returns valid RFC 5545 iCalendar stream", async () => {
      await CalendarEvent.create({
        type: "holiday",
        title: "Diwali Corporate Holiday",
        description: "Festival of Lights",
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-01T23:59:59Z"),
        isFullDay: true,
        source: "manual",
      });

      const res = await request(app).get("/api/calendar/export.ics?year=2026");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/calendar");
      expect(res.text).toContain("BEGIN:VCALENDAR");
      expect(res.text).toContain("VERSION:2.0");
      expect(res.text).toContain("SUMMARY:Diwali Corporate Holiday");
      expect(res.text).toContain("END:VCALENDAR");
    });
  });
});

