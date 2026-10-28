import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { AppRelease, User, Employee, AuditEvent } from "../src/models";
import { featureFlagService } from "../src/services/featureFlag.service";
import { env } from "../src/config/env";
import { UserRole, compareSemver, isVersionOlder, isBelowMinSupportedVersion } from "@vorldx/shared";

describe("OTA Updates & App Releases Subsystem (apps/api)", () => {
  let adminToken: string;
  let hrToken: string;
  let employeeToken: string;

  let adminUserId: string;
  let hrUserId: string;
  let employeeUserId: string;

  beforeEach(async () => {
    await AppRelease.deleteMany({});
    await AuditEvent.deleteMany({});
    await User.deleteMany({});
    await Employee.deleteMany({});

    featureFlagService.clearInMemoryOverrides();
    // Enable otaUpdates flag by default for tests
    featureFlagService.setInMemoryOverride("otaUpdates", true);

    // 1. Seed Admin
    const adminUser = await User.create({
      employeeId: "ADM-999",
      email: "admin.updates@vorldx.test",
      passwordHash: "hash_adm",
      role: UserRole.ADMIN,
      status: "ACTIVE",
    });
    adminUserId = adminUser._id.toString();
    adminToken = jwt.sign(
      { userId: adminUserId, employeeId: "ADM-999", email: adminUser.email, role: UserRole.ADMIN },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Seed HR
    const hrUser = await User.create({
      employeeId: "HR-999",
      email: "hr.updates@vorldx.test",
      passwordHash: "hash_hr",
      role: UserRole.HR,
      status: "ACTIVE",
    });
    hrUserId = hrUser._id.toString();
    hrToken = jwt.sign(
      { userId: hrUserId, employeeId: "HR-999", email: hrUser.email, role: UserRole.HR },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. Seed Employee
    const empUser = await User.create({
      employeeId: "EMP-999",
      email: "emp.updates@vorldx.test",
      passwordHash: "hash_emp",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    employeeUserId = empUser._id.toString();
    employeeToken = jwt.sign(
      { userId: employeeUserId, employeeId: "EMP-999", email: empUser.email, role: UserRole.EMPLOYEE },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  describe("Semver Comparison Utilities", () => {
    it("correctly identifies version order and equality", () => {
      expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
      expect(compareSemver("1.2.0", "1.1.9")).toBe(1);
      expect(compareSemver("v2.0.0", "2.0.0")).toBe(0);
      expect(compareSemver("1.0.0", "1.0.0-beta.1")).toBe(0);

      expect(isVersionOlder("1.0.0", "1.0.1")).toBe(true);
      expect(isVersionOlder("1.0.1", "1.0.0")).toBe(false);
      expect(isVersionOlder("1.0.0", "1.0.0")).toBe(false);

      expect(isBelowMinSupportedVersion("0.9.5", "1.0.0")).toBe(true);
      expect(isBelowMinSupportedVersion("1.0.0", "1.0.0")).toBe(false);
      expect(isBelowMinSupportedVersion("1.2.0", "1.0.0")).toBe(false);
    });
  });

  describe("Feature Flag Guarding", () => {
    it("returns otaUpdatesEnabled: false and updateAvailable: false when flag is off", async () => {
      featureFlagService.setInMemoryOverride("otaUpdates", false);

      const res = await request(app)
        .get("/api/updates/check")
        .query({ platform: "MOBILE", currentVersion: "1.0.0" });

      expect(res.status).toBe(200);
      expect(res.body.otaUpdatesEnabled).toBe(false);
      expect(res.body.updateAvailable).toBe(false);
    });

    it("blocks release publishing with 404 when otaUpdates flag is off", async () => {
      featureFlagService.setInMemoryOverride("otaUpdates", false);

      const res = await request(app)
        .post("/api/updates/releases")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          platform: "MOBILE",
          version: "2.0.0",
          minSupportedVersion: "1.0.0",
          notes: "Major update with overhaul",
          forceUpdate: false,
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("ERR_NOT_FOUND");
    });
  });

  describe("GET /api/updates/check", () => {
    beforeEach(async () => {
      // Seed an active release for MOBILE
      await AppRelease.create({
        platform: "MOBILE",
        version: "2.1.0",
        versionCode: 21,
        minSupportedVersion: "2.0.0",
        minSupportedVersionCode: 20,
        notes: "Performance improvements and biometric fixes",
        downloadUrl: "https://example.com/app.apk",
        forceUpdate: false,
        channel: "production",
        isPublished: true,
        publishedAt: new Date(),
      });
    });

    it("reports no update available when client is on latest version", async () => {
      const res = await request(app)
        .get("/api/updates/check")
        .query({ platform: "MOBILE", currentVersion: "2.1.0", channel: "production" });

      expect(res.status).toBe(200);
      expect(res.body.updateAvailable).toBe(false);
      expect(res.body.forceUpdate).toBe(false);
      expect(res.body.latestVersion).toBe("2.1.0");
    });

    it("reports non-forced update when client is on supported older version", async () => {
      const res = await request(app)
        .get("/api/updates/check")
        .query({ platform: "MOBILE", currentVersion: "2.0.5", channel: "production" });

      expect(res.status).toBe(200);
      expect(res.body.updateAvailable).toBe(true);
      expect(res.body.forceUpdate).toBe(false);
      expect(res.body.latestVersion).toBe("2.1.0");
      expect(res.body.notes).toContain("Performance improvements");
    });

    it("reports forced update when client is below minSupportedVersion", async () => {
      const res = await request(app)
        .get("/api/updates/check")
        .query({ platform: "MOBILE", currentVersion: "1.9.0", channel: "production" });

      expect(res.status).toBe(200);
      expect(res.body.updateAvailable).toBe(true);
      expect(res.body.forceUpdate).toBe(true);
      expect(res.body.minSupportedVersion).toBe("2.0.0");
    });

    it("reports forced update when release has forceUpdate=true explicitly", async () => {
      await AppRelease.create({
        platform: "ANDROID",
        version: "3.0.0",
        versionCode: 30,
        minSupportedVersion: "1.0.0",
        minSupportedVersionCode: 1,
        notes: "Security vulnerability hotfix",
        forceUpdate: true,
        channel: "production",
        isPublished: true,
        publishedAt: new Date(Date.now() + 1000),
      });

      const res = await request(app)
        .get("/api/updates/check")
        .query({ platform: "ANDROID", currentVersion: "2.5.0", channel: "production" });

      expect(res.status).toBe(200);
      expect(res.body.updateAvailable).toBe(true);
      expect(res.body.forceUpdate).toBe(true);
      expect(res.body.latestVersion).toBe("3.0.0");
    });
  });

  describe("POST /api/updates/releases (Publish Release)", () => {
    it("rejects unauthorized and non-admin requests", async () => {
      // Unauthenticated
      const unauth = await request(app)
        .post("/api/updates/releases")
        .send({
          platform: "WEB",
          version: "1.3.0",
          notes: "Web patch notes",
        });
      expect(unauth.status).toBe(401);

      // Employee
      const emp = await request(app)
        .post("/api/updates/releases")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          platform: "WEB",
          version: "1.3.0",
          notes: "Web patch notes",
        });
      expect(emp.status).toBe(403);
    });

    it("successfully publishes a release and logs audit event", async () => {
      const res = await request(app)
        .post("/api/updates/releases")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          platform: "WEB",
          version: "1.3.0",
          versionCode: 13,
          minSupportedVersion: "1.0.0",
          notes: "Added real-time announcement ticker and notification drawer",
          forceUpdate: false,
          channel: "production",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.version).toBe("1.3.0");
      expect(res.body.data.platform).toBe("WEB");

      // Verify audit log
      const audit = await AuditEvent.findOne({
        entityType: "APP_RELEASE",
        action: "PUBLISH_APP_RELEASE",
      });
      expect(audit).not.toBeNull();
      expect(audit?.performedByEmployeeId).toBe("ADM-999");
    });

    it("rejects invalid semver or minSupportedVersion > version", async () => {
      const res = await request(app)
        .post("/api/updates/releases")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          platform: "DISPLAY",
          version: "1.0.0",
          minSupportedVersion: "2.0.0", // Invalid: min is higher than version
          notes: "Invalid version hierarchy",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/updates/releases (List Releases)", () => {
    beforeEach(async () => {
      await AppRelease.create([
        {
          platform: "MOBILE",
          version: "1.0.0",
          versionCode: 1,
          minSupportedVersion: "1.0.0",
          notes: "Initial launch",
          channel: "production",
          isPublished: true,
        },
        {
          platform: "DISPLAY",
          version: "1.0.0",
          versionCode: 1,
          minSupportedVersion: "1.0.0",
          notes: "Kiosk initial release",
          channel: "production",
          isPublished: true,
        },
      ]);
    });

    it("allows HR and Admin to list releases with platform filter", async () => {
      const res = await request(app)
        .get("/api/updates/releases")
        .set("Authorization", `Bearer ${hrToken}`)
        .query({ platform: "MOBILE" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].platform).toBe("MOBILE");
    });
  });

  describe("GET /api/version (Deployment Version Endpoint)", () => {
    it("returns version and build information for web/display polling", async () => {
      const res = await request(app).get("/api/version");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.version).toBeDefined();
      expect(res.body.otaUpdatesEnabled).toBe(true);
    });
  });
});
