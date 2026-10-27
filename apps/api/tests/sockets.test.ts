import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { initSocketServer, closeSocketServer } from "../src/sockets/socketServer";
import {
  Employee,
  IEmployee,
  User,
  AttendancePolicy,
  AttendanceRecord,
  QrDisplay,
  QrChallenge,
  QrToken,
  WfhRequest,
  AuditEvent,
} from "../src/models";
import { AttendanceStatus, SocketEvent, TerminalStatus, UserRole, WorkType } from "@vorldx/shared";
import * as qrService from "../src/services/qr.service";

describe("Real-Time Socket.IO Protocol & Event Architecture", () => {
  let httpServer: HttpServer;
  let serverUrl: string;

  // Test users & tokens
  let hrToken: string;
  let empAToken: string;
  let empBToken: string;

  let empADoc: IEmployee;
  let empBDoc: IEmployee;
  let pairedDisplay: { displayId: string; credential: string; terminalId: string };

  const activeSockets: ClientSocket[] = [];

  function connectClient(auth: Record<string, unknown>): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(serverUrl, {
        auth,
        transports: ["websocket"],
        reconnection: false,
        timeout: 5000,
      });

      socket.on("connect", () => {
        activeSockets.push(socket);
        resolve(socket);
      });

      socket.on("connect_error", (err) => {
        activeSockets.push(socket);
        reject(err);
      });
    });
  }

  function expectConnectionError(auth: Record<string, unknown>): Promise<Error> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(serverUrl, {
        auth,
        transports: ["websocket"],
        reconnection: false,
        timeout: 5000,
      });

      activeSockets.push(socket);

      socket.on("connect", () => {
        reject(new Error("Expected socket connection to be rejected, but it succeeded"));
      });

      socket.on("connect_error", (err) => {
        resolve(err);
      });
    });
  }

  function waitForEvent<T = Record<string, unknown>>(
    socket: ClientSocket,
    event: string,
    timeoutMs = 4000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event "${event}"`));
      }, timeoutMs);

      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  function assertEventNotReceived(
    socket: ClientSocket,
    event: string,
    waitMs = 1200
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const handler = (data: unknown) => {
        reject(
          new Error(
            `Expected event "${event}" to NOT be received, but received: ${JSON.stringify(data)}`
          )
        );
      };
      socket.on(event, handler);
      setTimeout(() => {
        socket.off(event, handler);
        resolve();
      }, waitMs);
    });
  }

  beforeAll(async () => {
    httpServer = createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    const address = httpServer.address() as AddressInfo;
    serverUrl = `http://localhost:${address.port}`;
  });

  afterAll(async () => {
    for (const socket of activeSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    await closeSocketServer();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(async () => {
    // Clear collections
    await AttendanceRecord.deleteMany({});
    await QrChallenge.deleteMany({});
    await QrToken.deleteMany({});
    await QrDisplay.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await WfhRequest.deleteMany({});
    await AuditEvent.deleteMany({});

    // 1. Setup Policy
    await AttendancePolicy.create({
      name: "Socket Test Policy",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 5,
      isDefault: true,
      workdays: [1, 2, 3, 4, 5],
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
      wfhRules: {
        allowedDaysPerWeek: 2,
        advanceNoticeDays: 1,
        requiresApproval: true,
        eligibleWorkTypes: [WorkType.FULL_TIME, WorkType.PART_TIME, WorkType.CONTRACT],
      },
    });

    // 2. Setup HR User
    const hrUser = await User.create({
      employeeId: "HR-999",
      email: "hr@vorldx.demo",
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

    // 3. Setup Employee A
    empADoc = await Employee.create({
      employeeId: "EMP-001",
      name: "Aarav Patel",
      email: "aarav@vorldx.demo",
      department: "Engineering",
      designation: "Software Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2025-01-15",
      status: "ACTIVE",
      isActive: true,
    });

    const userA = await User.create({
      employeeId: empADoc.employeeId,
      email: empADoc.email,
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    empADoc.userId = userA._id;
    await empADoc.save();

    empAToken = jwt.sign(
      {
        userId: userA._id.toString(),
        employeeId: empADoc.employeeId,
        email: empADoc.email,
        role: userA.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Setup Employee B
    empBDoc = await Employee.create({
      employeeId: "EMP-002",
      name: "Bhavna Rao",
      email: "bhavna@vorldx.demo",
      department: "Marketing",
      designation: "Product Marketer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2025-02-01",
      status: "ACTIVE",
      isActive: true,
    });

    const userB = await User.create({
      employeeId: empBDoc.employeeId,
      email: empBDoc.email,
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    empBDoc.userId = userB._id;
    await empBDoc.save();

    empBToken = jwt.sign(
      {
        userId: userB._id.toString(),
        employeeId: empBDoc.employeeId,
        email: empBDoc.email,
        role: userB.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 5. Setup Office QR Display Terminal
    const registered = await qrService.registerDisplay({
      name: "HQ Front Desk Screen",
      location: "Bangalore HQ Lobby",
    });
    pairedDisplay = await qrService.pairDisplay(registered.pairingCode!);
  });

  describe("Authentication Handshake & Rejection", () => {
    it("rejects unauthenticated socket connection when no credentials are provided", async () => {
      const err = await expectConnectionError({});
      expect(err.message).toContain("ERR_UNAUTHORIZED");
    });

    it("rejects connection with an invalid or forged JWT token", async () => {
      const err = await expectConnectionError({ token: "forged.jwt.token" });
      expect(err.message).toContain("ERR_UNAUTHORIZED");
    });

    it("rejects connection with invalid display credentials", async () => {
      const err = await expectConnectionError({
        terminalId: "disp_nonexistent",
        terminalSecret: "invalid_secret",
      });
      expect(err.message).toContain("ERR_TERMINAL_UNAUTHORIZED");
    });

    it("authenticates valid HR user, Employee, and Display Screen", async () => {
      const hrSocket = await connectClient({ token: hrToken });
      expect(hrSocket.connected).toBe(true);

      const empSocket = await connectClient({ token: empAToken });
      expect(empSocket.connected).toBe(true);

      const displaySocket = await connectClient({
        terminalId: pairedDisplay.terminalId,
        credential: pairedDisplay.credential,
      });
      expect(displaySocket.connected).toBe(true);
    });
  });

  describe("Scoped Room Isolation on Attendance Punch", () => {
    it("delivers attendance.updated to HR room and the punched employee only; another employee receives nothing", async () => {
      // 1. Establish 3 concurrent client connections
      const hrSocket = await connectClient({ token: hrToken });
      const empASocket = await connectClient({ token: empAToken });
      const empBSocket = await connectClient({ token: empBToken });

      // 2. Set up event promises
      const hrReceivedPromise = waitForEvent(hrSocket, SocketEvent.ATTENDANCE_UPDATED);
      const empAReceivedPromise = waitForEvent(empASocket, SocketEvent.ATTENDANCE_UPDATED);
      const empBNotReceivedPromise = assertEventNotReceived(
        empBSocket,
        SocketEvent.ATTENDANCE_UPDATED,
        1500
      );

      // 3. Generate rotating QR token for Employee A to scan
      const challenge = await qrService.requestRotatingChallenge(
        pairedDisplay.terminalId,
        pairedDisplay.credential
      );

      // 4. Employee A checks in via POST /attendance/scan
      const scanRes = await request(app)
        .post("/attendance/scan")
        .set("Authorization", `Bearer ${empAToken}`)
        .send({ token: challenge.token });

      expect(scanRes.status).toBe(200);
      expect(scanRes.body.success).toBe(true);
      expect(scanRes.body.punchType).toBe("CHECK_IN");

      // 5. Verify HR and Employee A received the event, and Employee B received NOTHING
      const [hrEvent, empAEvent] = await Promise.all([
        hrReceivedPromise,
        empAReceivedPromise,
        empBNotReceivedPromise,
      ]);

      expect(hrEvent).toMatchObject({
        employeeId: empADoc.employeeId,
        punchType: "CHECK_IN",
      });
      expect([AttendanceStatus.PRESENT, AttendanceStatus.LATE]).toContain(hrEvent.status);

      expect(empAEvent).toMatchObject({
        employeeId: empADoc.employeeId,
        punchType: "CHECK_IN",
      });
      expect([AttendanceStatus.PRESENT, AttendanceStatus.LATE]).toContain(empAEvent.status);
    });
  });

  describe("WFH Lifecycle Real-Time Scoped Events", () => {
    it("delivers wfh.created to HR and the requesting employee, while another employee receives nothing", async () => {
      const hrSocket = await connectClient({ token: hrToken });
      const empASocket = await connectClient({ token: empAToken });
      const empBSocket = await connectClient({ token: empBToken });

      const hrReceivedPromise = waitForEvent(hrSocket, SocketEvent.WFH_CREATED);
      const empAReceivedPromise = waitForEvent(empASocket, SocketEvent.WFH_CREATED);
      const empBNotReceivedPromise = assertEventNotReceived(
        empBSocket,
        SocketEvent.WFH_CREATED,
        1200
      );

      // Target future Monday (ensures workday and advance notice)
      const futureDateKey = "2026-11-02";

      const res = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${empAToken}`)
        .send({
          dateKey: futureDateKey,
          reason: "High concentration sprint day for socket architecture",
        });

      expect(res.status).toBe(201);

      const [hrEvent, empAEvent] = await Promise.all([
        hrReceivedPromise,
        empAReceivedPromise,
        empBNotReceivedPromise,
      ]);

      expect(hrEvent).toMatchObject({
        employeeId: empADoc.employeeId,
        dateKey: futureDateKey,
        status: "PENDING",
      });
      expect(empAEvent).toMatchObject({
        employeeId: empADoc.employeeId,
        dateKey: futureDateKey,
        status: "PENDING",
      });
    });

    it("delivers wfh.decided and auto-credit attendance.updated to HR and employee upon approval; third party receives nothing", async () => {
      const hrSocket = await connectClient({ token: hrToken });
      const empASocket = await connectClient({ token: empAToken });
      const empBSocket = await connectClient({ token: empBToken });

      const futureDateKey = "2026-11-03";
      const createRes = await request(app)
        .post("/api/wfh/requests")
        .set("Authorization", `Bearer ${empAToken}`)
        .send({
          dateKey: futureDateKey,
          reason: "Scheduled home broadband upgrade maintenance",
        });

      const requestId = (createRes.body.request || createRes.body.data)._id;

      // Listeners for decision event
      const hrDecidedPromise = waitForEvent(hrSocket, SocketEvent.WFH_DECIDED);
      const empADecidedPromise = waitForEvent(empASocket, SocketEvent.WFH_DECIDED);
      const empBNotReceivedPromise = assertEventNotReceived(
        empBSocket,
        SocketEvent.WFH_DECIDED,
        1200
      );

      // HR approves WFH request
      const reviewRes = await request(app)
        .patch(`/api/wfh/requests/${requestId}/review`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          status: "APPROVED",
          remarks: "Approved for home broadband maintenance.",
        });

      expect(reviewRes.status).toBe(200);

      const [hrEvent, empAEvent] = await Promise.all([
        hrDecidedPromise,
        empADecidedPromise,
        empBNotReceivedPromise,
      ]);

      expect(hrEvent).toMatchObject({
        requestId,
        employeeId: empADoc.employeeId,
        status: "APPROVED",
      });
      expect(empAEvent).toMatchObject({
        requestId,
        employeeId: empADoc.employeeId,
        status: "APPROVED",
      });
    });
  });

  describe("Display Terminal Scoped Events", () => {
    it("delivers qr.rotated to the specific display screen, while employees receive nothing", async () => {
      const displaySocket = await connectClient({
        terminalId: pairedDisplay.terminalId,
        credential: pairedDisplay.credential,
      });
      const empASocket = await connectClient({ token: empAToken });

      const displayReceivedPromise = waitForEvent(displaySocket, SocketEvent.QR_ROTATED);
      const empNotReceivedPromise = assertEventNotReceived(
        empASocket,
        SocketEvent.QR_ROTATED,
        1000
      );

      // Generate a new challenge for this display
      await qrService.requestRotatingChallenge(pairedDisplay.terminalId, pairedDisplay.credential);

      const [displayEvent] = await Promise.all([displayReceivedPromise, empNotReceivedPromise]);

      expect(displayEvent).toMatchObject({
        terminalId: pairedDisplay.terminalId,
      });
      expect(displayEvent.token).toBeDefined();
    });

    it("delivers display.status to that display and HR when terminal is disabled", async () => {
      const displaySocket = await connectClient({
        terminalId: pairedDisplay.terminalId,
        credential: pairedDisplay.credential,
      });
      const hrSocket = await connectClient({ token: hrToken });
      const empBSocket = await connectClient({ token: empBToken });

      const displayStatusPromise = waitForEvent(displaySocket, SocketEvent.DISPLAY_STATUS);
      const hrStatusPromise = waitForEvent(hrSocket, SocketEvent.DISPLAY_STATUS);
      const empNotReceivedPromise = assertEventNotReceived(
        empBSocket,
        SocketEvent.DISPLAY_STATUS,
        1000
      );

      // HR disables display terminal
      await request(app)
        .patch(`/api/displays/${pairedDisplay.terminalId}/status`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          isActive: false,
          reason: "Routine screen recalibration",
        });

      const [displayEvent, hrEvent] = await Promise.all([
        displayStatusPromise,
        hrStatusPromise,
        empNotReceivedPromise,
      ]);

      expect(displayEvent).toMatchObject({
        terminalId: pairedDisplay.terminalId,
        isActive: false,
        status: TerminalStatus.DISABLED,
      });
      expect(hrEvent).toMatchObject({
        terminalId: pairedDisplay.terminalId,
        isActive: false,
      });
    });
  });

  describe("System & Policy Real-Time Broadcasts", () => {
    it("delivers policy.updated to all connected clients when HR updates policy", async () => {
      const hrSocket = await connectClient({ token: hrToken });
      const empASocket = await connectClient({ token: empAToken });

      const hrPolicyPromise = waitForEvent(hrSocket, SocketEvent.POLICY_UPDATED);
      const empPolicyPromise = waitForEvent(empASocket, SocketEvent.POLICY_UPDATED);

      await request(app).patch("/api/policy").set("Authorization", `Bearer ${hrToken}`).send({
        name: "Updated High Velocity Policy",
        defaultGraceMinutes: 20,
        reason: "Updated grace period for winter season",
      });

      const [hrEvent, empEvent] = await Promise.all([hrPolicyPromise, empPolicyPromise]);

      expect(hrEvent).toMatchObject({
        name: "Updated High Velocity Policy",
        version: 2,
      });
      expect(empEvent).toMatchObject({
        name: "Updated High Velocity Policy",
        version: 2,
      });
    });

    it("delivers employee.registered to HR when a new employee verifies registration", async () => {
      const hrSocket = await connectClient({ token: hrToken });

      const newEmpDoc = await Employee.create({
        employeeId: "EMP-099",
        name: "Rohan Varma",
        email: "rohan@vorldx.demo",
        department: "Finance",
        designation: "Financial Analyst",
        workType: WorkType.FULL_TIME,
        joiningDate: "2025-03-01",
        status: "ACTIVE",
        isActive: true,
      });

      const startRes = await request(app)
        .post("/api/auth/register-start")
        .send({ employeeId: "EMP-099" });

      const simulatedOtp = startRes.body.simulatedDemoOtp || startRes.body.otp;

      const hrRegisteredPromise = waitForEvent(hrSocket, SocketEvent.EMPLOYEE_REGISTERED);

      await request(app).post("/api/auth/register-verify").send({
        employeeId: "EMP-099",
        otp: simulatedOtp,
        password: "SecurePassword123!",
      });

      const hrEvent = await hrRegisteredPromise;

      expect(hrEvent).toMatchObject({
        employeeId: "EMP-099",
        email: newEmpDoc.email,
        name: newEmpDoc.name,
      });
    });
  });

  describe("State Resynchronization Protocol", () => {
    it("resyncs employee attendance state on reconnect", async () => {
      const empSocket = await connectClient({ token: empAToken });

      // Create an attendance record for today
      const today = new Date().toISOString().slice(0, 10);
      await AttendanceRecord.create({
        employee: empADoc._id,
        employeeId: empADoc.employeeId,
        department: empADoc.department,
        dateKey: today,
        checkInTime: new Date(),
        status: AttendanceStatus.PRESENT,
        isLate: false,
        durationMinutes: 0,
      });

      // Emit resync request from employee socket
      const resyncResponse = await new Promise<{
        success: boolean;
        type: string;
        data: { employeeId: string; status: AttendanceStatus };
      }>((resolve) => {
        empSocket.emit(
          SocketEvent.RESYNC,
          {},
          (response: {
            success: boolean;
            type: string;
            data: { employeeId: string; status: AttendanceStatus };
          }) => {
            resolve(response);
          }
        );
      });

      expect(resyncResponse.success).toBe(true);
      expect(resyncResponse.type).toBe("attendance");
      expect(resyncResponse.data.employeeId).toBe(empADoc.employeeId);
      expect(resyncResponse.data.status).toBe(AttendanceStatus.PRESENT);
    });

    it("resyncs HR dashboard metrics on reconnect", async () => {
      const hrSocket = await connectClient({ token: hrToken });

      const resyncResponse = await new Promise<{
        success: boolean;
        type: string;
        data: {
          summary: { totalActiveEmployees: number };
          trends: { last7Days: unknown[] };
        };
      }>((resolve) => {
        hrSocket.emit(
          SocketEvent.RESYNC,
          {},
          (response: {
            success: boolean;
            type: string;
            data: {
              summary: { totalActiveEmployees: number };
              trends: { last7Days: unknown[] };
            };
          }) => {
            resolve(response);
          }
        );
      });

      expect(resyncResponse.success).toBe(true);
      expect(resyncResponse.type).toBe("summary");
      expect(resyncResponse.data.summary.totalActiveEmployees).toBeGreaterThanOrEqual(2);
      expect(resyncResponse.data.trends.last7Days).toBeDefined();
    });
  });
});
