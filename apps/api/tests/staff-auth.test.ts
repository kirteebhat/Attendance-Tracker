import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import {
  User,
  Employee,
  StaffOtpChallenge,
  TrustedDevice,
  StaffSession,
  AuditEvent,
  hashPassword,
} from "../src/models";
import { staffAuthService } from "../src/services/staffAuth.service";
import { ApiErrorCode, UserRole, WorkType } from "@vorldx/shared";

describe("Staff Authentication & Security Engine", () => {
  const staffMobile = "+919876543210";
  const hrMobile = "+919876543211";
  const employeeMobile = "+919876543212";

  beforeEach(async () => {
    await User.deleteMany({});
    await Employee.deleteMany({});
    await StaffOtpChallenge.deleteMany({});
    await TrustedDevice.deleteMany({});
    await StaffSession.deleteMany({});
    await AuditEvent.deleteMany({});
  });

  async function createStaffUser(role: UserRole = UserRole.ADMIN, mobile = staffMobile) {
    const passwordHash = await hashPassword("AdminSecret123!");
    const user = await User.create({
      employeeId: role === UserRole.ADMIN ? "ADM-101" : "HR-101",
      email: `${role.toLowerCase()}@vorldx.demo`,
      mobileNumber: mobile,
      passwordHash,
      role,
      status: "ACTIVE",
    });

    const employee = await Employee.create({
      employeeId: user.employeeId,
      name: role === UserRole.ADMIN ? "Super Admin" : "HR Manager",
      email: user.email,
      mobileNumber: mobile,
      department: "Management",
      designation: "Executive",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-01-01",
      userId: user._id,
    });

    return { user, employee };
  }

  it("returns generic success response for unknown mobile numbers to prevent enumeration", async () => {
    const res = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: "+919999999999" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/If the mobile number is registered/i);
    expect(res.body.simulatedDemoOtp).toBeUndefined(); // Zero OTP created for unknown number
  });

  it("dispatches OTP for registered staff user and provides demo simulated code in non-production", async () => {
    await createStaffUser(UserRole.ADMIN, staffMobile);

    const res = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.simulatedDemoOtp).toBeDefined();
    expect(res.body.simulatedDemoOtp).toMatch(/^\d{6}$/);
    expect(res.body.expiresInSeconds).toBe(300);

    // Verify OTP challenge stored with HMAC hash in database
    const challenge = await StaffOtpChallenge.findOne({ mobileNumber: staffMobile });
    expect(challenge).toBeDefined();
    expect(challenge!.isConsumed).toBe(false);
    expect(challenge!.otpHash).not.toBe(res.body.simulatedDemoOtp); // Stored as hash, never plaintext
  });

  it("enforces a 60-second cooldown between OTP requests (rate-limiting)", async () => {
    await createStaffUser(UserRole.ADMIN, staffMobile);

    // First request succeeds
    const res1 = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });
    expect(res1.status).toBe(200);

    // Immediate second request within 60s must fail with 429
    const res2 = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    expect(res2.status).toBe(429);
    expect(res2.body.code).toBe(ApiErrorCode.ERR_OTP_COOLDOWN);
    expect(res2.body.message).toMatch(/wait.*second/i);
  });

  it("rejects wrong OTP with remaining attempt counter", async () => {
    await createStaffUser(UserRole.ADMIN, staffMobile);

    const startRes = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    expect(startRes.body.simulatedDemoOtp).toBeDefined();

    // Submit wrong OTP
    const res = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: "000000" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ApiErrorCode.ERR_INVALID_OTP);
    expect(res.body.message).toMatch(/2 attempt\(s\) remaining/i);

    const challenge = await StaffOtpChallenge.findOne({ mobileNumber: staffMobile });
    expect(challenge!.attempts).toBe(1);
  });

  it("locks out account after 3 consecutive failed OTP attempts (brute-force defense)", async () => {
    const { user } = await createStaffUser(UserRole.ADMIN, staffMobile);

    await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    // Attempt 1
    await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: "111111" });

    // Attempt 2
    await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: "222222" });

    // Attempt 3 -> Triggers lockout
    const lockRes = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: "333333" });

    expect(lockRes.status).toBe(423);
    expect(lockRes.body.code).toBe(ApiErrorCode.ERR_ACCOUNT_LOCKED);
    expect(lockRes.body.message).toMatch(/locked/i);

    // Verify user document has lockout timestamp
    const updatedUser = await User.findById(user._id);
    expect(updatedUser!.lockoutUntil).not.toBeNull();
    expect(updatedUser!.lockoutUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects expired OTP codes", async () => {
    await createStaffUser(UserRole.ADMIN, staffMobile);

    await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    // Fast-forward expiration in DB
    await StaffOtpChallenge.updateOne(
      { mobileNumber: staffMobile },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const res = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: "123456" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ApiErrorCode.ERR_OTP_EXPIRED);
  });

  it("enforces single-use OTP guarantee (rejects reused OTP)", async () => {
    await createStaffUser(UserRole.ADMIN, staffMobile);

    const startRes = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    const otp = startRes.body.simulatedDemoOtp;

    // First verification succeeds
    const verifyRes1 = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp });

    expect(verifyRes1.status).toBe(200);
    expect(verifyRes1.body.data.accessToken).toBeDefined();

    // Replay attack with same OTP must be rejected immediately
    const verifyRes2 = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp });

    expect(verifyRes2.status).toBe(401);
    expect(verifyRes2.body.code).toBe(ApiErrorCode.ERR_OTP_ALREADY_USED);
  });

  it("rejects non-staff roles from staff login flow (role check)", async () => {
    // Create regular EMPLOYEE with mobile number
    const passwordHash = await hashPassword("EmpPassword123!");
    const empUser = await User.create({
      employeeId: "EMP-201",
      email: "staff.worker@vorldx.demo",
      mobileNumber: employeeMobile,
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    expect(empUser._id).toBeDefined();

    // Requesting staff OTP on employee role returns generic enumeration-safe response
    // without creating an OTP challenge
    const res = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: employeeMobile });

    expect(res.status).toBe(200);
    expect(res.body.simulatedDemoOtp).toBeUndefined();

    const challenge = await StaffOtpChallenge.findOne({ mobileNumber: employeeMobile });
    expect(challenge).toBeNull(); // No challenge issued for standard non-staff employee
  });

  it("registers trusted device when rememberDevice flag is true", async () => {
    const { user } = await createStaffUser(UserRole.ADMIN, staffMobile);

    const startRes = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });

    const otp = startRes.body.simulatedDemoOtp;

    const verifyRes = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({
        mobileNumber: staffMobile,
        otp,
        deviceFingerprint: "hw_fingerprint_mac_9921",
        deviceName: "Kirtee MacBook Pro M3",
        platform: "macOS",
        rememberDevice: true,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.trustedDevice).toBeDefined();
    expect(verifyRes.body.data.trustedDevice.deviceFingerprint).toBe("hw_fingerprint_mac_9921");

    // Check TrustedDevice document
    const device = await TrustedDevice.findOne({ user: user._id });
    expect(device).toBeDefined();
    expect(device!.deviceName).toBe("Kirtee MacBook Pro M3");
    expect(device!.trustedUntil.getTime()).toBeGreaterThan(Date.now() + 25 * 86400000);
  });

  it("lists active sessions and revokes specific session", async () => {
    const { user } = await createStaffUser(UserRole.ADMIN, staffMobile);

    // Log in to create session
    const startRes = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });
    const verifyRes = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: startRes.body.simulatedDemoOtp });

    const token = verifyRes.body.data.accessToken;
    const sessionId = verifyRes.body.data.session.id;

    // List sessions
    const listRes = await request(app)
      .get("/api/auth/staff/sessions")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    // Revoke session
    const revokeRes = await request(app)
      .delete(`/api/auth/staff/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);

    const session = await StaffSession.findById(sessionId);
    expect(session!.isActive).toBe(false);
  });

  it("super admin can force logout an HR staff user and terminate their sessions", async () => {
    const { user: adminUser } = await createStaffUser(UserRole.ADMIN, staffMobile);
    const { user: hrUser } = await createStaffUser(UserRole.HR, hrMobile);

    // HR logs in
    const hrStart = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: hrMobile });
    const hrVerify = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: hrMobile, otp: hrStart.body.simulatedDemoOtp });

    const hrToken = hrVerify.body.data.accessToken;
    const hrSessionId = hrVerify.body.data.session.id;

    // Admin logs in
    const adminStart = await request(app)
      .post("/api/auth/staff/otp-start")
      .send({ mobileNumber: staffMobile });
    const adminVerify = await request(app)
      .post("/api/auth/staff/otp-verify")
      .send({ mobileNumber: staffMobile, otp: adminStart.body.simulatedDemoOtp });
    const adminToken = adminVerify.body.data.accessToken;

    // Admin executes force logout on HR user
    const forceRes = await request(app)
      .post(`/api/auth/staff/force-logout/${hrUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Security audit credential rotation" });

    expect(forceRes.status).toBe(200);
    expect(forceRes.body.success).toBe(true);

    // Verify HR session terminated in DB
    const session = await StaffSession.findById(hrSessionId);
    expect(session!.isActive).toBe(false);

    // HR user attempts to access protected staff endpoint with revoked session -> rejected
    const blockedRes = await request(app)
      .get("/api/auth/staff/sessions")
      .set("Authorization", `Bearer ${hrToken}`)
      .set("x-session-id", hrSessionId);

    expect(blockedRes.status).toBe(401);
    expect(blockedRes.body.code).toBe(ApiErrorCode.ERR_SESSION_REVOKED);
  });
});

