import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { User, hashPassword } from "../src/models/User";
import { Employee } from "../src/models/Employee";
import { ApiErrorCode, UserRole, WorkType } from "@vorldx/shared";
import { env } from "../src/config/env";
import { runSeed } from "../src/scripts/seed";

describe("HR & Admin Authentication & Session Management", () => {
  beforeEach(async () => {
    // Clean collections before each test run
    await User.deleteMany({});
    await Employee.deleteMany({});
  });

  it("successfully logs in with valid credentials and sets secure cookie", async () => {
    const password = "ValidPassword123!";
    const passwordHash = await hashPassword(password);

    const user = await User.create({
      employeeId: "HR-101",
      email: "hr.manager@vorldx.demo",
      passwordHash,
      role: UserRole.HR,
      status: "ACTIVE",
    });

    const employee = await Employee.create({
      employeeId: "HR-101",
      name: "Rohit Roy",
      email: "hr.manager@vorldx.demo",
      department: "Human Resources",
      designation: "HR Lead",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-01-01",
      userId: user._id,
    });
    expect(employee._id).toBeDefined();

    // Login using employeeId
    const res = await request(app).post("/api/auth/login").send({
      employeeId: "HR-101",
      password,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toMatchObject({
      employeeId: "HR-101",
      email: "hr.manager@vorldx.demo",
      role: UserRole.HR,
    });
    expect(res.body.employee).toMatchObject({
      employeeId: "HR-101",
      name: "Rohit Roy",
      department: "Human Resources",
    });

    // Check Set-Cookie header contains refreshToken
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain("refreshToken=");
    expect(cookies[0]).toContain("HttpOnly");

    // Also verify login using email
    const resEmail = await request(app).post("/api/auth/login").send({
      email: "hr.manager@vorldx.demo",
      password,
    });
    expect(resEmail.status).toBe(200);
    expect(resEmail.body.success).toBe(true);
  });

  it("rejects login with wrong password and increments failedLoginAttempts", async () => {
    const password = "CorrectPassword123!";
    const passwordHash = await hashPassword(password);

    await User.create({
      employeeId: "EMP-201",
      email: "employee@vorldx.demo",
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    const res = await request(app).post("/api/auth/login").send({
      employeeId: "EMP-201",
      password: "WrongPassword!",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_INVALID_CREDENTIALS);

    const updatedUser = await User.findOne({ employeeId: "EMP-201" });
    expect(updatedUser?.failedLoginAttempts).toBe(1);
    expect(updatedUser?.lockoutUntil).toBeNull();
  });

  it("locks user account after 5 consecutive failed login attempts", async () => {
    const password = "MySecurePassword123!";
    const passwordHash = await hashPassword(password);

    await User.create({
      employeeId: "ADM-301",
      email: "admin.lockout@vorldx.demo",
      passwordHash,
      role: UserRole.ADMIN,
      status: "ACTIVE",
    });

    // Attempt 1 through 4 should fail with 401 ERR_INVALID_CREDENTIALS
    for (let i = 1; i <= 4; i++) {
      const res = await request(app).post("/api/auth/login").send({
        employeeId: "ADM-301",
        password: "IncorrectPassword",
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(ApiErrorCode.ERR_INVALID_CREDENTIALS);
    }

    // 5th attempt must trigger account lockout
    const fifthRes = await request(app).post("/api/auth/login").send({
      employeeId: "ADM-301",
      password: "IncorrectPassword",
    });

    expect(fifthRes.status).toBe(423);
    expect(fifthRes.body.success).toBe(false);
    expect(fifthRes.body.code).toBe(ApiErrorCode.ERR_ACCOUNT_LOCKED);
    expect(fifthRes.body.message).toContain("Account is temporarily locked");

    // 6th attempt with CORRECT password must still be rejected due to active lockout
    const lockedRes = await request(app).post("/api/auth/login").send({
      employeeId: "ADM-301",
      password: password,
    });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.code).toBe(ApiErrorCode.ERR_ACCOUNT_LOCKED);
  });

  it("distinguishes expired token with ERR_TOKEN_EXPIRED error code", async () => {
    // Generate an already expired token
    const expiredToken = jwt.sign(
      {
        userId: "507f1f77bcf86cd799439011",
        employeeId: "EMP-EXP",
        email: "expired@vorldx.demo",
        role: UserRole.EMPLOYEE,
      },
      env.JWT_SECRET,
      { expiresIn: "-5s" }
    );

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_TOKEN_EXPIRED);
    expect(res.body.message).toBe("Access token has expired");
  });

  it("enforces role-based access control: blocks employee from HR routes", async () => {
    const employeeToken = jwt.sign(
      {
        userId: "507f1f77bcf86cd799439012",
        employeeId: "EMP-401",
        email: "employee@vorldx.demo",
        role: UserRole.EMPLOYEE,
      },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const hrToken = jwt.sign(
      {
        userId: "507f1f77bcf86cd799439013",
        employeeId: "HR-401",
        email: "hr@vorldx.demo",
        role: UserRole.HR,
      },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const adminToken = jwt.sign(
      {
        userId: "507f1f77bcf86cd799439014",
        employeeId: "ADM-401",
        email: "admin@vorldx.demo",
        role: UserRole.ADMIN,
      },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // 1. Employee access to HR route must return 403 Forbidden
    const empRes = await request(app)
      .get("/api/test-protected-hr")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(empRes.status).toBe(403);
    expect(empRes.body.success).toBe(false);
    expect(empRes.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);

    // 2. HR access to HR route must succeed
    const hrRes = await request(app)
      .get("/api/test-protected-hr")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(hrRes.status).toBe(200);
    expect(hrRes.body.success).toBe(true);
    expect(hrRes.body.message).toBe("HR route accessed successfully");

    // 3. Admin access to HR route must also succeed (hierarchical privilege)
    const adminRes = await request(app)
      .get("/api/test-protected-hr")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
  });

  it("rotates refresh token and invalidates session on logout", async () => {
    const password = "SessionPassword123!";
    const passwordHash = await hashPassword(password);

    await User.create({
      employeeId: "SES-501",
      email: "session.user@vorldx.demo",
      passwordHash,
      role: UserRole.HR,
      status: "ACTIVE",
    });

    // 1. Login
    const loginRes = await request(app).post("/api/auth/login").send({
      employeeId: "SES-501",
      password,
    });
    expect(loginRes.status).toBe(200);
    const initialRefreshToken = loginRes.body.refreshToken;

    // 2. Refresh session
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: initialRefreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(initialRefreshToken); // Token rotation verified

    const rotatedRefreshToken = refreshRes.body.refreshToken;

    // 3. Logout
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: rotatedRefreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.message).toBe("Logged out successfully");

    // 4. Attempting to use logged-out refresh token must fail with 401
    const invalidRefreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotatedRefreshToken });

    expect(invalidRefreshRes.status).toBe(401);
    expect(invalidRefreshRes.body.code).toBe(ApiErrorCode.ERR_UNAUTHORIZED);
  });

  it("GET /api/auth/me returns current user and employee profile", async () => {
    const password = "ProfilePassword123!";
    const passwordHash = await hashPassword(password);

    const user = await User.create({
      employeeId: "PRF-601",
      email: "profile@vorldx.demo",
      passwordHash,
      role: UserRole.HR,
      status: "ACTIVE",
    });

    await Employee.create({
      employeeId: "PRF-601",
      name: "Tanya Verma",
      email: "profile@vorldx.demo",
      department: "Human Resources",
      designation: "People Lead",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-03-01",
      userId: user._id,
    });

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({
      employeeId: "PRF-601",
      email: "profile@vorldx.demo",
      role: UserRole.HR,
    });
    expect(res.body.employee).toMatchObject({
      employeeId: "PRF-601",
      name: "Tanya Verma",
      department: "Human Resources",
    });
  });

  it("seed script creates demo admin, demo hr, and 25 employees across departments", async () => {
    await runSeed();

    const adminUser = await User.findOne({ employeeId: "ADM-001" });
    expect(adminUser).not.toBeNull();
    expect(adminUser?.role).toBe(UserRole.ADMIN);

    const hrUser = await User.findOne({ employeeId: "HR-001" });
    expect(hrUser).not.toBeNull();
    expect(hrUser?.role).toBe(UserRole.HR);

    const employeeCount = await Employee.countDocuments();
    // 25 employees + 1 admin employee + 1 hr employee = 27 total
    expect(employeeCount).toBeGreaterThanOrEqual(27);

    // Verify departments represented
    const departments = await Employee.distinct("department");
    expect(departments).toEqual(
      expect.arrayContaining([
        "Engineering",
        "Product",
        "Human Resources",
        "Marketing",
        "Operations",
      ])
    );
  });

  it("refuses to seed database when NODE_ENV is production and demo passwords are used", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAdminPass = process.env.ADMIN_DEFAULT_PASSWORD;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.ADMIN_DEFAULT_PASSWORD;

      await expect(runSeed()).rejects.toThrow(/Refusing to seed production database/);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalAdminPass) {
        process.env.ADMIN_DEFAULT_PASSWORD = originalAdminPass;
      }
    }
  });
});
