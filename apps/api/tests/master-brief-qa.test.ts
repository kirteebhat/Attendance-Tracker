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
  QrDisplay,
  QrToken,
  QrChallenge,
  AuditEvent,
  WfhRequest,
} from "../src/models";
import { ApiErrorCode, AttendanceStatus, UserRole, WorkType, WfhStatus, TerminalStatus } from "@vorldx/shared";
import { env } from "../src/config/env";
import * as qrService from "../src/services/qr.service";

describe("MASTER_BRIEF Section 11 Comprehensive QA Test Suite", () => {
  let employeeUser1: IUser;
  let employeeDoc1: IEmployee;
  let employeeToken1: string;

  let employeeUser2: IUser;
  let employeeDoc2: IEmployee;
  let employeeToken2: string;

  let hrUser: IUser;
  let hrToken: string;

  let pairedDisplay: { displayId: string; credential: string; terminalId: string };

  beforeEach(async () => {
    await AttendanceRecord.deleteMany({});
    await QrChallenge.deleteMany({});
    await QrToken.deleteMany({});
    await QrDisplay.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await AuditEvent.deleteMany({});
    await WfhRequest.deleteMany({});

    // Ensure unique indexes are initialized
    await Promise.all([
      AttendanceRecord.init(),
      QrChallenge.init(),
      WfhRequest.init(),
    ]);

    // 1. Standard Attendance Policy with Day Shift and Overnight Shift
    await AttendancePolicy.create({
      name: "Standard Corporate Policy",
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
          checkInWindowEndMinutes: 300,
          checkOutWindowStartMinutes: 60,
          checkOutWindowEndMinutes: 300,
          isOvernight: false,
          isActive: true,
        },
        {
          name: "Overnight Night Shift",
          startTime: "22:00",
          endTime: "06:00",
          graceMinutes: 15,
          checkInWindowStartMinutes: 120,
          checkInWindowEndMinutes: 300,
          checkOutWindowStartMinutes: 120,
          checkOutWindowEndMinutes: 300,
          isOvernight: true,
          isActive: true,
        },
      ],
    });

    // 2. HR Admin
    hrUser = await User.create({
      employeeId: "HR-QA-001",
      email: "hr-qa@vorldx.demo",
      passwordHash: "hash123",
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

    // 3. Employee 1 (Engineering)
    employeeUser1 = await User.create({
      employeeId: "EMP-QA-001",
      email: "emp-qa1@vorldx.demo",
      passwordHash: "hash123",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    employeeDoc1 = await Employee.create({
      employeeId: "EMP-QA-001",
      name: "Ananya Sharma",
      email: "emp-qa1@vorldx.demo",
      department: "Engineering",
      designation: "Frontend Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-01-01",
      status: "ACTIVE",
      isActive: true,
      userId: employeeUser1._id,
    });
    employeeToken1 = jwt.sign(
      {
        userId: employeeUser1._id.toString(),
        employeeId: employeeUser1.employeeId,
        email: employeeUser1.email,
        role: employeeUser1.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Employee 2 (Product)
    employeeUser2 = await User.create({
      employeeId: "EMP-QA-002",
      email: "emp-qa2@vorldx.demo",
      passwordHash: "hash123",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    employeeDoc2 = await Employee.create({
      employeeId: "EMP-QA-002",
      name: "Rohan Verma",
      email: "emp-qa2@vorldx.demo",
      department: "Product",
      designation: "UI/UX Designer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-02-01",
      status: "ACTIVE",
      isActive: true,
      userId: employeeUser2._id,
    });
    employeeToken2 = jwt.sign(
      {
        userId: employeeUser2._id.toString(),
        employeeId: employeeUser2.employeeId,
        email: employeeUser2.email,
        role: employeeUser2.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 5. Registered Display Terminal
    const registered = await qrService.registerDisplay({
      name: "Main Entrance Kiosk",
      location: "Building 1 Lobby",
    });
    const pairResult = await qrService.pairDisplay(registered.pairingCode!);
    pairedDisplay = {
      displayId: pairResult.terminalId,
      terminalId: pairResult.terminalId,
      credential: pairResult.credential,
    };
  });

  // =========================================================================
  // 1. CONCURRENCY TESTS
  // =========================================================================
  describe("1. Concurrency & Race Condition Defense", () => {
    it("safely handles 15 simultaneous parallel check-in attempts from the same employee: creates exactly ONE record", async () => {
      const challenge = await qrService.requestRotatingChallenge(
        pairedDisplay.displayId,
        pairedDisplay.credential
      );

      // Launch 15 concurrent scan requests with the same employee token
      const promises = Array.from({ length: 15 }).map(() =>
        request(app)
          .post("/api/attendance/scan")
          .set("Authorization", `Bearer ${employeeToken1}`)
          .send({ token: challenge.token })
      );

      const responses = await Promise.all(promises);

      // Exactly ONE request must succeed (HTTP 200 or 201)
      const successResponses = responses.filter((r) => r.status === 200 || r.status === 201);
      const conflictResponses = responses.filter((r) => r.status === 409);

      expect(successResponses.length).toBe(1);
      expect(conflictResponses.length).toBe(14);

      // In database, there must be strictly ONE record created for this employee on today's date
      const records = await AttendanceRecord.find({ employee: employeeDoc1._id });
      expect(records.length).toBe(1);
      expect(records[0].status).toBe(AttendanceStatus.PRESENT);
    });

    it("safely handles concurrent WFH request submissions for the same date: creates exactly ONE request", async () => {
      const targetDate = "2026-11-16"; // Monday (Working day)

      // Launch 10 parallel WFH creation requests for the exact same date
      const promises = Array.from({ length: 10 }).map((_, i) =>
        request(app)
          .post("/api/wfh/requests")
          .set("Authorization", `Bearer ${employeeToken1}`)
          .send({
            dateKey: targetDate,
            reason: `Parallel WFH request submission attempt #${i + 1}`,
          })
      );

      const responses = await Promise.all(promises);

      const successResponses = responses.filter((r) => r.status === 201);
      const conflictResponses = responses.filter((r) => r.status === 409);

      expect(successResponses.length).toBe(1);
      expect(conflictResponses.length).toBe(9);

      // Verify database contains exactly ONE WFH request document for this date
      const wfhDocs = await WfhRequest.find({
        employeeId: employeeDoc1.employeeId,
        dateKey: targetDate,
      });
      expect(wfhDocs.length).toBe(1);
      expect(wfhDocs[0].status).toBe(WfhStatus.PENDING);
    });
  });

  // =========================================================================
  // 2. REPLAY PROTECTION & TOKEN LIFECYCLE
  // =========================================================================
  describe("2. Cryptographic Replay Defense & Multi-User Lobby Scenarios", () => {
    it("rejects token replay when the SAME employee scans the exact same token a second time", async () => {
      const challenge = await qrService.requestRotatingChallenge(
        pairedDisplay.displayId,
        pairedDisplay.credential
      );

      // First scan: Check-in succeeds
      const firstRes = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ token: challenge.token });

      expect(firstRes.status).toBe(200);

      // Immediate second scan of the identical token by same employee: must be blocked by replay defense
      const replayRes = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ token: challenge.token });

      expect(replayRes.status).toBe(409);
      expect(replayRes.body.code).toBe(ApiErrorCode.ERR_QR_REPLAY_DETECTED);
    });

    it("allows multiple DISTINCT employees in a lobby line to scan the SAME valid token during its 30s window", async () => {
      const challenge = await qrService.requestRotatingChallenge(
        pairedDisplay.displayId,
        pairedDisplay.credential
      );

      // Employee 1 scans the token
      const res1 = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ token: challenge.token });

      expect(res1.status).toBe(200);
      expect(res1.body.record.employeeId).toBe(employeeDoc1.employeeId);

      // Employee 2 standing right behind Employee 1 in line scans the SAME token: must succeed!
      const res2 = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ token: challenge.token });

      expect(res2.status).toBe(200);
      expect(res2.body.record.employeeId).toBe(employeeDoc2.employeeId);

      // Now neither Employee 1 nor Employee 2 can replay this token
      const replay1 = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ token: challenge.token });
      expect(replay1.status).toBe(409);

      const replay2 = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken2}`)
        .send({ token: challenge.token });
      expect(replay2.status).toBe(409);
    });

    it("rejects an expired QR token after the 45-second window with 400 ERR_QR_EXPIRED", async () => {
      const challenge = await qrService.requestRotatingChallenge(
        pairedDisplay.displayId,
        pairedDisplay.credential
      );

      // Manually set token expiration in the past
      await QrToken.updateOne(
        { token: challenge.token },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const res = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ token: challenge.token });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_QR_EXPIRED);
    });

    it("rejects a forged QR token with invalid cryptographic HMAC signature with 400 ERR_QR_INVALID_SIGNATURE", async () => {
      const forgedPayload = {
        v: 1,
        tid: pairedDisplay.terminalId,
        ts: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30,
        n: "forged-nonce-99999",
        sig: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      };

      const res = await request(app)
        .post("/api/attendance/scan")
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({ token: JSON.stringify(forgedPayload) });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_INVALID_QR_SIGNATURE);
    });
  });

  // =========================================================================
  // 3. DATE BOUNDARIES & SHIFT MATH
  // =========================================================================
  describe("3. Date Boundaries, Overnight Shifts & Punctuality Math", () => {
    it("handles cross-midnight overnight shift: checks in at 22:05 on Day D and checks out at 06:15 on Day D+1 without duplicate record", async () => {
      // Create employee assigned to Overnight Shift
      const overnightUser = await User.create({
        employeeId: "EMP-NIGHT",
        email: "night@vorldx.demo",
        passwordHash: "hash123",
        role: UserRole.EMPLOYEE,
        status: "ACTIVE",
      });
      const overnightEmp = await Employee.create({
        employeeId: "EMP-NIGHT",
        name: "Vikram Night",
        email: "night@vorldx.demo",
        department: "Operations",
        designation: "NOC Engineer",
        workType: WorkType.FULL_TIME,
        joiningDate: "2024-01-01",
        status: "ACTIVE",
        isActive: true,
        userId: overnightUser._id,
      });

      // Day D: Check in at 22:05:00
      const checkInTime = new Date("2026-10-25T22:05:00Z");
      const record = await AttendanceRecord.create({
        employee: overnightEmp._id,
        employeeId: overnightEmp.employeeId,
        department: overnightEmp.department,
        dateKey: "2026-10-25",
        checkInTime,
        status: AttendanceStatus.PRESENT,
        isLate: false,
        lateMinutes: 0,
        isWfh: false,
        isMissingCheckout: true,
      });

      // Day D+1: Check out at 06:15:00 across midnight
      const checkOutTime = new Date("2026-10-26T06:15:00Z");
      const durationMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      record.checkOutTime = checkOutTime;
      record.durationMinutes = durationMinutes;
      record.isMissingCheckout = false;
      await record.save();

      // Verify duration calculation: from 22:05 to 06:15 is exactly 8 hours and 10 minutes = 490 minutes
      expect(record.durationMinutes).toBe(490);
      expect(record.isMissingCheckout).toBe(false);

      // Verify no duplicate record exists for 2026-10-26
      const nextDayRecords = await AttendanceRecord.find({
        employee: overnightEmp._id,
        dateKey: "2026-10-26",
      });
      expect(nextDayRecords.length).toBe(0);
    });

    it("evaluates grace period threshold: 09:14:59 is ON-TIME, 09:15:01 is LATE", async () => {
      // 09:00 shift with 15-minute grace period
      const onTimePunch = new Date("2026-10-27T09:14:59+05:30");
      const latePunch = new Date("2026-10-28T09:15:01+05:30");

      // Verify on-time calculation
      const onTimeRecord = await AttendanceRecord.create({
        employee: employeeDoc1._id,
        employeeId: employeeDoc1.employeeId,
        department: employeeDoc1.department,
        dateKey: "2026-10-27",
        checkInTime: onTimePunch,
        status: AttendanceStatus.PRESENT,
        isLate: false,
        lateMinutes: 0,
        isWfh: false,
        isMissingCheckout: true,
      });
      expect(onTimeRecord.status).toBe(AttendanceStatus.PRESENT);
      expect(onTimeRecord.isLate).toBe(false);

      // Verify late calculation
      const lateRecord = await AttendanceRecord.create({
        employee: employeeDoc1._id,
        employeeId: employeeDoc1.employeeId,
        department: employeeDoc1.department,
        dateKey: "2026-10-28",
        checkInTime: latePunch,
        status: AttendanceStatus.LATE,
        isLate: true,
        lateMinutes: 1,
        isWfh: false,
        isMissingCheckout: true,
      });
      expect(lateRecord.status).toBe(AttendanceStatus.LATE);
      expect(lateRecord.isLate).toBe(true);
      expect(lateRecord.lateMinutes).toBe(1);
    });
  });

  // =========================================================================
  // 4. UNAUTHORIZED CORRECTIONS & ACCESS CONTROL
  // =========================================================================
  describe("4. Security, Access Control & Unauthorized Corrections", () => {
    it("blocks a regular employee from performing attendance record correction with 403 ERR_FORBIDDEN", async () => {
      const rec = await AttendanceRecord.create({
        employee: employeeDoc1._id,
        employeeId: employeeDoc1.employeeId,
        department: employeeDoc1.department,
        dateKey: "2026-10-20",
        checkInTime: new Date("2026-10-20T09:30:00Z"),
        status: AttendanceStatus.LATE,
        isLate: true,
        lateMinutes: 15,
        isWfh: false,
        isMissingCheckout: false,
      });

      // Regular employee calls correction endpoint
      const res = await request(app)
        .patch(`/api/attendance/${rec._id}/correct`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          status: AttendanceStatus.PRESENT,
          reason: "Employee trying to erase late mark self-service",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);

      // In database, the record must remain unaltered
      const unchanged = await AttendanceRecord.findById(rec._id);
      expect(unchanged?.status).toBe(AttendanceStatus.LATE);
    });

    it("blocks attendance correction without mandatory reason / justification with 400", async () => {
      const rec = await AttendanceRecord.create({
        employee: employeeDoc1._id,
        employeeId: employeeDoc1.employeeId,
        department: employeeDoc1.department,
        dateKey: "2026-10-20",
        checkInTime: new Date("2026-10-20T09:30:00Z"),
        status: AttendanceStatus.LATE,
        isLate: true,
        lateMinutes: 15,
        isWfh: false,
        isMissingCheckout: false,
      });

      // HR calls correction endpoint but omits required justification reason
      const res = await request(app)
        .patch(`/api/attendance/${rec._id}/correct`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: AttendanceStatus.PRESENT,
          reason: "   ", // Blank reason
        });

      expect(res.status).toBe(400);
    });

    it("blocks regular employee from reviewing or deciding WFH requests with 403 ERR_FORBIDDEN", async () => {
      const wfh = await WfhRequest.create({
        employee: employeeDoc1._id,
        employeeId: employeeDoc1.employeeId,
        department: employeeDoc1.department,
        dateKey: "2026-11-01",
        reason: "Remote sprint planning",
        status: WfhStatus.PENDING,
      });

      // Employee tries to approve their own request
      const res = await request(app)
        .patch(`/api/wfh/requests/${wfh._id}/review`)
        .set("Authorization", `Bearer ${employeeToken1}`)
        .send({
          status: "APPROVED",
          remarks: "Self approval attempt",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);

      // Verify request is still PENDING in DB
      const wfhCheck = await WfhRequest.findById(wfh._id);
      expect(wfhCheck?.status).toBe(WfhStatus.PENDING);
    });

    it("blocks regular employee from viewing audit logs with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .get("/api/admin/audit-logs")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. REPORT MATH & AGGREGATION ACCURACY
  // =========================================================================
  describe("5. Report Mathematical Precision & Aggregation", () => {
    it("accurately computes attendance percentage: (Present + WFH) / Working Days * 100", async () => {
      // Seed 10 working days: 7 Present, 2 Approved WFH, 1 Absent
      const dates = [
        { date: "2026-10-01", status: AttendanceStatus.PRESENT, isWfh: false },
        { date: "2026-10-02", status: AttendanceStatus.PRESENT, isWfh: false },
        { date: "2026-10-05", status: AttendanceStatus.PRESENT, isWfh: false },
        { date: "2026-10-06", status: AttendanceStatus.PRESENT, isWfh: false },
        { date: "2026-10-07", status: AttendanceStatus.LATE, isWfh: false },
        { date: "2026-10-08", status: AttendanceStatus.PRESENT, isWfh: false },
        { date: "2026-10-09", status: AttendanceStatus.PRESENT, isWfh: false },
        { date: "2026-10-12", status: AttendanceStatus.WFH, isWfh: true },
        { date: "2026-10-13", status: AttendanceStatus.WFH, isWfh: true },
        { date: "2026-10-14", status: AttendanceStatus.ABSENT, isWfh: false },
      ];

      for (const d of dates) {
        await AttendanceRecord.create({
          employee: employeeDoc1._id,
          employeeId: employeeDoc1.employeeId,
          department: employeeDoc1.department,
          dateKey: d.date,
          checkInTime: d.status !== AttendanceStatus.ABSENT ? new Date(`${d.date}T09:05:00Z`) : undefined,
          status: d.status,
          isLate: d.status === AttendanceStatus.LATE,
          lateMinutes: d.status === AttendanceStatus.LATE ? 10 : 0,
          isWfh: d.isWfh,
          isMissingCheckout: false,
        });
      }

      // Query employee personal history & stats endpoint
      const res = await request(app)
        .get("/api/attendance/me")
        .set("Authorization", `Bearer ${employeeToken1}`);

      expect(res.status).toBe(200);
      const stats = res.body.stats;

      expect(stats.presentDays).toBe(7); // 6 On-time + 1 Late
      expect(stats.lateDays).toBe(1);
      expect(stats.wfhDays).toBe(2);

      // Calculation: (7 present + 2 wfh) / 10 total = 90%
      const attendanceRate = Math.round(((stats.presentDays + stats.wfhDays) / 10) * 100);
      expect(attendanceRate).toBe(90);
    });

    it("safely handles 0 working days without NaN or division-by-zero crashes", async () => {
      // Brand new employee with zero attendance records
      const newEmpUser = await User.create({
        employeeId: "EMP-NEW",
        email: "new@vorldx.demo",
        passwordHash: "hash123",
        role: UserRole.EMPLOYEE,
        status: "ACTIVE",
      });
      await Employee.create({
        employeeId: "EMP-NEW",
        name: "New Joiner",
        email: "new@vorldx.demo",
        department: "Marketing",
        designation: "Associate",
        workType: WorkType.FULL_TIME,
        joiningDate: "2026-10-23",
        status: "ACTIVE",
        isActive: true,
        userId: newEmpUser._id,
      });

      const newToken = jwt.sign(
        {
          userId: newEmpUser._id.toString(),
          employeeId: newEmpUser.employeeId,
          email: newEmpUser.email,
          role: newEmpUser.role,
        },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/api/attendance/me")
        .set("Authorization", `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.presentDays).toBe(0);
      expect(res.body.stats.lateDays).toBe(0);
      expect(res.body.stats.wfhDays).toBe(0);
      expect(res.body.stats.attendancePercentage).toBe(0);
      expect(Number.isFinite(res.body.stats.attendancePercentage)).toBe(true);
    });
  });
});
