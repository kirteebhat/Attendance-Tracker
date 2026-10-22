import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { QrDisplay, QrToken, AuditEvent, User } from "../src/models";
import { ApiErrorCode, UserRole, TerminalStatus } from "@vorldx/shared";
import { env } from "../src/config/env";
import * as qrService from "../src/services/qr.service";

describe("Dynamic QR Code & Display Terminal Engine", () => {
  let adminToken: string;
  let hrToken: string;
  let employeeToken: string;

  beforeEach(async () => {
    await QrDisplay.deleteMany({});
    await QrToken.deleteMany({});
    await AuditEvent.deleteMany({});
    await User.deleteMany({});

    // 1. Admin
    const adminUser = await User.create({
      employeeId: "ADM-999",
      email: "admin999@vorldx.demo",
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
      employeeId: "HR-999",
      email: "hr999@vorldx.demo",
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

    // 3. Regular Employee
    const empUser = await User.create({
      employeeId: "EMP-999",
      email: "emp999@vorldx.demo",
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

  describe("Display Registration & Pairing Lifecycle", () => {
    it("allows HR to register a display, receive pairing code, and pairs display via one-time code", async () => {
      // 1. HR registers a new display
      const regRes = await request(app)
        .post("/api/displays")
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          name: "Main Lobby Display Screen",
          location: "Ground Floor Entrance",
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.data.terminalId).toBeDefined();
      expect(regRes.body.data.pairingCode).toMatch(/^VX-\d{4}$/);
      expect(regRes.body.data.status).toBe(TerminalStatus.UNPAIRED);
      expect(regRes.body.data.isPaired).toBe(false);

      const pairingCode = regRes.body.data.pairingCode;
      const displayId = regRes.body.data.terminalId;

      // 2. Display pairs using the pairing code
      const pairRes = await request(app).post("/api/displays/pair").send({ pairingCode });

      expect(pairRes.status).toBe(200);
      expect(pairRes.body.success).toBe(true);
      expect(pairRes.body.displayId).toBe(displayId);
      expect(pairRes.body.credential).toMatch(/^disp_cred_[a-f0-9]{64}$/);

      // Verify display credential hash is stored in DB
      const displayDoc = await QrDisplay.findOne({ terminalId: displayId });
      expect(displayDoc?.isPaired).toBe(true);
      expect(displayDoc?.status).toBe(TerminalStatus.ACTIVE);
      expect(displayDoc?.displayCredentialHash).toBeDefined();
      expect(displayDoc?.pairingCode).toBeUndefined(); // single-use consumed!

      // 3. Re-using the same pairing code must fail with 400 ERR_INVALID_PAIRING_CODE
      const secondPairRes = await request(app).post("/api/displays/pair").send({ pairingCode });

      expect(secondPairRes.status).toBe(400);
      expect(secondPairRes.body.code).toBe(ApiErrorCode.ERR_INVALID_PAIRING_CODE);

      // 4. HR lists displays and sees status and lastSeen
      const listRes = await request(app)
        .get("/api/displays")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].status).toBe(TerminalStatus.ACTIVE);
      expect(listRes.body.data[0].lastSeen).toBeDefined();

      // 5. AuditEvent recorded for registration
      const audit = await AuditEvent.findOne({ entityType: "TERMINAL", action: "CREATE" });
      expect(audit).toBeDefined();
    });

    it("blocks standard employees from managing displays with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .post("/api/displays")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          name: "Unauthorized Terminal",
          location: "Secret Location",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });
  });

  describe("Display Authentication & Rotating Challenges", () => {
    it("rejects unauthorized displays with 401 ERR_TERMINAL_UNAUTHORIZED", async () => {
      // 1. Missing credentials
      const resNoCreds = await request(app).get("/api/displays/token");
      expect(resNoCreds.status).toBe(401);
      expect(resNoCreds.body.code).toBe(ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED);

      // 2. Non-existent display ID
      const resFakeDisplay = await request(app)
        .get("/api/displays/token")
        .set("x-display-id", "disp_nonexistent")
        .set("x-display-credential", "fake_credential_value");
      expect(resFakeDisplay.status).toBe(401);
      expect(resFakeDisplay.body.code).toBe(ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED);

      // 3. Valid display ID with wrong credential
      const reg = await qrService.registerDisplay({ name: "Screen 1", location: "Lobby" });
      const pair = await qrService.pairDisplay(reg.pairingCode!);

      const resWrongSecret = await request(app)
        .get("/api/displays/token")
        .set("x-display-id", pair.displayId)
        .set("x-display-credential", "disp_cred_wrong_secret_12345");
      expect(resWrongSecret.status).toBe(401);
      expect(resWrongSecret.body.code).toBe(ApiErrorCode.ERR_TERMINAL_UNAUTHORIZED);
    });

    it("issues rotating short-lived opaque QR challenges without sensitive employee data", async () => {
      const reg = await qrService.registerDisplay({ name: "Screen 1", location: "Lobby" });
      const pair = await qrService.pairDisplay(reg.pairingCode!);

      const res = await request(app)
        .get("/api/displays/token")
        .set("x-display-id", pair.displayId)
        .set("x-display-credential", pair.credential);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toMatch(/^qrt_/);
      expect(res.body.displayId).toBe(pair.displayId);
      expect(res.body.ttlSeconds).toBe(45); // Default 45 seconds

      // Verify token contains no sensitive employee data or passwords
      expect(res.body.token).not.toContain("password");
      expect(res.body.token).not.toContain("email");
      expect(res.body.token).not.toContain("EMP-");
      expect(res.body.token).not.toContain(pair.credential);

      // Token must exist in QrToken collection
      const storedToken = await QrToken.findOne({ token: res.body.token });
      expect(storedToken).toBeDefined();
      expect(storedToken?.displayId).toBe(pair.displayId);
      expect(storedToken?.isRevoked).toBe(false);
    });
  });

  describe("QR Validation Service & Security Guarantees", () => {
    it("successfully validates an active QR challenge token", async () => {
      const reg = await qrService.registerDisplay({ name: "Lobby Screen", location: "Lobby" });
      const pair = await qrService.pairDisplay(reg.pairingCode!);
      const challenge = await qrService.requestRotatingChallenge(pair.displayId, pair.credential);

      // Call validation service directly
      const result = await qrService.validateQrToken(challenge.token);
      expect(result.isValid).toBe(true);
      expect(result.displayId).toBe(pair.displayId);
      expect(result.display?.name).toBe("Lobby Screen");

      // Test validation endpoint
      const apiRes = await request(app)
        .post("/api/displays/validate")
        .send({ token: challenge.token });
      expect(apiRes.status).toBe(200);
      expect(apiRes.body.success).toBe(true);
      expect(apiRes.body.displayId).toBe(pair.displayId);
    });

    it("rejects forged or tampered QR tokens", async () => {
      const forgedToken = "qrt_completely_fake_forged_random_token_1234567890";
      const result = await qrService.validateQrToken(forgedToken);

      expect(result.isValid).toBe(false);
      expect(result.code).toBe(ApiErrorCode.ERR_INVALID_QR_TOKEN);

      const apiRes = await request(app).post("/api/displays/validate").send({ token: forgedToken });
      expect(apiRes.status).toBe(400);
      expect(apiRes.body.code).toBe(ApiErrorCode.ERR_INVALID_QR_TOKEN);
    });

    it("rejects expired QR tokens with ERR_QR_EXPIRED", async () => {
      const reg = await qrService.registerDisplay({ name: "Lobby Screen", location: "Lobby" });
      const pair = await qrService.pairDisplay(reg.pairingCode!);
      const challenge = await qrService.requestRotatingChallenge(pair.displayId, pair.credential);

      // Manually simulate expiration in the past
      await QrToken.updateOne(
        { token: challenge.token },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const result = await qrService.validateQrToken(challenge.token);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe(ApiErrorCode.ERR_QR_EXPIRED);

      const apiRes = await request(app)
        .post("/api/displays/validate")
        .send({ token: challenge.token });
      expect(apiRes.status).toBe(400);
      expect(apiRes.body.code).toBe(ApiErrorCode.ERR_QR_EXPIRED);
    });

    it("rejects tokens and token requests when a display is disabled", async () => {
      const reg = await qrService.registerDisplay({ name: "Lobby Screen", location: "Lobby" });
      const pair = await qrService.pairDisplay(reg.pairingCode!);
      const challenge = await qrService.requestRotatingChallenge(pair.displayId, pair.credential);

      // HR disables the display
      const disableRes = await request(app)
        .patch(`/api/displays/${pair.displayId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false, reason: "Screen maintenance" });

      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.status).toBe(TerminalStatus.DISABLED);
      expect(disableRes.body.data.isActive).toBe(false);

      // 1. Disabled display can no longer request new tokens
      const tokenRes = await request(app)
        .get("/api/displays/token")
        .set("x-display-id", pair.displayId)
        .set("x-display-credential", pair.credential);

      expect(tokenRes.status).toBe(403);
      expect(tokenRes.body.code).toBe(ApiErrorCode.ERR_DISPLAY_DISABLED);

      // 2. Tokens previously issued by the disabled display fail validation
      const valResult = await qrService.validateQrToken(challenge.token);
      expect(valResult.isValid).toBe(false);
      expect(valResult.code).toBe(ApiErrorCode.ERR_DISPLAY_DISABLED);
    });

    it("rejects tokens and token requests when a display is revoked", async () => {
      const reg = await qrService.registerDisplay({ name: "Lobby Screen", location: "Lobby" });
      const pair = await qrService.pairDisplay(reg.pairingCode!);
      const challenge = await qrService.requestRotatingChallenge(pair.displayId, pair.credential);

      // HR revokes the display
      const revokeRes = await request(app)
        .post(`/api/displays/${pair.displayId}/revoke`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ reason: "Display hardware compromised" });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.data.status).toBe(TerminalStatus.REVOKED);
      expect(revokeRes.body.data.isActive).toBe(false);

      // 1. Revoked display can no longer request new tokens
      const tokenRes = await request(app)
        .get("/api/displays/token")
        .set("x-display-id", pair.displayId)
        .set("x-display-credential", pair.credential);

      expect(tokenRes.status).toBe(401); // Credential hash was wiped

      // 2. Tokens previously issued by the revoked display stop being valid
      const valResult = await qrService.validateQrToken(challenge.token);
      expect(valResult.isValid).toBe(false);
      expect(
        valResult.code === ApiErrorCode.ERR_QR_REVOKED ||
          valResult.code === ApiErrorCode.ERR_DISPLAY_REVOKED
      ).toBe(true);

      // 3. Revoked display cannot simply be re-enabled without reauthorization
      const reEnableRes = await request(app)
        .patch(`/api/displays/${pair.displayId}/status`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ isActive: true });

      expect(reEnableRes.status).toBe(400);
      expect(reEnableRes.body.code).toBe(ApiErrorCode.ERR_DISPLAY_REVOKED);

      // 4. Reauthorizing generates a new pairing code
      const authRes = await request(app)
        .post(`/api/displays/${pair.displayId}/authorize`)
        .set("Authorization", `Bearer ${hrToken}`);

      expect(authRes.status).toBe(200);
      expect(authRes.body.data.pairingCode).toMatch(/^VX-\d{4}$/);
      expect(authRes.body.data.status).toBe(TerminalStatus.UNPAIRED);
    });
  });
});
