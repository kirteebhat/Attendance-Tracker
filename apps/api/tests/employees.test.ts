import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { Employee, User, AuditEvent } from "../src/models";
import { ApiErrorCode, UserRole, WorkType } from "@vorldx/shared";
import { env } from "../src/config/env";

describe("Employees Management Module (HR/Admin)", () => {
  let adminToken: string;
  let hrToken: string;
  let employeeToken: string;
  let testEmployeeId: string;

  beforeEach(async () => {
    await AuditEvent.deleteMany({});
    await User.deleteMany({});
    await Employee.deleteMany({});

    // 1. Create Admin
    const adminUser = await User.create({
      employeeId: "ADM-901",
      email: "admin@vorldx.demo",
      passwordHash: "hashedPassword",
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

    // 2. Create HR
    const hrUser = await User.create({
      employeeId: "HR-901",
      email: "hr@vorldx.demo",
      passwordHash: "hashedPassword",
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

    // 3. Create Standard Employee
    const empUser = await User.create({
      employeeId: "EMP-901",
      email: "emp901@vorldx.demo",
      passwordHash: "hashedPassword",
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

    const emp = await Employee.create({
      employeeId: "EMP-901",
      name: "Standard Employee",
      email: "emp901@vorldx.demo",
      department: "Engineering",
      designation: "Software Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-01-01",
      isActive: true,
      userId: empUser._id,
    });
    testEmployeeId = emp.employeeId;
  });

  it("blocks regular employee from accessing HR employee management endpoints with 403 ERR_FORBIDDEN", async () => {
    // 1. List employees
    const listRes = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(listRes.status).toBe(403);
    expect(listRes.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);

    // 2. Create employee
    const createRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({
        employeeId: "EMP-NEW",
        name: "Unauthorized Create",
        email: "unauth@vorldx.demo",
        department: "Sales",
        designation: "Sales Exec",
        joiningDate: "2024-01-01",
      });
    expect(createRes.status).toBe(403);
    expect(createRes.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);

    // 3. Update employee
    const updateRes = await request(app)
      .patch(`/api/employees/${testEmployeeId}`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ name: "Hacked Name" });
    expect(updateRes.status).toBe(403);
    expect(updateRes.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);

    // 4. Update status
    const statusRes = await request(app)
      .patch(`/api/employees/${testEmployeeId}/status`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ isActive: false });
    expect(statusRes.status).toBe(403);
    expect(statusRes.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
  });

  it("allows employee to read only their own profile through /api/employees/me", async () => {
    const res = await request(app)
      .get("/api/employees/me")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.employeeId).toBe("EMP-901");
    expect(res.body.data.name).toBe("Standard Employee");
    expect(res.body.data.department).toBe("Engineering");
  });

  it("creates employee with duplicate prevention and writes AuditEvent", async () => {
    const newEmpData = {
      employeeId: "EMP-100",
      name: "Priya Sundaram",
      email: "priya.sundaram@vorldx.demo",
      department: "Human Resources",
      designation: "Talent Specialist",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-02-15",
    };

    // 1. Create successfully as HR
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${hrToken}`)
      .send(newEmpData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.employeeId).toBe("EMP-100");
    expect(res.body.data.name).toBe("Priya Sundaram");
    expect(res.body.data.isActive).toBe(true);

    const createdId = res.body.data._id;

    // Verify AuditEvent written
    const auditEvent = await AuditEvent.findOne({
      entityType: "EMPLOYEE",
      entityId: createdId,
      action: "CREATE",
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.performedByEmployeeId).toBe("HR-901");
    expect(auditEvent?.previousValue).toBeNull();
    expect((auditEvent?.newValue as Record<string, unknown>).employeeId).toBe("EMP-100");

    // 2. Prevent duplicate Employee ID
    const dupIdRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...newEmpData,
        email: "different.email@vorldx.demo",
      });

    expect(dupIdRes.status).toBe(409);
    expect(dupIdRes.body.success).toBe(false);
    expect(dupIdRes.body.message).toContain("already exists in company roster");

    // 3. Prevent duplicate Email
    const dupEmailRes = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        ...newEmpData,
        employeeId: "EMP-DIFFERENT-ID",
      });

    expect(dupEmailRes.status).toBe(409);
    expect(dupEmailRes.body.success).toBe(false);
    expect(dupEmailRes.body.message).toContain("already assigned to another employee");
  });

  it("updates employee profile and writes AuditEvent with before/after snapshots", async () => {
    const updatePayload = {
      name: "Standard Employee Updated",
      designation: "Senior Software Engineer",
      department: "Platform Engineering",
      workType: WorkType.CONTRACT,
    };

    const res = await request(app)
      .patch(`/api/employees/${testEmployeeId}`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Standard Employee Updated");
    expect(res.body.data.designation).toBe("Senior Software Engineer");
    expect(res.body.data.department).toBe("Platform Engineering");
    expect(res.body.data.workType).toBe(WorkType.CONTRACT);

    // Verify AuditEvent
    const auditEvent = await AuditEvent.findOne({
      entityType: "EMPLOYEE",
      action: "UPDATE",
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.performedByEmployeeId).toBe("HR-901");
    expect((auditEvent?.previousValue as Record<string, unknown>).name).toBe("Standard Employee");
    expect((auditEvent?.newValue as Record<string, unknown>).name).toBe(
      "Standard Employee Updated"
    );
  });

  it("deactivates employee, blocks login, revokes refresh tokens, and writes AuditEvent", async () => {
    // 1. Deactivate employee
    const deactRes = await request(app)
      .patch(`/api/employees/${testEmployeeId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false, reason: "Employee contract terminated" });

    expect(deactRes.status).toBe(200);
    expect(deactRes.body.success).toBe(true);
    expect(deactRes.body.data.isActive).toBe(false);

    // Verify AuditEvent
    const auditEvent = await AuditEvent.findOne({
      entityType: "EMPLOYEE",
      action: "DEACTIVATE",
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.performedByEmployeeId).toBe("ADM-901");
    expect(auditEvent?.reason).toBe("Employee contract terminated");
    expect(auditEvent?.previousValue).toEqual({ isActive: true });
    expect(auditEvent?.newValue).toEqual({ isActive: false });

    // Verify User account status updated to INACTIVE and refreshTokenHash wiped
    const userDoc = await User.findOne({ employeeId: testEmployeeId });
    expect(userDoc?.status).toBe("INACTIVE");
    expect(userDoc?.refreshTokenHash).toBeNull();

    // Verify Employee record still exists (history preserved, not deleted)
    const empDoc = await Employee.findOne({ employeeId: testEmployeeId });
    expect(empDoc).not.toBeNull();
    expect(empDoc?.isActive).toBe(false);

    // 2. Verify deactivated employee cannot log in
    const loginRes = await request(app).post("/api/auth/login").send({
      employeeId: testEmployeeId,
      password: "hashedPassword",
    });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toContain("disabled");

    // 3. Reactivate employee
    const reactRes = await request(app)
      .patch(`/api/employees/${testEmployeeId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true, reason: "Employee reinstated" });

    expect(reactRes.status).toBe(200);
    expect(reactRes.body.data.isActive).toBe(true);

    const reactivatedUser = await User.findOne({ employeeId: testEmployeeId });
    expect(reactivatedUser?.status).toBe("ACTIVE");
  });

  it("supports multi-column search, filtering, sorting, and pagination", async () => {
    // Seed test employees across departments and work types
    await Employee.create([
      {
        employeeId: "EMP-A01",
        name: "Abhishek Bachchan",
        email: "abhishek@vorldx.demo",
        department: "Marketing",
        designation: "Brand Strategist",
        workType: WorkType.FULL_TIME,
        joiningDate: "2023-01-01",
        isActive: true,
      },
      {
        employeeId: "EMP-A02",
        name: "Bhavna Patel",
        email: "bhavna@vorldx.demo",
        department: "Marketing",
        designation: "Copywriter",
        workType: WorkType.CONTRACT,
        joiningDate: "2023-02-01",
        isActive: true,
      },
      {
        employeeId: "EMP-A03",
        name: "Chetan Bhagat",
        email: "chetan@vorldx.demo",
        department: "Engineering",
        designation: "Frontend Lead",
        workType: WorkType.FULL_TIME,
        joiningDate: "2023-03-01",
        isActive: false, // Inactive
      },
      {
        employeeId: "EMP-A04",
        name: "Divya Agarwal",
        email: "divya@vorldx.demo",
        department: "Engineering",
        designation: "Backend Lead",
        workType: WorkType.PART_TIME,
        joiningDate: "2023-04-01",
        isActive: true,
      },
    ]);

    // 1. Pagination: limit=2, page=1
    const p1Res = await request(app)
      .get("/api/employees?page=1&limit=2")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(p1Res.status).toBe(200);
    expect(p1Res.body.data.length).toBe(2);
    expect(p1Res.body.pagination.page).toBe(1);
    expect(p1Res.body.pagination.limit).toBe(2);
    expect(p1Res.body.pagination.total).toBe(5); // 4 new + 1 standard employee
    expect(p1Res.body.pagination.totalPages).toBe(3);
    expect(p1Res.body.pagination.hasNextPage).toBe(true);
    expect(p1Res.body.pagination.hasPrevPage).toBe(false);

    // 2. Search: matches "Bhavna"
    const searchRes = await request(app)
      .get("/api/employees?search=Bhavna")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBe(1);
    expect(searchRes.body.data[0].employeeId).toBe("EMP-A02");

    // 3. Filter by department: "Marketing"
    const deptRes = await request(app)
      .get("/api/employees?department=Marketing")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deptRes.status).toBe(200);
    expect(deptRes.body.data.length).toBe(2);
    expect(
      deptRes.body.data.every((e: { department: string }) => e.department === "Marketing")
    ).toBe(true);

    // 4. Filter by status: "inactive"
    const inactiveRes = await request(app)
      .get("/api/employees?status=inactive")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(inactiveRes.status).toBe(200);
    expect(inactiveRes.body.data.length).toBe(1);
    expect(inactiveRes.body.data[0].employeeId).toBe("EMP-A03");

    // 5. Filter by workType: "CONTRACT"
    const workTypeRes = await request(app)
      .get("/api/employees?workType=CONTRACT")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(workTypeRes.status).toBe(200);
    expect(workTypeRes.body.data.length).toBe(1);
    expect(workTypeRes.body.data[0].employeeId).toBe("EMP-A02");

    // 6. Sorting: name asc
    const sortRes = await request(app)
      .get("/api/employees?sortBy=name&sortOrder=asc")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(sortRes.status).toBe(200);
    const names = sortRes.body.data.map((e: { name: string }) => e.name);
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sortedNames);
  });
});
