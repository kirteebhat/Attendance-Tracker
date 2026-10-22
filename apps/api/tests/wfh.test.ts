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

describe("Work From Home (WFH) Management Module", () => {
  let employeeUser: IUser;
  let employeeDoc: IEmployee;
  let employeeToken: string;

  let internUser: IUser;
  let internDoc: IEmployee;
  let internToken: string;

  let hrUser: IUser;
  let hrToken: string;

  const simulatedNow = new Date("2026-10-21T05:00:00.000Z"); // Wednesday 10:30 AM IST (dateKey: 2026-10-21)

  beforeEach(async () => {
    await WfhRequest.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await Holiday.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await AuditEvent.deleteMany({});

    // 1. Create Default Attendance Policy with WFH Rules
    await AttendancePolicy.create({
      name: "Standard Corporate Policy",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      isDefault: true,
      workdays: [1, 2, 3, 4, 5], // Monday through Friday
      wfhRules: {
        allowedDaysPerWeek: 2,
        advanceNoticeDays: 1,
        monthlyQuota: 4,
        allowHalfDays: false,
      },
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

    // 2. Create Standard Active Full-Time Employee
    employeeDoc = await Employee.create({
      employeeId: "EMP-1001",
      name: "Aarav Sharma",
      email: "aarav.sharma@vorldx.demo",
      department: "Engineering",
      designation: "Backend Engineer",
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

    // 3. Create Intern Employee (WFH Ineligible)
    internDoc = await Employee.create({
      employeeId: "EMP-2001",
      name: "Priya Nair",
      email: "priya.nair@vorldx.demo",
      department: "Design",
      designation: "UI Intern",
      workType: WorkType.INTERN,
      joiningDate: "2026-06-01",
      isActive: true,
    });

    internUser = await User.create({
      employeeId: internDoc.employeeId,
      email: internDoc.email,
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    internDoc.userId = internUser._id;
    await internDoc.save();

    internToken = jwt.sign(
      {
        userId: internUser._id.toString(),
        employeeId: internUser.employeeId,
        email: internUser.email,
        role: internUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Create HR Admin User
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
  });

  describe("WFH Eligibility (GET /api/wfh/eligibility)", () => {
    it("returns eligible=true and quota details for full-time employee", async () => {
      const res = await request(app)
        .get("/api/wfh/eligibility")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isEligible).toBe(true);
      expect(res.body.employeeId).toBe("EMP-1001");
      expect(res.body.department).toBe("Engineering");
      expect(res.body.monthlyQuota).toBe(4);
      expect(res.body.usedDays).toBe(0);
      expect(res.body.remainingQuota).toBe(4);
      expect(res.body.advanceNoticeDays).toBe(1);
    });

    it("returns eligible=false with policy reason for interns", async () => {
      const res = await request(app)
        .get("/api/wfh/eligibility")
        .set("Authorization", `Bearer ${internToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isEligible).toBe(false);
      expect(res.body.reasons).toContain(
        "Interns are not eligible for Work From Home under organizational policy."
      );
    });

    it("rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/wfh/eligibility");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ApiErrorCode.ERR_UNAUTHORIZED);
    });
  });

  describe("Submitting WFH Requests (POST /api/wfh/requests)", () => {
    it("successfully creates a pending WFH request with advance notice on a working day", async () => {
      // simulatedNow is 2026-10-21 (Wed). Requesting 2026-10-22 (Thu) -> 1 day advance, workday
      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "Attending high-speed internet technician visit",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.request.status).toBe(WfhStatus.PENDING);
      expect(res.body.request.dateKey).toBe("2026-10-22");
      expect(res.body.request.employeeId).toBe("EMP-1001");

      // Verify AuditEvent recorded
      const audit = await AuditEvent.findOne({
        entityId: res.body.request._id,
        action: "CREATE",
      });
      expect(audit).not.toBeNull();
      expect(audit?.performedByEmployeeId).toBe("EMP-1001");
    });

    it("rejects duplicate WFH request for the same date with 409 ERR_DUPLICATE_WFH_REQUEST", async () => {
      // First request
      await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "Doctor appointment at local clinic",
          simulatedNow: simulatedNow.toISOString(),
        });

      // Second duplicate request on the same dateKey
      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "Trying to submit second request for same day",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ApiErrorCode.ERR_DUPLICATE_WFH_REQUEST);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("rejects request for past dates with 400 ERR_WFH_INELIGIBLE", async () => {
      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-20", // yesterday
          reason: "Forgot to apply yesterday",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_WFH_INELIGIBLE);
      expect(res.body.message).toMatch(/past dates/i);
    });

    it("rejects request violating advance notice requirement with 400 ERR_WFH_INELIGIBLE", async () => {
      // simulatedNow is 2026-10-21. Requesting same day 2026-10-21 violates 1-day advance notice
      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-21",
          reason: "Sudden headache this morning",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_WFH_INELIGIBLE);
      expect(res.body.message).toMatch(/advance notice/i);
    });

    it("rejects request on weekend / non-working day with 400 ERR_NON_WORKING_DAY", async () => {
      // 2026-10-24 is Saturday
      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-24",
          reason: "Working on weekend sprint release",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_NON_WORKING_DAY);
    });

    it("rejects request on official company holiday with 400 ERR_NON_WORKING_DAY", async () => {
      // Insert holiday on 2026-10-23 (Friday)
      await Holiday.create({
        name: "Regional Festival",
        dateKey: "2026-10-23",
        year: 2026,
        isFloating: false,
      });

      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-23",
          reason: "Want to work from home on festival day",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_NON_WORKING_DAY);
    });

    it("rejects request when intern applies with 400 ERR_WFH_INELIGIBLE", async () => {
      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${internToken}`)
        .send({
          dateKey: "2026-10-23",
          reason: "Need to study for college exam",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_WFH_INELIGIBLE);
      expect(res.body.message).toMatch(/intern/i);
    });

    it("rejects request if employee has already punched in at the office today", async () => {
      // Create active attendance record with check-in
      await AttendanceRecord.create({
        employee: employeeDoc._id,
        employeeId: employeeDoc.employeeId,
        department: employeeDoc.department,
        dateKey: "2026-10-22",
        checkInTime: new Date("2026-10-22T03:30:00.000Z"),
        status: AttendanceStatus.PRESENT,
      });

      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "Leaving office early to finish at home",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_WFH_CURRENTLY_IN_OFFICE);
    });

    it("rejects request if monthly WFH quota is exhausted", async () => {
      // Pre-create 4 approved requests in October 2026
      for (let day = 12; day <= 15; day++) {
        await WfhRequest.create({
          employee: employeeDoc._id,
          employeeId: employeeDoc.employeeId,
          department: employeeDoc.department,
          dateKey: `2026-10-${day}`,
          reason: `Approved WFH on day ${day}`,
          status: WfhStatus.APPROVED,
          reviewedBy: hrUser._id,
          reviewedAt: new Date(),
        });
      }

      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-28", // workday
          reason: "Fifth WFH day request",
          simulatedNow: simulatedNow.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_QUOTA_EXCEEDED);
      expect(res.body.message).toMatch(/quota of 4 days has been reached/i);
    });
  });

  describe("Employee Listing and Cancellation", () => {
    it("allows employee to list their submitted requests (GET /api/wfh/my-requests)", async () => {
      await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "First pending request",
          simulatedNow: simulatedNow.toISOString(),
        });

      const res = await request(app)
        .get("/api/wfh/my-requests")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].dateKey).toBe("2026-10-22");
    });

    it("allows employee to cancel their pending request (PATCH /api/wfh/requests/:id/cancel)", async () => {
      const created = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "Request to be cancelled",
          simulatedNow: simulatedNow.toISOString(),
        });

      const requestId = created.body.request._id;

      const res = await request(app)
        .patch(`/api/wfh/requests/${requestId}/cancel`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.request.status).toBe(WfhStatus.CANCELLED);

      // Verify audit
      const audit = await AuditEvent.findOne({
        entityId: requestId,
        action: "CANCEL",
      });
      expect(audit).not.toBeNull();
      expect(audit?.performedByEmployeeId).toBe("EMP-1001");
    });

    it("prevents cancelling an already approved request", async () => {
      const reqDoc = await WfhRequest.create({
        employee: employeeDoc._id,
        employeeId: employeeDoc.employeeId,
        department: employeeDoc.department,
        dateKey: "2026-10-22",
        reason: "Already approved by HR",
        status: WfhStatus.APPROVED,
        reviewedBy: hrUser._id,
        reviewedAt: new Date(),
      });

      const res = await request(app)
        .patch(`/api/wfh/requests/${reqDoc._id}/cancel`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ApiErrorCode.ERR_BAD_REQUEST);
      expect(res.body.message).toMatch(/only pending/i);
    });
  });

  describe("HR / Admin Review & State Machine Effects", () => {
    let pendingReqId: string;

    beforeEach(async () => {
      const created = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          dateKey: "2026-10-22",
          reason: "Waiting for HR decision",
          simulatedNow: simulatedNow.toISOString(),
        });
      pendingReqId = created.body.request._id;
    });

    it("blocks unauthorized regular employees from reviewing requests with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .patch(`/api/wfh/requests/${pendingReqId}/review`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          status: WfhStatus.APPROVED,
          remarks: "Self-approving my own request",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });

    it("HR can list all requests with filters and pagination (GET /api/wfh/admin/requests)", async () => {
      const res = await request(app)
        .get("/api/wfh/admin/requests?status=PENDING&department=Engineering")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeId).toBe("EMP-1001");
      expect(res.body.pagination.total).toBe(1);
    });

    it("HR approval atomically approves request, credits 480 mins attendance, and logs audit", async () => {
      const res = await request(app)
        .patch(`/api/wfh/requests/${pendingReqId}/review`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: WfhStatus.APPROVED,
          remarks: "Approved for project sprint tasks",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.request.status).toBe(WfhStatus.APPROVED);
      expect(res.body.request.reviewedBy).toBe(hrUser._id.toString());
      expect(res.body.request.reviewerRemarks).toBe("Approved for project sprint tasks");

      // Verify Attendance Record was created with status WFH_APPROVED and 480 mins duration credit
      const attendance = await AttendanceRecord.findOne({
        employee: employeeDoc._id,
        dateKey: "2026-10-22",
      });

      expect(attendance).not.toBeNull();
      expect(attendance?.status).toBe(AttendanceStatus.WFH_APPROVED);
      expect(attendance?.isWfh).toBe(true);
      expect(attendance?.durationMinutes).toBe(480);
      expect(attendance?.checkInTime).toBeNull();
      expect(attendance?.checkOutTime).toBeNull();

      // Verify Audit Event logged
      const audit = await AuditEvent.findOne({
        entityId: pendingReqId,
        action: "UPDATE",
      });
      expect(audit).not.toBeNull();
      expect(audit?.performedBy?.toString()).toBe(hrUser._id.toString());
      expect(audit?.metadata?.actorRole).toBe("HR");
      expect(audit?.newValue.status).toBe(WfhStatus.APPROVED);
    });

    it("prevents double decision with 409 ERR_BAD_REQUEST when request was already decided", async () => {
      // 1. First review: Approve
      await request(app)
        .patch(`/api/wfh/requests/${pendingReqId}/review`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: WfhStatus.APPROVED,
          remarks: "Initial approval",
        });

      // 2. Second review: Attempt to reject already approved request
      const doubleReviewRes = await request(app)
        .patch(`/api/wfh/requests/${pendingReqId}/review`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: WfhStatus.REJECTED,
          remarks: "Changed my mind",
        });

      expect(doubleReviewRes.status).toBe(409);
      expect(doubleReviewRes.body.code).toBe(ApiErrorCode.ERR_BAD_REQUEST);
      expect(doubleReviewRes.body.message).toMatch(/already been decided/i);
    });

    it("HR rejection sets status to REJECTED and does NOT credit attendance", async () => {
      const res = await request(app)
        .patch(`/api/wfh/requests/${pendingReqId}/review`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: WfhStatus.REJECTED,
          remarks: "Critical on-site hardware setup requires presence",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.request.status).toBe(WfhStatus.REJECTED);
      expect(res.body.request.reviewerRemarks).toBe(
        "Critical on-site hardware setup requires presence"
      );

      // Verify no Attendance Record was credited
      const attendance = await AttendanceRecord.findOne({
        employee: employeeDoc._id,
        dateKey: "2026-10-22",
      });
      expect(attendance).toBeNull();
    });
  });
});
