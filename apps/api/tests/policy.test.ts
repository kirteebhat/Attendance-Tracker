import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { AttendancePolicy, Holiday, AuditEvent, User } from "../src/models";
import { ApiErrorCode, UserRole } from "@vorldx/shared";
import { env } from "../src/config/env";

describe("Attendance Policy & Holiday Module", () => {
  let adminToken: string;
  let hrToken: string;
  let employeeToken: string;

  beforeEach(async () => {
    await AuditEvent.deleteMany({});
    await Holiday.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await User.deleteMany({});

    // 1. Admin
    const adminUser = await User.create({
      employeeId: "ADM-888",
      email: "admin888@vorldx.demo",
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

    // 2. HR
    const hrUser = await User.create({
      employeeId: "HR-888",
      email: "hr888@vorldx.demo",
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

    // 3. Employee
    const empUser = await User.create({
      employeeId: "EMP-888",
      email: "emp888@vorldx.demo",
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    employeeToken = jwt.sign(
      {
        userId: empUser._id.toString(),
        employeeId: empUser.employeeId,
        email: empUser.email,
        role: empUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  it("GET /api/policy returns active default policy with version 1 and shifts", async () => {
    const res = await request(app)
      .get("/api/policy")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.timezone).toBe("Asia/Kolkata");
    expect(res.body.data.defaultGraceMinutes).toBe(15);
    expect(res.body.data.shifts.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.wfhRules).toMatchObject({
      monthlyQuota: 4,
      advanceNoticeDays: 1,
      allowedDaysPerWeek: 2,
    });
  });

  it("blocks regular employee from updating policy with 403 ERR_FORBIDDEN", async () => {
    const res = await request(app)
      .patch("/api/policy")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ defaultGraceMinutes: 20 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
  });

  it("updates policy, increments version, validates shift rules, and logs AuditEvent", async () => {
    // 1. Initial version is 1
    const initialPolicy = await request(app)
      .get("/api/policy")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(initialPolicy.body.data.version).toBe(1);

    // 2. Reject invalid shifts where end time is before start without overnight flag
    const invalidShiftRes = await request(app)
      .patch("/api/policy")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        shifts: [
          {
            name: "Broken Day Shift",
            startTime: "18:00",
            endTime: "09:00",
            graceMinutes: 15,
            isOvernight: false,
          },
        ],
      });
    expect(invalidShiftRes.status).toBe(400);
    expect(invalidShiftRes.body.code).toBe(ApiErrorCode.ERR_INVALID_INPUT);
    expect(invalidShiftRes.body.message).toContain("must be after start time");

    // 3. Reject grace period > 60 minutes
    const invalidGraceRes = await request(app)
      .patch("/api/policy")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ defaultGraceMinutes: 99 });
    expect(invalidGraceRes.status).toBe(400);

    // 4. Update valid configuration (overnight shift + adjusted grace + WFH rules)
    const updateRes = await request(app)
      .patch("/api/policy")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        defaultGraceMinutes: 20,
        monthlyWfhQuota: 6,
        wfhRules: {
          monthlyQuota: 6,
          advanceNoticeDays: 2,
          allowedDaysPerWeek: 3,
          autoApproval: true,
        },
        shifts: [
          {
            name: "Regular Day Shift",
            startTime: "09:00",
            endTime: "18:00",
            graceMinutes: 20,
            isOvernight: false,
          },
          {
            name: "Night Production Shift",
            startTime: "21:00",
            endTime: "06:00",
            graceMinutes: 15,
            isOvernight: true,
          },
        ],
        reason: "Adjusted for winter schedule and expanded WFH flexibility",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.version).toBe(2); // Incremented version
    expect(updateRes.body.data.defaultGraceMinutes).toBe(20);
    expect(updateRes.body.data.wfhRules.advanceNoticeDays).toBe(2);
    expect(updateRes.body.data.shifts.length).toBe(2);

    // 5. Verify AuditEvent logged
    const auditEvent = await AuditEvent.findOne({
      entityType: "POLICY",
      action: "UPDATE",
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.performedByEmployeeId).toBe("HR-888");
    expect((auditEvent?.previousValue as Record<string, unknown>).version).toBe(1);
    expect((auditEvent?.newValue as Record<string, unknown>).version).toBe(2);
    expect(auditEvent?.reason).toContain("Adjusted for winter schedule");
  });

  it("handles Holiday CRUD with duplicate protection and audit logging", async () => {
    // 1. Create holiday as HR
    const createRes = await request(app)
      .post("/api/holidays")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        name: "Republic Day",
        dateKey: "2026-01-26",
        description: "National holiday of India",
        isRecurring: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.name).toBe("Republic Day");
    expect(createRes.body.data.isRecurring).toBe(true);

    const holidayId = createRes.body.data._id;

    // Verify AuditEvent
    const createAudit = await AuditEvent.findOne({
      entityType: "POLICY",
      action: "CREATE_HOLIDAY",
    });
    expect(createAudit).not.toBeNull();
    expect(createAudit?.performedByEmployeeId).toBe("HR-888");

    // 2. Prevent duplicate holiday on same dateKey
    const dupRes = await request(app)
      .post("/api/holidays")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Duplicate Holiday",
        dateKey: "2026-01-26",
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.message).toContain("already exists");

    // 3. List holidays as regular employee
    const listRes = await request(app)
      .get("/api/holidays?year=2026")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].dateKey).toBe("2026-01-26");

    // 4. Update holiday as Admin
    const updateRes = await request(app)
      .patch(`/api/holidays/${holidayId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        description: "Official paid public holiday",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.description).toBe("Official paid public holiday");

    // 5. Delete holiday as HR
    const deleteRes = await request(app)
      .delete(`/api/holidays/${holidayId}`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toContain("deleted successfully");

    const deletedDoc = await Holiday.findById(holidayId);
    expect(deletedDoc).toBeNull();

    // Verify Delete AuditEvent
    const deleteAudit = await AuditEvent.findOne({
      entityType: "POLICY",
      action: "DELETE_HOLIDAY",
    });
    expect(deleteAudit).not.toBeNull();
  });
});
