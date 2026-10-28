import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import mongoose, { Types } from "mongoose";
import { app } from "../src/app";
import { User, Employee, AttendanceRecord, AttendancePolicy, WfhRequest, LeaveRequest } from "../src/models";
import { AttendanceStatus, WfhStatus, UserRole, WorkType, addDaysToDateKey } from "@vorldx/shared";
import { analyticsService } from "../src/services/analytics.service";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env";

describe("Live Attendance Analytics Subsystem", { timeout: 60000 }, () => {
  let adminToken: string;
  let adminUserId: Types.ObjectId;
  let policyId: Types.ObjectId;

  const testDateKey = "2026-10-29"; // Thursday

  beforeAll(async () => {
    adminUserId = new Types.ObjectId();
    adminToken = jwt.sign(
      {
        userId: adminUserId.toString(),
        email: "admin@vorldx.demo",
        role: UserRole.ADMIN,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  }, 60000);

  beforeEach(async () => {
    // Wait for DB ready state
    if (mongoose.connection.readyState !== 1) {
      await new Promise<void>((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once("connected", () => resolve());
      });
    }

    // Clear collections
    await User.deleteMany({});
    await Employee.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await WfhRequest.deleteMany({});
    await LeaveRequest.deleteMany({});

    // Create default policy
    const policy = await AttendancePolicy.create({
      name: "Standard Corporate Policy",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      shift: {
        name: "General Shift",
        startTime: "09:00",
        endTime: "18:00",
        graceMinutes: 15,
      },
      workDays: [1, 2, 3, 4, 5],
      holidays: [],
      halfDayRules: {
        firstHalfEnd: "13:30",
        secondHalfStart: "14:30",
      },
      overtimeRules: {
        enabled: false,
        minMinutesForOvertime: 60,
        rateMultiplier: 1.5,
      },
      isDefault: true,
      isActive: true,
    });
    policyId = policy._id;

    // Create admin user
    await User.create({
      _id: adminUserId,
      employeeId: "ADM-001",
      email: "admin@vorldx.demo",
      passwordHash: "hash123",
      role: UserRole.ADMIN,
      status: "ACTIVE",
    });
  }, 60000);

  it("calculates accurate hourly distribution, status split, and department breakdown", async () => {
    // 1. Seed 4 Employees across 2 departments (Engineering, Marketing)
    const emp1 = await Employee.create({
      employeeId: "EMP-001",
      name: "Alice OnTime",
      email: "alice@vorldx.demo",
      department: "Engineering",
      designation: "Frontend Engineer",
      workType: WorkType.OFFICE,
      joiningDate: "2024-01-01",
      isActive: true,
    });

    const emp2 = await Employee.create({
      employeeId: "EMP-002",
      name: "Bob Late",
      email: "bob@vorldx.demo",
      department: "Engineering",
      designation: "Backend Engineer",
      workType: WorkType.OFFICE,
      joiningDate: "2024-01-01",
      isActive: true,
    });

    const emp3 = await Employee.create({
      employeeId: "EMP-003",
      name: "Carol Remote",
      email: "carol@vorldx.demo",
      department: "Marketing",
      designation: "Marketing Specialist",
      workType: WorkType.OFFICE,
      joiningDate: "2024-01-01",
      isActive: true,
    });

    const emp4 = await Employee.create({
      employeeId: "EMP-004",
      name: "David Leave",
      email: "david@vorldx.demo",
      department: "Marketing",
      designation: "Growth Lead",
      workType: WorkType.OFFICE,
      joiningDate: "2024-01-01",
      isActive: true,
    });

    // 2. Seed Today's Records (2026-10-29 in IST +05:30)
    // 09:05 AM IST = 03:35 UTC
    const checkInOnTimeUtc = new Date("2026-10-29T03:35:00.000Z");
    await AttendanceRecord.create({
      employee: emp1._id,
      employeeId: emp1.employeeId,
      department: emp1.department,
      dateKey: testDateKey,
      checkInTime: checkInOnTimeUtc,
      checkOutTime: null,
      status: AttendanceStatus.PRESENT,
      isLate: false,
      lateMinutes: 0,
      isWfh: false,
      policyId,
      terminalId: "TERM-01",
    });

    // 10:15 AM IST = 04:45 UTC (Late arrival)
    const checkInLateUtc = new Date("2026-10-29T04:45:00.000Z");
    await AttendanceRecord.create({
      employee: emp2._id,
      employeeId: emp2.employeeId,
      department: emp2.department,
      dateKey: testDateKey,
      checkInTime: checkInLateUtc,
      checkOutTime: null,
      status: AttendanceStatus.LATE,
      isLate: true,
      lateMinutes: 75,
      isWfh: false,
      policyId,
      terminalId: "TERM-02",
    });

    // Carol is on approved WFH
    await WfhRequest.create({
      employee: emp3._id,
      employeeId: emp3.employeeId,
      department: emp3.department,
      dateKey: testDateKey,
      reason: "Home maintenance",
      status: WfhStatus.APPROVED,
    });
    await AttendanceRecord.create({
      employee: emp3._id,
      employeeId: emp3.employeeId,
      department: emp3.department,
      dateKey: testDateKey,
      checkInTime: null,
      checkOutTime: null,
      status: AttendanceStatus.WFH_APPROVED,
      isLate: false,
      lateMinutes: 0,
      isWfh: true,
      policyId,
    });

    // David is on approved Leave
    const leaveTypeId = new Types.ObjectId();
    await LeaveRequest.create({
      employee: emp4._id,
      employeeId: emp4.employeeId,
      department: emp4.department,
      type: leaveTypeId,
      startDate: new Date("2026-10-29T00:00:00.000Z"),
      endDate: new Date("2026-10-29T23:59:59.999Z"),
      workingDays: 1,
      reason: "Family event",
      status: "APPROVED",
    });
    await AttendanceRecord.create({
      employee: emp4._id,
      employeeId: emp4.employeeId,
      department: emp4.department,
      dateKey: testDateKey,
      checkInTime: null,
      checkOutTime: null,
      status: AttendanceStatus.ON_LEAVE,
      isLate: false,
      lateMinutes: 0,
      isWfh: false,
      policyId,
    });

    // Execute service query
    const analytics = await analyticsService.getLiveAnalytics({
      dateKey: testDateKey,
      simulatedNow: "2026-10-29T11:00:00.000Z",
    });

    // Assert Status Split
    expect(analytics.statusSplit.totalActive).toBe(4);
    expect(analytics.statusSplit.present).toBe(2); // Alice & Bob
    expect(analytics.statusSplit.late).toBe(1); // Bob
    expect(analytics.statusSplit.wfh).toBe(1); // Carol
    expect(analytics.statusSplit.leave).toBe(1); // David
    expect(analytics.statusSplit.absent).toBe(0);
    expect(analytics.statusSplit.notYetCheckedIn).toBe(0);

    // Assert Hourly Distribution for Today (IST timezone)
    // Alice checked in at 09:05 AM IST -> hour 9
    const hour9 = analytics.hourlyToday.find((h) => h.hour === 9);
    expect(hour9).toBeDefined();
    expect(hour9?.checkIns).toBe(1);
    expect(hour9?.onTime).toBe(1);
    expect(hour9?.late).toBe(0);

    // Bob checked in at 10:15 AM IST -> hour 10
    const hour10 = analytics.hourlyToday.find((h) => h.hour === 10);
    expect(hour10).toBeDefined();
    expect(hour10?.checkIns).toBe(1);
    expect(hour10?.onTime).toBe(0);
    expect(hour10?.late).toBe(1);

    // Assert Department Breakdown
    expect(analytics.departmentBreakdown.length).toBe(2);
    const engDept = analytics.departmentBreakdown.find((d) => d.department === "Engineering");
    expect(engDept).toBeDefined();
    expect(engDept?.totalEmployees).toBe(2);
    expect(engDept?.present).toBe(2);
    expect(engDept?.late).toBe(1);
    expect(engDept?.attendanceRate).toBe(100); // 2 / 2
    expect(engDept?.punctualityRate).toBe(50); // 1 on time out of 2 present

    const mktDept = analytics.departmentBreakdown.find((d) => d.department === "Marketing");
    expect(mktDept).toBeDefined();
    expect(mktDept?.totalEmployees).toBe(2);
    expect(mktDept?.wfh).toBe(1);
    expect(mktDept?.leave).toBe(1);
    expect(mktDept?.attendanceRate).toBe(50); // 1 WFH counts towards attendance

    // Assert Live Scan Feed
    expect(analytics.recentScans.length).toBeGreaterThanOrEqual(2);
    const recentEmpIds = analytics.recentScans.map((s) => s.employeeId);
    expect(recentEmpIds).toContain("EMP-001");
    expect(recentEmpIds).toContain("EMP-002");
  });

  it("handles HTTP GET /api/analytics/live endpoint correctly", async () => {
    const res = await request(app)
      .get("/api/analytics/live")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ dateKey: testDateKey });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dateKey).toBe(testDateKey);
    expect(Array.isArray(res.body.hourlyToday)).toBe(true);
    expect(res.body.hourlyToday.length).toBe(24);
    expect(Array.isArray(res.body.heatmap30Days.cells)).toBe(true);
    expect(res.body.heatmap30Days.cells.length).toBe(168); // 7 x 24
  });

  it("performs efficiently with 2,000 seeded attendance records (Benchmark < 500ms)", async () => {
    // 1. Create 70 Employees across 5 departments
    const departments = ["Engineering", "Product", "Sales", "HR", "Operations"];
    const employeeDocs = [];
    for (let i = 1; i <= 70; i++) {
      const dept = departments[i % departments.length];
      employeeDocs.push({
        employeeId: `PERF-EMP-${String(i).padStart(3, "0")}`,
        name: `Performance Employee ${i}`,
        email: `perf${i}@vorldx.demo`,
        department: dept,
        designation: "Specialist",
        workType: WorkType.OFFICE,
        joiningDate: "2023-01-01",
        isActive: true,
      });
    }
    const createdEmployees = await Employee.insertMany(employeeDocs);

    // 2. Create 2,000 Attendance Records spanning the last 30 days
    const attendanceRecordsToInsert = [];
    let count = 0;
    for (let dayOffset = 0; dayOffset < 30 && count < 2000; dayOffset++) {
      const dateKey = addDaysToDateKey(testDateKey, -dayOffset);
      for (const emp of createdEmployees) {
        if (count >= 2000) break;

        // Check-in between 08:00 AM and 11:00 AM IST (02:30 to 05:30 UTC)
        const hourUtc = 2 + (count % 4);
        const minUtc = (count * 7) % 60;
        const checkInTime = new Date(`${dateKey}T0${hourUtc}:${String(minUtc).padStart(2, "0")}:00.000Z`);
        const isLate = hourUtc >= 4; // After 09:30 AM IST

        attendanceRecordsToInsert.push({
          employee: emp._id,
          employeeId: emp.employeeId,
          department: emp.department,
          dateKey,
          checkInTime,
          checkOutTime: new Date(`${dateKey}T12:30:00.000Z`),
          durationMinutes: 480,
          status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
          isLate,
          lateMinutes: isLate ? 30 : 0,
          isWfh: false,
          policyId,
          terminalId: "KIOSK-MAIN-01",
        });
        count++;
      }
    }

    await AttendanceRecord.insertMany(attendanceRecordsToInsert);
    expect(await AttendanceRecord.countDocuments()).toBe(2000);

    // 3. Measure Execution Time
    const startTime = performance.now();
    const analytics = await analyticsService.getLiveAnalytics({
      dateKey: testDateKey,
      simulatedNow: `${testDateKey}T12:00:00.000Z`,
    });
    const durationMs = performance.now() - startTime;

    console.log(`[Performance Benchmark] Processed 2,000 attendance records in ${durationMs.toFixed(2)}ms`);

    // Execution should be well under 500ms (typically 15-60ms)
    expect(durationMs).toBeLessThan(500);
    expect(analytics.heatmap30Days.totalCheckIns).toBe(2000);
    expect(analytics.heatmap30Days.maxCount).toBeGreaterThan(0);
    expect(analytics.departmentBreakdown.length).toBe(5);
  });
});
