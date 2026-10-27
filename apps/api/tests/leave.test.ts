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
  LeaveType,
  ILeaveType,
  LeaveBalance,
  LeaveRequest,
  WfhRequest,
  AuditEvent,
  Notification,
} from "../src/models";
import {
  ApiErrorCode,
  AttendanceStatus,
  UserRole,
  WorkType,
  WfhStatus,
} from "@vorldx/shared";
import { env } from "../src/config/env";
import { featureFlagService } from "../src/services/featureFlag.service";
import { evaluateAbsenceAndIncompleteJob } from "../src/services/attendance.service";

describe("Leave Management Subsystem (apps/api)", () => {
  let employeeUser: IUser;
  let employeeDoc: IEmployee;
  let employeeToken: string;

  let hrUser: IUser;
  let hrDoc: IEmployee;
  let hrToken: string;

  let paidLeaveType: ILeaveType;
  let sickLeaveType: ILeaveType;

  // Thursday 2026-11-05 10:00 AM IST
  const simulatedNow = new Date("2026-11-05T04:30:00.000Z");

  beforeEach(async () => {
    // Reset database collections
    await LeaveRequest.deleteMany({});
    await LeaveBalance.deleteMany({});
    await LeaveType.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await WfhRequest.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await AuditEvent.deleteMany({});
    await Notification.deleteMany({});

    const { calendarService } = await import("../src/services/calendar.service");
    calendarService.invalidateCache();

    // Enable leave feature flag by default for tests
    featureFlagService.setInMemoryOverride("leave", true);

    // 1. Create Default Attendance Policy (Mon-Fri workdays)
    await AttendancePolicy.create({
      name: "Default Enterprise Policy",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      isDefault: true,
      workdays: [1, 2, 3, 4, 5], // Monday through Friday
      shifts: [
        {
          name: "General Shift",
          startTime: "09:00",
          endTime: "18:00",
          graceMinutes: 15,
          halfDayThresholdHours: 4,
          isDefault: true,
        },
      ],
    });

    // 2. Create Leave Types
    paidLeaveType = await LeaveType.create({
      name: "Paid Time Off",
      code: "PTO",
      paid: true,
      annualQuota: 12,
      carryForwardRule: { allowed: true, maxDays: 5 },
      halfDayAllowed: true,
      isActive: true,
    });

    sickLeaveType = await LeaveType.create({
      name: "Sick Leave",
      code: "SL",
      paid: true,
      annualQuota: 6,
      carryForwardRule: { allowed: false, maxDays: 0 },
      halfDayAllowed: false, // half-day NOT allowed for SL
      isActive: true,
    });

    // 3. Create Regular Employee User
    employeeUser = await User.create({
      employeeId: "EMP-001",
      email: "alice@vorldx.demo",
      passwordHash: "mock-hash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    employeeDoc = await Employee.create({
      userId: employeeUser._id,
      employeeId: "EMP-001",
      name: "Alice Engineer",
      email: "alice@vorldx.demo",
      department: "Engineering",
      designation: "Software Engineer",
      workType: WorkType.HYBRID,
      joiningDate: "2026-01-01",
      isActive: true,
    });

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

    // 4. Create HR Admin User
    hrUser = await User.create({
      employeeId: "HR-001",
      email: "hr@vorldx.demo",
      passwordHash: "mock-hash",
      role: UserRole.HR,
      status: "ACTIVE",
    });

    hrDoc = await Employee.create({
      userId: hrUser._id,
      employeeId: "HR-001",
      name: "Helen HR",
      email: "hr@vorldx.demo",
      department: "Human Resources",
      designation: "HR Manager",
      workType: WorkType.OFFICE,
      joiningDate: "2025-01-01",
      isActive: true,
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
  });

  // ============================================================================
  // 1. FEATURE FLAG TEST
  // ============================================================================
  it("should block leave endpoints with 404 when 'leave' feature flag is disabled", async () => {
    featureFlagService.setInMemoryOverride("leave", false);

    const res = await request(app)
      .get("/api/leave/types")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("disabled");

    // Re-enable for subsequent tests
    featureFlagService.setInMemoryOverride("leave", true);
  });

  // ============================================================================
  // 2. CONFIGURE LEAVE TYPES (HR / ADMIN) & UNAUTHORIZED CHECK
  // ============================================================================
  it("should allow HR/Admin to configure leave types, quotas and carry-forward", async () => {
    const res = await request(app)
      .post("/api/leave/types")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        name: "Casual Leave",
        code: "CL",
        paid: true,
        annualQuota: 10,
        carryForwardRule: { allowed: true, maxDays: 3 },
        halfDayAllowed: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe("CL");
    expect(res.body.data.annualQuota).toBe(10);
    expect(res.body.data.carryForwardRule.maxDays).toBe(3);
  });

  it("should reject non-HR employees trying to configure leave types (unauthorized decision)", async () => {
    const res = await request(app)
      .post("/api/leave/types")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        name: "Hacker Leave",
        code: "HL",
        annualQuota: 100,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ============================================================================
  // 3. EMPLOYEE BALANCES INITIALIZATION
  // ============================================================================
  it("should auto-seed default balances for employee when querying balances", async () => {
    const res = await request(app)
      .get("/api/leave/balances/my")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.balances.length).toBe(2);

    const pto = res.body.data.balances.find((b: any) => b.type.code === "PTO");
    expect(pto).toBeDefined();
    expect(pto.allotted).toBe(12);
    expect(pto.used).toBe(0);
    expect(pto.pending).toBe(0);
    expect(pto.available).toBe(12);
  });

  // ============================================================================
  // 4. INSUFFICIENT BALANCE VALIDATION
  // ============================================================================
  it("should reject leave application when working days exceed available balance", async () => {
    // Sick Leave quota is 6 days. Trying to book 10 working days: 2026-11-09 to 2026-11-20 (10 workdays)
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: sickLeaveType._id.toString(),
        startDate: "2026-11-09",
        endDate: "2026-11-20",
        reason: "Extended medical recovery requirement",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_INSUFFICIENT_BALANCE);
    expect(res.body.message).toContain("Insufficient leave balance");
  });

  // ============================================================================
  // 5. HALF-DAY LEAVE VALIDATION
  // ============================================================================
  it("should correctly handle half-day leave application with 0.5 working days deduction", async () => {
    // 2026-11-06 is a Friday (workday)
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-06",
        endDate: "2026-11-06",
        isHalfDay: true,
        halfDayType: "FIRST_HALF",
        reason: "Personal dental appointment in the morning",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workingDays).toBe(0.5);
    expect(res.body.data.isHalfDay).toBe(true);
    expect(res.body.data.halfDayType).toBe("FIRST_HALF");

    // Check balance: pending should be 0.5, available should be 11.5
    const balRes = await request(app)
      .get("/api/leave/balances/my")
      .set("Authorization", `Bearer ${employeeToken}`);

    const pto = balRes.body.data.balances.find((b: any) => b.type.code === "PTO");
    expect(pto.pending).toBe(0.5);
    expect(pto.available).toBe(11.5);
  });

  it("should reject half-day leave when leave type disallows half-days", async () => {
    // Sick leave has halfDayAllowed = false
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: sickLeaveType._id.toString(),
        startDate: "2026-11-06",
        endDate: "2026-11-06",
        isHalfDay: true,
        halfDayType: "FIRST_HALF",
        reason: "Doctor checkup",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ApiErrorCode.ERR_HALF_DAY_NOT_ALLOWED);
  });

  it("should reject half-day leave on a weekend", async () => {
    // 2026-11-07 is Saturday (weekend non-working day)
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-07",
        endDate: "2026-11-07",
        isHalfDay: true,
        halfDayType: "FIRST_HALF",
        reason: "Weekend chore",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ApiErrorCode.ERR_NON_WORKING_DAY);
  });

  // ============================================================================
  // 6. HOLIDAY INSIDE RANGE (CALENDAR SERVICE INTEGRATION)
  // ============================================================================
  it("should accurately exclude weekends and public holidays from working days count", async () => {
    const { calendarService } = await import("../src/services/calendar.service");
    const { CalendarEvent } = await import("../src/models/CalendarEvent");

    // Add public holiday on Wednesday 2026-11-11
    await CalendarEvent.create({
      title: "Diwali Public Holiday",
      startDate: new Date("2026-11-11T00:00:00.000Z"),
      endDate: new Date("2026-11-11T23:59:59.999Z"),
      type: "holiday",
      source: "manual",
    });
    calendarService.invalidateCache();

    // Apply for full week: Monday 2026-11-09 to Friday 2026-11-13 (5 days)
    // Working days should be 4 (excluding Wednesday holiday)
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-09",
        endDate: "2026-11-13",
        reason: "Festival holiday trip with family",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workingDays).toBe(4); // Excludes Wednesday 2026-11-11
  });

  // ============================================================================
  // 7. OVERLAPPING LEAVE VALIDATION
  // ============================================================================
  it("should reject leave request that overlaps with an existing pending or approved leave", async () => {
    // Step 1: Create initial leave for 2026-11-16 to 2026-11-18
    await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-16",
        endDate: "2026-11-18",
        reason: "Family gathering",
      });

    // Step 2: Attempt overlapping leave: 2026-11-17 to 2026-11-20
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: sickLeaveType._id.toString(),
        startDate: "2026-11-17",
        endDate: "2026-11-20",
        reason: "Sudden illness",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_OVERLAPPING_LEAVE);
    expect(res.body.message).toContain("conflicts with an existing");
  });

  // ============================================================================
  // 8. CONFLICT WITH APPROVED WFH VALIDATION
  // ============================================================================
  it("should reject leave application when date conflicts with approved WFH", async () => {
    // Step 1: Employee has approved WFH on 2026-11-24
    await WfhRequest.create({
      employee: employeeDoc._id,
      employeeId: employeeDoc.employeeId,
      department: employeeDoc.department,
      dateKey: "2026-11-24",
      reason: "Home internet installation",
      status: WfhStatus.APPROVED,
    });

    // Step 2: Employee tries to apply for leave covering 2026-11-23 to 2026-11-25
    const res = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-23",
        endDate: "2026-11-25",
        reason: "Traveling out of town",
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ApiErrorCode.ERR_LEAVE_CONFLICT_WFH);
    expect(res.body.message).toContain("already have an approved Work From Home");
  });

  // ============================================================================
  // 9. DOUBLE DECISION PREVENTION (ATOMIC DECISION)
  // ============================================================================
  it("should enforce atomic decision and reject duplicate approvals or rejections", async () => {
    // Apply leave for 2026-11-26
    const applyRes = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-26",
        endDate: "2026-11-26",
        reason: "Conference attendance",
      });

    const requestId = applyRes.body.data._id;

    // HR First Decision: Approve
    const decisionRes1 = await request(app)
      .patch(`/api/leave/requests/${requestId}/decision`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ status: "APPROVED", decisionNote: "Approved for conference." });

    expect(decisionRes1.status).toBe(200);
    expect(decisionRes1.body.data.status).toBe("APPROVED");

    // HR Second Decision attempt: Reject same request
    const decisionRes2 = await request(app)
      .patch(`/api/leave/requests/${requestId}/decision`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ status: "REJECTED", decisionNote: "Changed my mind." });

    expect(decisionRes2.status).toBe(409);
    expect(decisionRes2.body.code).toBe(ApiErrorCode.ERR_LEAVE_ALREADY_DECIDED);
    expect(decisionRes2.body.message).toContain("already been decided");
  });

  // ============================================================================
  // 10. CANCELLATION RESTORING BALANCE (PENDING & APPROVED)
  // ============================================================================
  it("should restore pending balance when cancelling a pending leave request", async () => {
    // 1 day leave on 2026-11-27
    const applyRes = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-27",
        endDate: "2026-11-27",
        reason: "Short personal chore",
      });

    const requestId = applyRes.body.data._id;

    // Balance before cancel: pending = 1, available = 11
    let balRes = await request(app)
      .get("/api/leave/balances/my")
      .set("Authorization", `Bearer ${employeeToken}`);
    let pto = balRes.body.data.balances.find((b: any) => b.type.code === "PTO");
    expect(pto.pending).toBe(1);
    expect(pto.available).toBe(11);

    // Cancel request
    const cancelRes = await request(app)
      .post(`/api/leave/requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ reason: "Plans changed" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("CANCELLED");

    // Balance after cancel: pending restored to 0, available restored to 12
    balRes = await request(app)
      .get("/api/leave/balances/my")
      .set("Authorization", `Bearer ${employeeToken}`);
    pto = balRes.body.data.balances.find((b: any) => b.type.code === "PTO");
    expect(pto.pending).toBe(0);
    expect(pto.available).toBe(12);
  });

  it("should restore used balance and remove ON_LEAVE attendance when cancelling future approved leave", async () => {
    // Apply 1 day leave on 2026-11-30
    const applyRes = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-11-30",
        endDate: "2026-11-30",
        reason: "Personal day",
      });

    const requestId = applyRes.body.data._id;

    // HR Approves
    await request(app)
      .patch(`/api/leave/requests/${requestId}/decision`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ status: "APPROVED" });

    // Verify Attendance Record was marked ON_LEAVE
    let att = await AttendanceRecord.findOne({
      employee: employeeDoc._id,
      dateKey: "2026-11-30",
    });
    expect(att).toBeDefined();
    expect(att?.status).toBe(AttendanceStatus.ON_LEAVE);

    // Verify balance: used = 1, available = 11
    let balRes = await request(app)
      .get("/api/leave/balances/my")
      .set("Authorization", `Bearer ${employeeToken}`);
    let pto = balRes.body.data.balances.find((b: any) => b.type.code === "PTO");
    expect(pto.used).toBe(1);
    expect(pto.available).toBe(11);

    // Cancel the future approved leave
    const cancelRes = await request(app)
      .post(`/api/leave/requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ reason: "Emergency cancelled, will attend office" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("CANCELLED");

    // Verify balance restored: used = 0, available = 12
    balRes = await request(app)
      .get("/api/leave/balances/my")
      .set("Authorization", `Bearer ${employeeToken}`);
    pto = balRes.body.data.balances.find((b: any) => b.type.code === "PTO");
    expect(pto.used).toBe(0);
    expect(pto.available).toBe(12);

    // Verify attendance record was removed/reverted
    att = await AttendanceRecord.findOne({
      employee: employeeDoc._id,
      dateKey: "2026-11-30",
    });
    expect(att).toBeNull();
  });

  // ============================================================================
  // 11. CONCURRENT APPROVALS TEST
  // ============================================================================
  it("should handle concurrent decision attempts atomically with exactly one winning", async () => {
    const applyRes = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-12-01",
        endDate: "2026-12-01",
        reason: "Year end errand",
      });

    const requestId = applyRes.body.data._id;

    // Fire 2 concurrent decision calls at the exact same moment
    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/leave/requests/${requestId}/decision`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ status: "APPROVED", decisionNote: "Admin 1 Approval" }),
      request(app)
        .patch(`/api/leave/requests/${requestId}/decision`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ status: "REJECTED", decisionNote: "Admin 2 Rejection" }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one 200 OK and one 409 Conflict
    expect(statuses).toEqual([200, 409]);
  });

  // ============================================================================
  // 12. UNAUTHORIZED DECISION TEST
  // ============================================================================
  it("should prevent non-HR employees from deciding leave requests", async () => {
    const applyRes = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-12-02",
        endDate: "2026-12-02",
        reason: "Doctor appointment",
      });

    const requestId = applyRes.body.data._id;

    // Regular employee tries to approve their own (or someone else's) leave
    const res = await request(app)
      .patch(`/api/leave/requests/${requestId}/decision`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ============================================================================
  // 13. ABSENCE JOB SKIPS APPROVED LEAVE
  // ============================================================================
  it("should ensure scheduled absence job skips employees on approved leave", async () => {
    // Employee has approved leave on 2026-11-05
    const leave = await LeaveRequest.create({
      employee: employeeDoc._id,
      type: paidLeaveType._id,
      startDate: new Date("2026-11-05T00:00:00.000Z"),
      endDate: new Date("2026-11-05T23:59:59.999Z"),
      workingDays: 1,
      reason: "Approved Day Off",
      status: "APPROVED",
      decidedBy: hrUser._id,
      decidedAt: new Date(),
    });

    // Mark attendance as ON_LEAVE
    await AttendanceRecord.create({
      employee: employeeDoc._id,
      employeeId: employeeDoc.employeeId,
      department: employeeDoc.department,
      dateKey: "2026-11-05",
      status: AttendanceStatus.ON_LEAVE,
    });

    // Deactivate Helen for this test so only Alice is evaluated
    await Employee.findByIdAndUpdate(hrDoc._id, { $set: { isActive: false } });

    // Run absence evaluation job for 2026-11-05
    const result = await evaluateAbsenceAndIncompleteJob("2026-11-05", {
      force: true,
      simulatedNow: new Date("2026-11-05T19:00:00.000Z"),
    });

    // Alice should NOT be marked as absent
    expect(result.absenteesMarked).toBe(0);

    const record = await AttendanceRecord.findOne({
      employee: employeeDoc._id,
      dateKey: "2026-11-05",
    });
    expect(record?.status).toBe(AttendanceStatus.ON_LEAVE);
  });

  // ============================================================================
  // 14. BULK DECISION WORKFLOW
  // ============================================================================
  it("should process bulk approval and bulk rejection with per-item atomic results", async () => {
    // Create 2 separate leave requests
    const r1 = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-12-07",
        endDate: "2026-12-07",
        reason: "Vacation day 1",
      });

    const r2 = await request(app)
      .post("/api/leave/requests")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        type: paidLeaveType._id.toString(),
        startDate: "2026-12-08",
        endDate: "2026-12-08",
        reason: "Vacation day 2",
      });

    const req1Id = r1.body.data._id;
    const req2Id = r2.body.data._id;

    // HR executes bulk decision
    const bulkRes = await request(app)
      .post("/api/leave/requests/bulk-decision")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        requestIds: [req1Id, req2Id, "non-existent-id"],
        status: "APPROVED",
        decisionNote: "Bulk approved by HR director",
      });

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.data.total).toBe(3);
    expect(bulkRes.body.data.successful.length).toBe(2);
    expect(bulkRes.body.data.failed.length).toBe(1);
    expect(bulkRes.body.data.failed[0].requestId).toBe("non-existent-id");
  });
});
