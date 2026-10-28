import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { FeatureFlag } from "../src/models/FeatureFlag";
import { featureFlagService } from "../src/services/featureFlag.service";
import { env } from "../src/config/env";
import { UserRole } from "@vorldx/shared";
import { Types } from "mongoose";

describe("Enterprise Feature Flag System (Database & Env Backed)", () => {
  let adminToken: string;
  let hrToken: string;
  let empToken: string;

  beforeEach(async () => {
    featureFlagService.clearInMemoryOverrides();
    if (mongoose.connection.readyState === 1) {
      await FeatureFlag.deleteMany({});
      await featureFlagService.initializeDefaultFlags();
    }

    const adminId = new Types.ObjectId().toString();
    const hrId = new Types.ObjectId().toString();
    const empId = new Types.ObjectId().toString();

    adminToken = jwt.sign(
      { userId: adminId, employeeId: "ADM-999", email: "admin@vorldx.demo", role: UserRole.ADMIN },
      env.JWT_SECRET
    );
    hrToken = jwt.sign(
      { userId: hrId, employeeId: "HR-999", email: "hr@vorldx.demo", role: UserRole.HR },
      env.JWT_SECRET
    );
    empToken = jwt.sign(
      { userId: empId, employeeId: "EMP-999", email: "emp@vorldx.demo", role: UserRole.EMPLOYEE },
      env.JWT_SECRET
    );
  });

  it("GET /api/feature-flags returns all active feature flags defaulting to false", async () => {
    const res = await request(app).get("/api/feature-flags");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      leave: false,
      announcements: false,
      enquiries: false,
      calendarImport: false,
      threeD: false,
      otaUpdates: false,
    });
  });

  it("returns 404 for protected extension modules when their feature flag is disabled", async () => {
    // 1. Leave module when flag is false
    const leaveRes = await request(app)
      .get("/api/leave/requests")
      .set("Authorization", `Bearer ${empToken}`);
    expect(leaveRes.status).toBe(404);
    expect(leaveRes.body.code).toBe("ERR_NOT_FOUND");
    expect(leaveRes.body.message).toContain("leave");

    // 2. Announcements module when flag is false
    const announceRes = await request(app)
      .get("/api/announcements")
      .set("Authorization", `Bearer ${empToken}`);
    expect(announceRes.status).toBe(404);

    // 3. Enquiries module when flag is false
    const enquiryRes = await request(app)
      .get("/api/enquiries")
      .set("Authorization", `Bearer ${empToken}`);
    expect(enquiryRes.status).toBe(404);

    // 4. OTA module when flag is false
    const otaRes = await request(app).get("/api/ota/manifest");
    expect(otaRes.status).toBe(404);
  });

  it("blocks non-admin users from updating feature flags with 403 Forbidden", async () => {
    const empAttempt = await request(app)
      .patch("/api/admin/feature-flags")
      .set("Authorization", `Bearer ${empToken}`)
      .send({ key: "leave", enabled: true });
    expect(empAttempt.status).toBe(403);

    const hrAttempt = await request(app)
      .patch("/api/admin/feature-flags")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ key: "leave", enabled: true });
    expect(hrAttempt.status).toBe(403);
  });

  it("allows Admin to toggle flag on, and makes module return 200", async () => {
    // 1. Admin enables 'leave' flag
    const toggleRes = await request(app)
      .patch("/api/admin/feature-flags")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "leave",
        enabled: true,
        reason: "Enabling leave management for enterprise beta test",
      });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.success).toBe(true);
    expect(toggleRes.body.data.enabled).toBe(true);

    // 2. The leave module now returns 200 instead of 404
    const leaveActiveRes = await request(app)
      .get("/api/leave/requests")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(leaveActiveRes.status).toBe(200);
    expect(leaveActiveRes.body.success).toBe(true);

    // 3. Admin toggles flag back off
    await request(app)
      .patch("/api/admin/feature-flags")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        key: "leave",
        enabled: false,
        reason: "Disabling leave module after testing",
      });

    // 4. Module immediately returns 404 again
    const leaveDisabledRes = await request(app)
      .get("/api/leave/requests")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(leaveDisabledRes.status).toBe(404);
  });

  it("allows Admin and HR to inspect detailed feature flag metadata via GET /api/admin/feature-flags", async () => {
    const res = await request(app)
      .get("/api/admin/feature-flags")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(6);
    expect(res.body.data[0]).toHaveProperty("key");
    expect(res.body.data[0]).toHaveProperty("enabled");
  });
});
