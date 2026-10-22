import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import {
  Employee,
  IEmployee,
  User,
  IUser,
  AttendanceRecord,
  AttendancePolicy,
  Holiday,
  WfhRequest,
  AuditEvent,
} from "../src/models";
import { ApiErrorCode, AttendanceStatus, UserRole, WorkType, WfhStatus } from "@vorldx/shared";
import { env } from "../src/config/env";

describe("HR Attendance Management, Corrections & Automated Absence Job", () => {
  let employeeUser: IUser;
  let employeeDoc: IEmployee;
  let employeeToken: string;

  let secondEmployeeDoc: IEmployee;

  let hrUser: IUser;
  let hrToken: string;

  let adminUser: IUser;
  let adminToken: string;

  beforeEach(async () => {
    await AttendanceRecord.deleteMany({});
    await Holiday.deleteMany({});
    await WfhRequest.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await AuditEvent.deleteMany({});

    // 1. Create Default Attendance Policy with 20:00 cutoff and Mon-Fri workdays
    await AttendancePolicy.create({
      name: "Standard Corporate Policy",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      absenceEvaluationCutoffTime: "20:00",
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

    // 2. Create Active Full-Time Employee 1
    employeeDoc = await Employee.create({
      employeeId: "EMP-1001",
      name: "Rohan Verma",
      email: "rohan.verma@vorldx.demo",
      department: "Engineering",
      designation: "Software Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-01-15",
      isActive: true,
    });

    employeeUser = await User.create({
      employeeId: employeeDoc.employeeId,
      email: employeeDoc.email,
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    employeeDoc.userId = employeeUser._id;
    await employeeDoc.save();

    employeeToken = jwt.sign(
      {
        userId: employeeUser._id.toString(),
        employeeId: employeeUser.employeeId,
        email: employeeUser.email,
        role: employeeUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. Create Active Full-Time Employee 2
    secondEmployeeDoc = await Employee.create({
      employeeId: "EMP-1002",
      name: "Kavita Rao",
      email: "kavita.rao@vorldx.demo",
      department: "Marketing",
      designation: "Marketing Lead",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-02-01",
      isActive: true,
    });

    // 4. Create HR User
    hrUser = await User.create({
      employeeId: "HR-9001",
      email: "hr.manager@vorldx.demo",
      passwordHash: "dummyHash",
      role: UserRole.HR,
      status: "ACTIVE",
    });

    hrToken = jwt.sign(
      {
        userId: hrUser._id.toString(),
        employeeId: hrUser.employeeId,
        email: hrUser.email,
        role: hrUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 5. Create Admin User
    adminUser = await User.create({
      employeeId: "ADM-9001",
      email: "admin.super@vorldx.demo",
      passwordHash: "dummyHash",
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

  describe("GET /attendance (Ledger with Filters, Search & Pagination)", () => {
    beforeEach(async () => {
      // Seed several attendance records
      await AttendanceRecord.create([
        {
          employee: employeeDoc._id,
          employeeId: employeeDoc.employeeId,
          department: "Engineering",
          dateKey: "2026-10-15",
          checkInTime: new Date("2026-10-15T03:30:00Z"),
          checkOutTime: new Date("2026-10-15T12:00:00Z"),
          durationMinutes: 510,
          status: AttendanceStatus.CHECKED_OUT,
          isLate: false,
        },
        {
          employee: employeeDoc._id,
          employeeId: employeeDoc.employeeId,
          department: "Engineering",
          dateKey: "2026-10-16",
          checkInTime: new Date("2026-10-16T04:15:00Z"),
          checkOutTime: new Date("2026-10-16T12:15:00Z"),
          durationMinutes: 480,
          status: AttendanceStatus.CHECKED_OUT,
          isLate: true,
          lateMinutes: 45,
        },
        {
          employee: secondEmployeeDoc._id,
          employeeId: secondEmployeeDoc.employeeId,
          department: "Marketing",
          dateKey: "2026-10-16",
          checkInTime: null,
          checkOutTime: null,
          durationMinutes: 0,
          status: AttendanceStatus.ABSENT,
          isLate: false,
        },
      ]);
    });

    it("allows HR to query all records with pagination and sorting", async () => {
      const res = await request(app)
        .get("/attendance?page=1&limit=10")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.page).toBe(1);
    });

    it("filters records by date range (startDate and endDate)", async () => {
      const res = await request(app)
        .get("/attendance?startDate=2026-10-16&endDate=2026-10-16")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.every((r: { dateKey: string }) => r.dateKey === "2026-10-16")).toBe(
        true
      );
    });

    it("filters records by department and status", async () => {
      const res = await request(app)
        .get("/attendance?department=Marketing&status=ABSENT")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeId).toBe("EMP-1002");
      expect(res.body.data[0].status).toBe(AttendanceStatus.ABSENT);
    });

    it("searches records by employee name or ID", async () => {
      const res = await request(app)
        .get("/attendance?search=Kavita")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeId).toBe("EMP-1002");
    });

    it("blocks regular employee from accessing GET /attendance with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .get("/attendance")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });
  });

  describe("PATCH /attendance/:id/correct (Administrative Corrections)", () => {
    let targetRecord: IAttendanceRecord;

    beforeEach(async () => {
      targetRecord = await AttendanceRecord.create({
        employee: employeeDoc._id,
        employeeId: employeeDoc.employeeId,
        department: employeeDoc.department,
        dateKey: "2026-10-15",
        checkInTime: new Date("2026-10-15T04:30:00Z"), // Late check-in
        checkOutTime: null,
        durationMinutes: 0,
        status: AttendanceStatus.LATE,
        isLate: true,
        lateMinutes: 60,
      });
    });

    it("allows HR to correct checkIn and checkOut, preserves original values, recomputes duration & logs audit", async () => {
      // Correct to On-Time Check-In (09:05 AM IST = 03:35 AM UTC) and Check-Out (06:05 PM IST = 12:35 PM UTC)
      // Duration: 9 hours (540 mins) -> status CHECKED_OUT, isLate: false
      const correctedCheckIn = "2026-10-15T03:35:00.000Z";
      const correctedCheckOut = "2026-10-15T12:35:00.000Z";

      const res = await request(app)
        .patch(`/attendance/${targetRecord._id}/correct`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          checkInTime: correctedCheckIn,
          checkOutTime: correctedCheckOut,
          isLate: false,
          reason: "Employee biometric/QR device malfunctioned at main gate during morning rush",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.record.durationMinutes).toBe(540);
      expect(res.body.record.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(res.body.record.isLate).toBe(false);
      expect(res.body.record.isManuallyCorrected).toBe(true);

      // Verify originalValues preserved
      expect(res.body.record.originalValues).toBeDefined();
      expect(res.body.record.originalValues.status).toBe(AttendanceStatus.LATE);
      expect(res.body.record.originalValues.isLate).toBe(true);

      // Verify corrections history array populated
      expect(res.body.record.corrections).toBeDefined();
      expect(res.body.record.corrections.length).toBe(1);
      expect(res.body.record.corrections[0].correctionReason).toMatch(/malfunctioned/i);
      expect(res.body.record.corrections[0].previousValues.isLate).toBe(true);
      expect(res.body.record.corrections[0].newValues.durationMinutes).toBe(540);

      // Verify AuditEvent recorded
      const audit = await AuditEvent.findOne({
        entityId: targetRecord._id.toString(),
        action: "CORRECTION",
      });
      expect(audit).not.toBeNull();
      expect(audit?.performedBy?.toString()).toBe(hrUser._id.toString());
      expect(audit?.metadata?.actorRole).toBe("HR");
      expect(audit?.reason).toMatch(/malfunctioned/i);
    });

    it("rejects correction when checkOutTime is before or equal to checkInTime", async () => {
      const res = await request(app)
        .patch(`/attendance/${targetRecord._id}/correct`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          checkInTime: "2026-10-15T12:00:00.000Z",
          checkOutTime: "2026-10-15T09:00:00.000Z", // Invalid! Before checkIn
          reason: "Accidental inverted timestamp entry",
        });

      expect(res.status).toBe(400);
    });

    it("rejects correction with missing or too short justification reason", async () => {
      const res = await request(app)
        .patch(`/attendance/${targetRecord._id}/correct`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          checkInTime: "2026-10-15T03:30:00.000Z",
          checkOutTime: "2026-10-15T12:00:00.000Z",
          reason: "fix", // too short (< 5 chars)
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_INVALID_INPUT);
    });

    it("strictly blocks regular employees from modifying attendance records (403 ERR_FORBIDDEN)", async () => {
      const res = await request(app)
        .patch(`/attendance/${targetRecord._id}/correct`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          checkInTime: "2026-10-15T03:30:00.000Z",
          checkOutTime: "2026-10-15T12:00:00.000Z",
          reason: "Self-correcting my own arrival punch",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });
  });

  describe("Scheduled Absence & Incomplete Checkout Evaluation Job", () => {
    it("refuses to mark absentees for today before the policy cutoff time", async () => {
      // Cutoff in policy is 20:00 (8:00 PM IST)
      // simulatedNow is 11:00 AM IST (05:30 UTC) -> Before cutoff!
      const morningTime = new Date("2026-10-21T05:30:00.000Z"); // Wed Oct 21, 2026

      const res = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-21",
          force: false,
          simulatedNow: morningTime.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_CUTOFF_NOT_REACHED);
      expect(res.body.message).toMatch(/before the daily policy cutoff/i);
    });

    it("evaluates past dates or forced demo runs: marks absentees and incomplete checkouts", async () => {
      // Setup:
      // Employee 1: checked in on 2026-10-21 but forgot to checkout
      await AttendanceRecord.create({
        employee: employeeDoc._id,
        employeeId: employeeDoc.employeeId,
        department: employeeDoc.department,
        dateKey: "2026-10-21",
        checkInTime: new Date("2026-10-21T03:30:00Z"),
        checkOutTime: null,
        durationMinutes: 0,
        status: AttendanceStatus.PRESENT,
      });

      // Employee 2: never showed up, no check-in, no WFH request

      // Run evaluation after cutoff (simulatedNow: 21:00 IST = 15:30 UTC)
      const nightTime = new Date("2026-10-21T15:30:00.000Z");

      const res = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-21",
          simulatedNow: nightTime.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.absenteesMarked).toBe(1); // Employee 2 marked absent
      expect(res.body.incompleteMarked).toBe(1); // Employee 1 marked incomplete

      // Verify Employee 1 status updated to INCOMPLETE with isMissingCheckout=true
      const rec1 = await AttendanceRecord.findOne({
        employee: employeeDoc._id,
        dateKey: "2026-10-21",
      });
      expect(rec1?.status).toBe(AttendanceStatus.INCOMPLETE);
      expect(rec1?.isMissingCheckout).toBe(true);

      // Verify Employee 2 marked ABSENT
      const rec2 = await AttendanceRecord.findOne({
        employee: secondEmployeeDoc._id,
        dateKey: "2026-10-21",
      });
      expect(rec2?.status).toBe(AttendanceStatus.ABSENT);
      expect(rec2?.durationMinutes).toBe(0);
    });

    it("excludes company holidays from absentee marking", async () => {
      // Insert official holiday on 2026-10-22
      await Holiday.create({
        name: "Diwali Festivities",
        dateKey: "2026-10-22",
        year: 2026,
        isFloating: false,
      });

      const res = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-22",
          force: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(true);
      expect(res.body.absenteesMarked).toBe(0);
      expect(res.body.message).toMatch(/official company holiday/i);

      // Verify no records created
      const count = await AttendanceRecord.countDocuments({ dateKey: "2026-10-22" });
      expect(count).toBe(0);
    });

    it("excludes non-working weekend days from absentee marking", async () => {
      // 2026-10-25 is Sunday
      const res = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-25",
          force: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(true);
      expect(res.body.absenteesMarked).toBe(0);
      expect(res.body.message).toMatch(/non-working weekend day/i);
    });

    it("excludes employees with approved WFH from being marked absent", async () => {
      // Employee 1 has approved WFH on 2026-10-21
      await WfhRequest.create({
        employee: employeeDoc._id,
        employeeId: employeeDoc.employeeId,
        department: employeeDoc.department,
        dateKey: "2026-10-21",
        reason: "Approved remote day",
        status: WfhStatus.APPROVED,
        reviewedBy: hrUser._id,
        reviewedAt: new Date(),
      });

      // Employee 2 does not have WFH or attendance

      const res = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-21",
          force: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.absenteesMarked).toBe(1); // Only Employee 2 marked absent

      // Verify Employee 1 is NOT marked absent
      const emp1Record = await AttendanceRecord.findOne({
        employee: employeeDoc._id,
        dateKey: "2026-10-21",
      });
      expect(emp1Record).toBeNull(); // No absent record created for WFH employee
    });

    it("guarantees job idempotency: running twice produces identical state with 0 duplicate absentees", async () => {
      // First run: marks Employee 1 & Employee 2 as absent
      const firstRun = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-21",
          force: true,
        });

      expect(firstRun.status).toBe(200);
      expect(firstRun.body.absenteesMarked).toBe(2);

      // Second run on the exact same day
      const secondRun = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          dateKey: "2026-10-21",
          force: true,
        });

      expect(secondRun.status).toBe(200);
      expect(secondRun.body.absenteesMarked).toBe(0); // 0 additional absentees marked!
      expect(secondRun.body.incompleteMarked).toBe(0);

      // Total records in database must still be exactly 2
      const totalRecords = await AttendanceRecord.countDocuments({ dateKey: "2026-10-21" });
      expect(totalRecords).toBe(2);
    });

    it("blocks non-admin users from triggering the manual evaluation job with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .post("/attendance/jobs/evaluate-day")
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          dateKey: "2026-10-21",
          force: true,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });
  });
});
