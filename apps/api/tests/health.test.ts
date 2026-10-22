import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { ApiErrorCode } from "@vorldx/shared";

describe("Express API Foundation & Health Check", () => {
  it("GET /health returns 200 with service information and database status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.body).toMatchObject({
      service: "vorldx-attendance-api",
      version: "0.1.0",
      environment: "test",
    });
    expect(res.body.status).toMatch(/^(ok|degraded)$/);
    expect(res.body.database).toBeDefined();
    expect(res.body.database.readyState).toBeTypeOf("number");
    expect(res.body.memory).toHaveProperty("rssMb");
    expect(res.body.uptimeSeconds).toBeTypeOf("number");
    expect(res.body.timestamp).toBeDefined();
  });

  it("AppError returns standardized error response shape", async () => {
    const res = await request(app).get("/api/test-error");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: ApiErrorCode.ERR_BAD_REQUEST,
      message: "Simulated domain error for test verification",
      errors: {
        detail: "Test error details",
      },
    });
    expect(res.body.requestId).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.headers["x-request-id"]).toBe(res.body.requestId);
  });

  it("404 handler returns standardized error response shape", async () => {
    const res = await request(app).get("/api/routes-that-do-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      code: ApiErrorCode.ERR_NOT_FOUND,
    });
    expect(res.body.message).toContain("Cannot GET /api/routes-that-do-not-exist");
    expect(res.body.requestId).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it("Zod validation middleware rejects invalid input with ERR_INVALID_INPUT and field errors", async () => {
    const res = await request(app)
      .post("/api/test-validation")
      .send({ employeeId: "VX", email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      code: ApiErrorCode.ERR_INVALID_INPUT,
      message: "Request validation failed",
    });
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "employeeId" }),
        expect.objectContaining({ field: "email" }),
      ])
    );
  });
});
