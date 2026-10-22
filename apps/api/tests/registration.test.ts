import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../src/app";
import { Employee, User, RegistrationOtp } from "../src/models";
import { ApiErrorCode, UserRole, WorkType } from "@vorldx/shared";
import { env } from "../src/config/env";

describe("Employee Self-Registration Engine", () => {
  beforeEach(async () => {
    await RegistrationOtp.deleteMany({});
    await User.deleteMany({});
    await Employee.deleteMany({});
  });

  it("rejects register-start for unknown employee ID with 404 ERR_EMPLOYEE_NOT_FOUND", async () => {
    const res = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "NON-EXISTENT-999" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND);
    expect(res.body.message).toContain("Employee ID does not exist");
  });

  it("rejects register-start for inactive employee with 403 ERR_EMPLOYEE_INACTIVE", async () => {
    await Employee.create({
      employeeId: "EMP-INACTIVE",
      name: "Inactive Employee",
      email: "inactive@vorldx.demo",
      department: "Engineering",
      designation: "Former Associate",
      workType: WorkType.FULL_TIME,
      joiningDate: "2023-01-01",
      isActive: false, // Inactive employee
    });

    const res = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-INACTIVE" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_EMPLOYEE_INACTIVE);
    expect(res.body.message).toContain("Employee profile is inactive");
  });

  it("rejects register-start for already registered employee with 409 ERR_ACCOUNT_ALREADY_REGISTERED", async () => {
    const existingUser = await User.create({
      employeeId: "EMP-EXISTS",
      email: "exists@vorldx.demo",
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    await Employee.create({
      employeeId: "EMP-EXISTS",
      name: "Existing Employee",
      email: "exists@vorldx.demo",
      department: "Engineering",
      designation: "Full Stack Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2023-05-01",
      isActive: true,
      userId: existingUser._id,
    });

    const res = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-EXISTS" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED);
    expect(res.body.message).toContain("Account is already registered");
  });

  it("generates 6-digit OTP, stores only hash in DB, and includes simulated OTP in demo mode", async () => {
    await Employee.create({
      employeeId: "EMP-DEMO-01",
      name: "Demo Worker",
      email: "demo.worker@vorldx.demo",
      department: "Product",
      designation: "Product Associate",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-01-15",
      isActive: true,
    });

    const res = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-DEMO-01" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.employeeId).toBe("EMP-DEMO-01");
    expect(res.body.email).toBe("demo.worker@vorldx.demo");
    expect(res.body.simulatedDemoOtp).toBeDefined();
    expect(res.body.simulatedDemoOtp).toMatch(/^\d{6}$/);
    expect(res.body.demoNotice).toContain("SIMULATED OTP FOR DEMO ENVIRONMENT ONLY");

    const plainOtp = res.body.simulatedDemoOtp;

    // Verify DB record: plain-text OTP must NEVER be stored in the database!
    const otpDoc = await RegistrationOtp.findOne({ employeeId: "EMP-DEMO-01" });
    expect(otpDoc).not.toBeNull();
    expect(otpDoc?.hashedCode).not.toBe(plainOtp);
    // Hashed code must be a valid bcrypt hash verified against plain-text OTP
    const isBcryptMatch = await bcrypt.compare(plainOtp, otpDoc!.hashedCode);
    expect(isBcryptMatch).toBe(true);
    expect(otpDoc?.attempts).toBe(0);
    expect(otpDoc?.isUsed).toBe(false);
  });

  it("never returns simulated OTP when in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDemoMode = env.DEMO_OTP_MODE;

    try {
      // Force production mode
      (env as { NODE_ENV: string }).NODE_ENV = "production";

      await Employee.create({
        employeeId: "EMP-PROD-01",
        name: "Prod Worker",
        email: "prod.worker@vorldx.demo",
        department: "Marketing",
        designation: "Growth Lead",
        workType: WorkType.FULL_TIME,
        joiningDate: "2024-02-01",
        isActive: true,
      });

      const res = await request(app)
        .post("/api/auth/register-start")
        .send({ employeeId: "EMP-PROD-01" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.simulatedDemoOtp).toBeUndefined();
      expect(res.body.demoNotice).toBeUndefined();
      expect(res.body.message).toContain("sent to registered employee email");
    } finally {
      (env as { NODE_ENV: string }).NODE_ENV = originalEnv;
      (env as { DEMO_OTP_MODE: boolean }).DEMO_OTP_MODE = originalDemoMode;
    }
  });

  it("rejects wrong OTP with 400 ERR_INVALID_OTP and increments attempts counter", async () => {
    await Employee.create({
      employeeId: "EMP-WRONG-OTP",
      name: "Check Attempts",
      email: "wrong.otp@vorldx.demo",
      department: "Operations",
      designation: "Support Lead",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-03-01",
      isActive: true,
    });

    // 1. Start registration
    await request(app).post("/api/auth/register-start").send({ employeeId: "EMP-WRONG-OTP" });

    // 2. Submit wrong OTP
    const res = await request(app).post("/api/auth/register-verify").send({
      employeeId: "EMP-WRONG-OTP",
      otp: "000000",
      password: "Password123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_INVALID_OTP);
    expect(res.body.message).toContain("Incorrect verification code");

    const otpDoc = await RegistrationOtp.findOne({ employeeId: "EMP-WRONG-OTP" });
    expect(otpDoc?.attempts).toBe(1);
  });

  it("enforces attempt limit and invalidates OTP after maximum failures", async () => {
    await Employee.create({
      employeeId: "EMP-MAX-ATTEMPTS",
      name: "Max Attempts User",
      email: "max.attempts@vorldx.demo",
      department: "Human Resources",
      designation: "HR Associate",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-03-15",
      isActive: true,
    });

    // Start registration
    await request(app).post("/api/auth/register-start").send({ employeeId: "EMP-MAX-ATTEMPTS" });

    // Fail 1st attempt
    const res1 = await request(app).post("/api/auth/register-verify").send({
      employeeId: "EMP-MAX-ATTEMPTS",
      otp: "111111",
      password: "Password123!",
    });
    expect(res1.status).toBe(400);
    expect(res1.body.code).toBe(ApiErrorCode.ERR_INVALID_OTP);

    // Fail 2nd attempt
    const res2 = await request(app).post("/api/auth/register-verify").send({
      employeeId: "EMP-MAX-ATTEMPTS",
      otp: "222222",
      password: "Password123!",
    });
    expect(res2.status).toBe(400);
    expect(res2.body.code).toBe(ApiErrorCode.ERR_INVALID_OTP);

    // Fail 3rd attempt (hits OTP_MAX_ATTEMPTS = 3)
    const res3 = await request(app).post("/api/auth/register-verify").send({
      employeeId: "EMP-MAX-ATTEMPTS",
      otp: "333333",
      password: "Password123!",
    });
    expect(res3.status).toBe(400);
    expect(res3.body.code).toBe(ApiErrorCode.ERR_OTP_ATTEMPTS_EXCEEDED);
    expect(res3.body.message).toContain("Maximum verification attempts exceeded");

    // Verify OTP document has been deleted/purged
    const otpDoc = await RegistrationOtp.findOne({ employeeId: "EMP-MAX-ATTEMPTS" });
    expect(otpDoc).toBeNull();
  });

  it("rejects expired OTP with 400 ERR_OTP_EXPIRED", async () => {
    await Employee.create({
      employeeId: "EMP-EXPIRED-OTP",
      name: "Expired OTP User",
      email: "expired.otp@vorldx.demo",
      department: "Engineering",
      designation: "QA Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-04-01",
      isActive: true,
    });

    const startRes = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-EXPIRED-OTP" });

    const plainOtp = startRes.body.simulatedDemoOtp;

    // Simulate OTP expiration in database
    await RegistrationOtp.updateOne(
      { employeeId: "EMP-EXPIRED-OTP" },
      { $set: { expiresAt: new Date(Date.now() - 5000) } }
    );

    const res = await request(app).post("/api/auth/register-verify").send({
      employeeId: "EMP-EXPIRED-OTP",
      otp: plainOtp,
      password: "ValidPassword123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe(ApiErrorCode.ERR_OTP_EXPIRED);
    expect(res.body.message).toContain("expired");
  });

  it("successfully registers employee, creates User account, links Employee, and allows login", async () => {
    const employee = await Employee.create({
      employeeId: "EMP-SUCCESS-99",
      name: "Suresh Pillai",
      email: "suresh.pillai@vorldx.demo",
      department: "Engineering",
      designation: "Senior Cloud Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-04-10",
      isActive: true,
    });

    // 1. Request registration OTP
    const startRes = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-SUCCESS-99" });

    expect(startRes.status).toBe(200);
    const simulatedOtp = startRes.body.simulatedDemoOtp;
    expect(simulatedOtp).toBeDefined();

    // 2. Verify OTP and set password
    const newPassword = "MyStrongSecurePassword123!";
    const verifyRes = await request(app).post("/api/auth/register-verify").send({
      employeeId: "EMP-SUCCESS-99",
      otp: simulatedOtp,
      password: newPassword,
    });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.refreshToken).toBeDefined();
    expect(verifyRes.body.user).toMatchObject({
      employeeId: "EMP-SUCCESS-99",
      email: "suresh.pillai@vorldx.demo",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    expect(verifyRes.body.employee).toMatchObject({
      employeeId: "EMP-SUCCESS-99",
      name: "Suresh Pillai",
      department: "Engineering",
    });

    // Verify OTP single-use: record must be purged
    const remainingOtp = await RegistrationOtp.findOne({ employeeId: "EMP-SUCCESS-99" });
    expect(remainingOtp).toBeNull();

    // Verify Employee document updated with userId
    const updatedEmployee = await Employee.findById(employee._id);
    expect(updatedEmployee?.userId).toBeDefined();

    // 3. Verify user can now log in via standard POST /api/auth/login using their new password!
    const loginRes = await request(app).post("/api/auth/login").send({
      employeeId: "EMP-SUCCESS-99",
      password: newPassword,
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();

    // 4. Verify user can access GET /api/auth/me with access token
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.user.employeeId).toBe("EMP-SUCCESS-99");
    expect(meRes.body.employee.name).toBe("Suresh Pillai");
  });

  it("supports multi-step mobile registration: OTP verification followed by register-complete with verification token", async () => {
    await Employee.create({
      employeeId: "EMP-MOBILE-01",
      name: "Mobile Worker",
      email: "mobile.worker@vorldx.demo",
      department: "Mobile Team",
      designation: "React Native Specialist",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-05-01",
      isActive: true,
    });

    // Step 1: Start registration
    const startRes = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-MOBILE-01" });

    expect(startRes.status).toBe(200);
    const otp = startRes.body.simulatedDemoOtp;
    expect(otp).toBeDefined();

    // Step 2: Verify OTP without password (mobile UI Step 2)
    const verifyOtpRes = await request(app)
      .post("/api/auth/register-verify")
      .send({ employeeId: "EMP-MOBILE-01", otp });

    expect(verifyOtpRes.status).toBe(200);
    expect(verifyOtpRes.body.success).toBe(true);
    expect(verifyOtpRes.body.data.verificationToken).toBeDefined();
    const token = verifyOtpRes.body.data.verificationToken;

    // Step 3: Complete registration with verification token and password (mobile UI Step 3)
    const completeRes = await request(app)
      .post("/api/auth/register-complete")
      .send({
        employeeId: "EMP-MOBILE-01",
        verificationToken: token,
        password: "MobileSecure@123",
      });

    expect(completeRes.status).toBe(201);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.accessToken).toBeDefined();
    expect(completeRes.body.refreshToken).toBeDefined();
    expect(completeRes.body.user.employeeId).toBe("EMP-MOBILE-01");

    // Login with new credentials
    const loginRes = await request(app).post("/api/auth/login").send({
      employeeId: "EMP-MOBILE-01",
      password: "MobileSecure@123",
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.employeeId).toBe("EMP-MOBILE-01");
  });
});
