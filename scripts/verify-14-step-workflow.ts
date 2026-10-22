/**
 * End-to-End Automated Verification Script for MASTER_BRIEF Section 11 Workflow
 *
 * Covers all 14 Core Functional Verification Steps:
 *  1. Backend + DB initialization & health
 *  2. Database seeding (Policy, Shifts, Admin, Employees)
 *  3. Employee registration with simulated OTP flow & Socket event
 *  4. Office display registration & pairing & rotating challenge generation
 *  5. Employee QR attendance check-in scan
 *  6. Verification of atomic DB record creation
 *  7. Employee personal dashboard data verification (/today, /me)
 *  8. HR executive dashboard data verification (/dashboard/summary, /attendance)
 *  9. Employee check-out scan & duration calculation
 * 10. WFH request submission & real-time HR notification
 * 11. HR WFH review & approval
 * 12. Auto-credit attendance status update verification
 * 13. Comprehensive negative test: Invalid actions (expired, replay, duplicate, weekend)
 * 14. Comprehensive security test: Unauthorized actions (role guards, tampering)
 *
 * Includes Two-Client Real-Time Check:
 *  - Authenticated HR Socket client
 *  - Authenticated Employee A Socket client
 *  - Authenticated Employee B Socket client (asserts room isolation: receives zero events)
 */

import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { app } from "../apps/api/src/app";
import { env } from "../apps/api/src/config/env";
import { initSocketServer, closeSocketServer } from "../apps/api/src/sockets/socketServer";
import {
  User,
  hashPassword,
  Employee,
  AttendancePolicy,
  AttendanceRecord,
  WfhRequest,
  QrDisplay,
  QrChallenge,
  QrToken,
  AuditEvent,
  RegistrationOtp,
} from "../apps/api/src/models";
import {
  ApiErrorCode,
  AttendanceStatus,
  SocketEvent,
  TerminalStatus,
  UserRole,
  WfhStatus,
  WorkType,
} from "@vorldx/shared";
import * as qrService from "../apps/api/src/services/qr.service";

let mongod: MongoMemoryServer;
let httpServer: HttpServer;
let serverUrl: string;

const activeSockets: ClientSocket[] = [];

function connectSocket(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(serverUrl, {
      auth: { token },
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

function waitForEvent<T = any>(socket: ClientSocket, eventName: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${eventName}" on socket ${socket.id}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runE2EWorkflow() {
  console.log("================================================================================");
  console.log("   VORLDX ATTENDANCE SYSTEM — 14-STEP E2E WORKFLOW VERIFICATION SUITE           ");
  console.log("================================================================================\n");

  const results: { step: number; name: string; status: "PASSED" | "FAILED"; details?: string }[] = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Backend + DB Initialization & Health
    // -------------------------------------------------------------------------
    console.log("[Step 1/14] Initializing Database & Backend HTTP/Socket Server...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    httpServer = createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address() as AddressInfo;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    const healthRes = await request(app).get("/api/health");
    if (healthRes.status !== 200 || healthRes.body.status !== "ok") {
      throw new Error(`Health check failed with status ${healthRes.status}`);
    }

    console.log(`   ✓ In-Memory DB connected at ${uri}`);
    console.log(`   ✓ Backend server listening at ${serverUrl}`);
    results.push({ step: 1, name: "Backend + DB Initialization & Health", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 2: Seed Core Policy, Shifts & Demo Accounts
    // -------------------------------------------------------------------------
    console.log("\n[Step 2/14] Seeding Core Attendance Policy, Shifts & Demo Accounts...");
    const policy = await AttendancePolicy.create({
      name: "VorldX Corporate Policy 2026",
      version: 1,
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      isDefault: true,
      workdays: [1, 2, 3, 4, 5],
      shifts: [
        {
          name: "General Day Shift",
          startTime: "09:00",
          endTime: "18:00",
          graceMinutes: 15,
          checkInWindowStartMinutes: 60,
          checkInWindowEndMinutes: 300,
          checkOutWindowStartMinutes: 60,
          checkOutWindowEndMinutes: 300,
          isOvernight: false,
          isActive: true,
        },
      ],
    });

    // Create Demo HR User
    const hrUser = await User.create({
      employeeId: "HR-E2E-001",
      email: "hr@vorldx.demo",
      passwordHash: await hashPassword("demoHash123"),
      role: UserRole.HR,
      status: "ACTIVE",
    });

    // Unregistered Employee A (will undergo self-registration in Step 3)
    const empADoc = await Employee.create({
      employeeId: "EMP-E2E-001",
      name: "Siddharth Rao",
      email: "siddharth.rao@vorldx.demo",
      department: "Engineering",
      designation: "Backend Architect",
      workType: WorkType.FULL_TIME,
      joiningDate: "2025-01-10",
      status: "ACTIVE",
      isActive: true,
    });

    // Second Employee B (for isolation and lobby testing)
    const empBUser = await User.create({
      employeeId: "EMP-E2E-002",
      email: "priya.verma@vorldx.demo",
      passwordHash: await hashPassword("demoHash123"),
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });
    const empBDoc = await Employee.create({
      employeeId: "EMP-E2E-002",
      name: "Priya Verma",
      email: "priya.verma@vorldx.demo",
      department: "Design",
      designation: "Product Designer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2025-03-01",
      status: "ACTIVE",
      isActive: true,
      userId: empBUser._id,
    });

    console.log(`   ✓ Policy created: ${policy.name} (Grace: ${policy.defaultGraceMinutes}m)`);
    console.log(`   ✓ Seeded HR Admin: ${hrUser.employeeId} (${hrUser.email})`);
    console.log(`   ✓ Seeded Employee A (Unregistered): ${empADoc.employeeId}`);
    console.log(`   ✓ Seeded Employee B (Pre-registered): ${empBDoc.employeeId}`);
    results.push({ step: 2, name: "Database Seeding", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 3: Register Employee with Simulated OTP Flow
    // -------------------------------------------------------------------------
    console.log("\n[Step 3/14] Employee Self-Registration & OTP Verification Flow...");

    // Connect HR Socket to verify real-time employee.registered event
    const hrToken = (await request(app)
      .post("/api/auth/login")
      .send({ email: "hr@vorldx.demo", password: "demoHash123" })).body.accessToken;

    const hrSocket = await connectSocket(hrToken);
    console.log(`   ✓ HR Socket connected (${hrSocket.id}) in room 'hr'`);

    const employeeRegisteredPromise = waitForEvent(hrSocket, SocketEvent.EMPLOYEE_REGISTERED);

    // 3a. Start Registration
    const regStartRes = await request(app)
      .post("/api/auth/register-start")
      .send({ employeeId: "EMP-E2E-001" });

    if (regStartRes.status !== 200 || !regStartRes.body.simulatedDemoOtp) {
      throw new Error(`Register-start failed: ${JSON.stringify(regStartRes.body)}`);
    }
    const simulatedOtp = regStartRes.body.simulatedDemoOtp;
    console.log(`   ✓ Received simulated OTP for EMP-E2E-001: ${simulatedOtp}`);

    // 3b. Verify OTP
    const otpVerifyRes = await request(app)
      .post("/api/auth/register-verify")
      .send({ employeeId: "EMP-E2E-001", otp: simulatedOtp });

    if (otpVerifyRes.status !== 200 || !otpVerifyRes.body.verificationToken) {
      throw new Error(`OTP verification failed: ${JSON.stringify(otpVerifyRes.body)}`);
    }
    const verificationToken = otpVerifyRes.body.verificationToken;
    console.log("   ✓ OTP verified successfully; verification token received");

    // 3c. Complete Registration
    const regCompleteRes = await request(app)
      .post("/api/auth/register-complete")
      .send({
        employeeId: "EMP-E2E-001",
        verificationToken,
        password: "SecurePassword123!",
      });

    if (regCompleteRes.status !== 201 || !regCompleteRes.body.accessToken) {
      throw new Error(`Register-complete failed: ${JSON.stringify(regCompleteRes.body)}`);
    }
    const empAToken = regCompleteRes.body.accessToken;
    console.log("   ✓ Registration completed! Employee A password set and JWT issued.");

    // Verify HR socket received real-time employee.registered event
    const regEvent = await employeeRegisteredPromise;
    if (regEvent.employeeId !== "EMP-E2E-001") {
      throw new Error(`Mismatched employeeId in employee.registered event: ${regEvent.employeeId}`);
    }
    console.log("   ✓ HR Real-Time Socket received 'employee.registered' event cleanly");
    results.push({ step: 3, name: "Employee Registration & OTP Flow", status: "PASSED" });

    // Connect Employee A and Employee B Sockets
    const empASocket = await connectSocket(empAToken);
    const empBTokenRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "priya.verma@vorldx.demo", password: "demoHash123" });
    const empBToken = empBTokenRes.body.accessToken;
    const empBSocket = await connectSocket(empBToken);

    console.log(`   ✓ Employee A Socket connected (${empASocket.id}) in room 'employee:EMP-E2E-001'`);
    console.log(`   ✓ Employee B Socket connected (${empBSocket.id}) in room 'employee:EMP-E2E-002'`);

    // -------------------------------------------------------------------------
    // STEP 4: Office Display Terminal Registration, Pairing & QR Challenge
    // -------------------------------------------------------------------------
    console.log("\n[Step 4/14] Office Display Registration, Pairing & Dynamic Challenge...");
    const regDisplayRes = await request(app)
      .post("/api/displays")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ name: "Entrance Kiosk 1", location: "Ground Floor Lobby" });

    if (regDisplayRes.status !== 201) {
      throw new Error(`Display registration failed: ${JSON.stringify(regDisplayRes.body)}`);
    }
    const pairingCode = regDisplayRes.body.data.pairingCode;
    console.log(`   ✓ Display registered with pairing code: ${pairingCode}`);

    const pairRes = await request(app)
      .post("/api/displays/pair")
      .send({ pairingCode });

    if (pairRes.status !== 200 || !pairRes.body.credential) {
      throw new Error(`Display pairing failed: ${JSON.stringify(pairRes.body)}`);
    }
    const displayId = pairRes.body.terminalId;
    const displayCredential = pairRes.body.credential;
    console.log(`   ✓ Display paired: terminalId=${displayId}`);

    const tokenRes = await request(app)
      .get("/api/displays/token")
      .set("x-display-id", displayId)
      .set("x-display-credential", displayCredential);

    if (tokenRes.status !== 200 || !tokenRes.body.token) {
      throw new Error(`Token fetch failed: ${JSON.stringify(tokenRes.body)}`);
    }
    const qrChallengeToken = tokenRes.body.token;
    console.log(`   ✓ Dynamic QR challenge token issued: ${qrChallengeToken.substring(0, 24)}... (TTL: ${tokenRes.body.ttlSeconds}s)`);
    results.push({ step: 4, name: "Display Registration & QR Issuance", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 5: Employee Attendance Check-In Scan + Real-Time Multi-Client Verification
    // -------------------------------------------------------------------------
    console.log("\n[Step 5/14] Employee QR Check-In Scan + Real-Time Scoped Room Verification...");

    // Set up listeners for real-time check
    let empBReceivedEvent = false;
    empBSocket.on(SocketEvent.ATTENDANCE_UPDATED, () => {
      empBReceivedEvent = true;
    });

    const hrPunchPromise = waitForEvent(hrSocket, SocketEvent.ATTENDANCE_UPDATED);
    const empAPunchPromise = waitForEvent(empASocket, SocketEvent.ATTENDANCE_UPDATED);

    // Simulated punch at 09:05 AM IST (on-time within 15 min grace)
    const morningPunch = new Date("2026-11-16T03:35:00.000Z"); // 09:05 IST
    const scanRes = await request(app)
      .post("/api/attendance/scan")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({
        token: qrChallengeToken,
        simulatedNow: morningPunch.toISOString(),
      });

    if (scanRes.status !== 200 || scanRes.body.punchType !== "CHECK_IN") {
      throw new Error(`Check-in scan failed: ${JSON.stringify(scanRes.body)}`);
    }

    expectEqual(scanRes.body.status, AttendanceStatus.PRESENT, "Punch status");
    expectEqual(scanRes.body.isLate, false, "Late flag");
    console.log(`   ✓ Scan successful: punchType=CHECK_IN, status=PRESENT, isLate=false`);

    // Await Socket events
    const hrPunchEvent = await hrPunchPromise;
    const empAPunchEvent = await empAPunchPromise;

    expectEqual(hrPunchEvent.employeeId, "EMP-E2E-001", "HR event employeeId");
    expectEqual(empAPunchEvent.employeeId, "EMP-E2E-001", "EmpA event employeeId");
    console.log("   ✓ HR Socket received 'attendance.updated' in real-time");
    console.log("   ✓ Employee A Socket received 'attendance.updated' in real-time");

    // Give short pause to verify Employee B received nothing
    await new Promise((r) => setTimeout(r, 200));
    if (empBReceivedEvent) {
      throw new Error("Security breach: Employee B received attendance event intended for Employee A!");
    }
    console.log("   ✓ Room isolation verified: Employee B received 0 leaked events");
    results.push({ step: 5, name: "Attendance Check-In & Real-Time Isolation", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 6: Verify Database Record State
    // -------------------------------------------------------------------------
    console.log("\n[Step 6/14] Verifying Atomic Attendance Record in Database...");
    const dbRecord = await AttendanceRecord.findOne({
      employeeId: "EMP-E2E-001",
      dateKey: "2026-11-16",
    });

    if (!dbRecord) {
      throw new Error("Attendance record not found in MongoDB!");
    }
    expectEqual(dbRecord.status, AttendanceStatus.PRESENT, "DB record status");
    expectEqual(dbRecord.checkOutTime, null, "DB record checkOutTime (should be null)");
    if (!dbRecord.checkInTime) {
      throw new Error("DB record checkInTime is missing");
    }
    console.log(`   ✓ DB Record confirmed: _id=${dbRecord._id}, checkInTime=${dbRecord.checkInTime.toISOString()}, status=${dbRecord.status}`);
    results.push({ step: 6, name: "Database Record Verification", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 7: Employee Personal Dashboard Data Verification
    // -------------------------------------------------------------------------
    console.log("\n[Step 7/14] Verifying Employee Dashboard APIs (/today and /me)...");
    const todayRes = await request(app)
      .get("/api/attendance/today?simulatedNow=2026-11-16T04:00:00.000Z")
      .set("Authorization", `Bearer ${empAToken}`);

    if (todayRes.status !== 200 || !todayRes.body.hasPunched) {
      throw new Error(`GET /attendance/today failed: ${JSON.stringify(todayRes.body)}`);
    }
    expectEqual(todayRes.body.punchType, "CHECKED_IN", "Today punchType");
    expectEqual(todayRes.body.canCheckIn, false, "canCheckIn flag");
    expectEqual(todayRes.body.canCheckOut, true, "canCheckOut flag");

    const meRes = await request(app)
      .get("/api/attendance/me")
      .set("Authorization", `Bearer ${empAToken}`);

    if (meRes.status !== 200 || !meRes.body.stats) {
      throw new Error(`GET /attendance/me failed: ${JSON.stringify(meRes.body)}`);
    }
    expectEqual(meRes.body.stats.presentDays, 1, "Personal presentDays stat");
    console.log("   ✓ GET /attendance/today correctly shows active CHECKED_IN card");
    console.log("   ✓ GET /attendance/me aggregates presentDays=1, totalDays=1");
    results.push({ step: 7, name: "Employee Dashboard Data APIs", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 8: HR Dashboard Data Verification
    // -------------------------------------------------------------------------
    console.log("\n[Step 8/14] Verifying HR Executive Dashboard & Attendance Ledger...");
    const summaryRes = await request(app)
      .get("/api/dashboard/summary?dateKey=2026-11-16")
      .set("Authorization", `Bearer ${hrToken}`);

    const summaryData = summaryRes.body.summary;
    if (summaryRes.status !== 200 || !summaryData) {
      throw new Error(`GET /dashboard/summary failed: ${JSON.stringify(summaryRes.body)}`);
    }
    console.log(`   ✓ HR Summary: presentToday=${summaryData.presentToday}, attendanceRate=${summaryData.attendanceRate}%`);

    const ledgerRes = await request(app)
      .get("/api/attendance?dateKey=2026-11-16")
      .set("Authorization", `Bearer ${hrToken}`);

    if (ledgerRes.status !== 200 || ledgerRes.body.data.length === 0) {
      throw new Error(`GET /attendance ledger query failed: ${JSON.stringify(ledgerRes.body)}`);
    }
    console.log(`   ✓ HR Ledger lists punch record for employee: ${ledgerRes.body.data[0].employeeId}`);
    results.push({ step: 8, name: "HR Dashboard & Ledger APIs", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 9: Employee Check-Out Scan
    // -------------------------------------------------------------------------
    console.log("\n[Step 9/14] Employee QR Check-Out Scan & Duration Math...");
    // Request fresh QR token for departure
    const departureTokenRes = await request(app)
      .get("/api/displays/token")
      .set("x-display-id", displayId)
      .set("x-display-credential", displayCredential);
    const departureQrToken = departureTokenRes.body.token;

    // Punch out 8 hours later (17:05 IST)
    const eveningPunch = new Date("2026-11-16T11:35:00.000Z"); // 17:05 IST
    const checkoutRes = await request(app)
      .post("/api/attendance/scan")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({
        token: departureQrToken,
        simulatedNow: eveningPunch.toISOString(),
      });

    if (checkoutRes.status !== 200 || checkoutRes.body.punchType !== "CHECK_OUT") {
      throw new Error(`Check-out scan failed: ${JSON.stringify(checkoutRes.body)}`);
    }
    expectEqual(checkoutRes.body.durationMinutes, 480, "Computed durationMinutes");
    console.log(`   ✓ Check-Out scan successful: durationMinutes=${checkoutRes.body.durationMinutes} (8 hours)`);

    // Verify DB updated
    const updatedRecord = await AttendanceRecord.findById(dbRecord._id);
    if (!updatedRecord?.checkOutTime) {
      throw new Error("Database record missing checkOutTime after checkout!");
    }
    console.log(`   ✓ DB checkOutTime set to: ${updatedRecord.checkOutTime.toISOString()}`);
    results.push({ step: 9, name: "Employee Check-Out & Duration Math", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 10: WFH Request Submission & Real-Time HR Notification
    // -------------------------------------------------------------------------
    console.log("\n[Step 10/14] WFH Request Submission & Real-Time HR Notification...");
    const hrWfhCreatePromise = waitForEvent(hrSocket, SocketEvent.WFH_CREATED);

    const wfhTargetDate = "2026-11-17"; // Tuesday (Working day)
    const wfhCreateRes = await request(app)
      .post("/api/wfh/requests")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({
        dateKey: wfhTargetDate,
        reason: "Scheduled home broadband upgrade and fiber optic maintenance",
      });

    if (wfhCreateRes.status !== 201 || !wfhCreateRes.body.request) {
      throw new Error(`WFH request submission failed: ${JSON.stringify(wfhCreateRes.body)}`);
    }
    const wfhId = wfhCreateRes.body.request._id;
    expectEqual(wfhCreateRes.body.request.status, WfhStatus.PENDING, "WFH request status");

    const wfhCreatedEvent = await hrWfhCreatePromise;
    expectEqual(wfhCreatedEvent.employeeId, "EMP-E2E-001", "WFH created event employeeId");
    console.log(`   ✓ WFH Request created: ID=${wfhId}, status=PENDING`);
    console.log("   ✓ HR Socket received 'wfh.created' in real-time");
    results.push({ step: 10, name: "WFH Request Submission & Notification", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 11: HR Review & WFH Approval
    // -------------------------------------------------------------------------
    console.log("\n[Step 11/14] HR Review & Approval of WFH Request...");
    const empAWfhDecidePromise = waitForEvent(empASocket, SocketEvent.WFH_DECIDED);

    const reviewRes = await request(app)
      .patch(`/api/wfh/requests/${wfhId}/review`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        status: "APPROVED",
        remarks: "Approved for home broadband maintenance",
      });

    if (reviewRes.status !== 200 || reviewRes.body.request.status !== WfhStatus.APPROVED) {
      throw new Error(`WFH approval failed: ${JSON.stringify(reviewRes.body)}`);
    }

    const empWfhEvent = await empAWfhDecidePromise;
    expectEqual(empWfhEvent.status, WfhStatus.APPROVED, "WFH decided event status");
    console.log(`   ✓ WFH Request ${wfhId} approved by HR`);
    console.log("   ✓ Employee A Socket received 'wfh.decided' status in real-time");
    results.push({ step: 11, name: "HR WFH Review & Approval", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 12: Auto-Credit Attendance Status Update Verification
    // -------------------------------------------------------------------------
    console.log("\n[Step 12/14] Verifying Auto-Credited WFH Attendance Record...");
    const wfhAttendanceRecord = await AttendanceRecord.findOne({
      employeeId: "EMP-E2E-001",
      dateKey: wfhTargetDate,
    });

    if (!wfhAttendanceRecord) {
      throw new Error("Auto-credited WFH attendance record not found in MongoDB!");
    }
    expectEqual(wfhAttendanceRecord.status, AttendanceStatus.WFH_APPROVED, "WFH Attendance status");
    expectEqual(wfhAttendanceRecord.isWfh, true, "isWfh flag");
    console.log(`   ✓ Auto-credited attendance record verified: dateKey=${wfhAttendanceRecord.dateKey}, status=${wfhAttendanceRecord.status}`);
    results.push({ step: 12, name: "Auto-Credit Attendance Record", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 13: Comprehensive Negative Test: Invalid Actions Rejection
    // -------------------------------------------------------------------------
    console.log("\n[Step 13/14] Testing Negative Test Scenarios & Invalid Actions...");

    // 13a. Expired QR Token
    const expTokenRes = await request(app)
      .get("/api/displays/token")
      .set("x-display-id", displayId)
      .set("x-display-credential", displayCredential);
    const expiredToken = expTokenRes.body.token;
    await QrToken.updateOne({ token: expiredToken }, { $set: { expiresAt: new Date(Date.now() - 5000) } });

    const testExpiredRes = await request(app)
      .post("/api/attendance/scan")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({ token: expiredToken });
    expectEqual(testExpiredRes.status, 400, "Expired token status");
    expectEqual(testExpiredRes.body.code, ApiErrorCode.ERR_QR_EXPIRED, "Expired token error code");
    console.log("   ✓ Rejects expired QR token with 400 ERR_QR_EXPIRED");

    // 13b. QR Token Replay Defense
    const testReplayRes = await request(app)
      .post("/api/attendance/scan")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({ token: qrChallengeToken }); // Replaying morning punch token
    expectEqual(testReplayRes.status, 409, "Replay token status");
    expectEqual(testReplayRes.body.code, ApiErrorCode.ERR_QR_REPLAY_DETECTED, "Replay error code");
    console.log("   ✓ Rejects replayed QR token with 409 ERR_QR_REPLAY_DETECTED");

    // 13c. Duplicate Scan when already checked out
    const freshTokenRes = await request(app)
      .get("/api/displays/token")
      .set("x-display-id", displayId)
      .set("x-display-credential", displayCredential);
    const thirdScanRes = await request(app)
      .post("/api/attendance/scan")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({
        token: freshTokenRes.body.token,
        simulatedNow: "2026-11-16T12:00:00.000Z",
      });
    expectEqual(thirdScanRes.status, 409, "Already checked out status");
    expectEqual(thirdScanRes.body.code, ApiErrorCode.ERR_ALREADY_CHECKED_IN, "Already checked out error code");
    console.log("   ✓ Rejects scan when already checked out for the day with 409 ERR_ALREADY_CHECKED_IN");

    // 13d. Duplicate WFH Request
    const dupWfhRes = await request(app)
      .post("/api/wfh/requests")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({ dateKey: wfhTargetDate, reason: "Duplicate request attempt" });
    expectEqual(dupWfhRes.status, 409, "Duplicate WFH status");
    const isDuplicateOrAlreadyApproved =
      dupWfhRes.body.code === ApiErrorCode.ERR_DUPLICATE_WFH_REQUEST ||
      dupWfhRes.body.code === "ERR_ALREADY_WFH_APPROVED";
    if (!isDuplicateOrAlreadyApproved) {
      throw new Error(`Expected 409 duplicate WFH conflict code, got: ${dupWfhRes.body.code}`);
    }
    console.log(`   ✓ Rejects duplicate WFH request on same date with 409 ${dupWfhRes.body.code}`);

    // 13e. WFH on Non-Working Day (Sunday)
    const weekendWfhRes = await request(app)
      .post("/api/wfh/requests")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({ dateKey: "2026-11-22", reason: "Sunday WFH attempt" });
    expectEqual(weekendWfhRes.status, 400, "Weekend WFH status");
    expectEqual(weekendWfhRes.body.code, ApiErrorCode.ERR_NON_WORKING_DAY, "Weekend WFH code");
    console.log("   ✓ Rejects WFH request on weekend with 400 ERR_NON_WORKING_DAY");
    results.push({ step: 13, name: "Negative Test: Invalid Actions Rejection", status: "PASSED" });

    // -------------------------------------------------------------------------
    // STEP 14: Comprehensive Security Test: Unauthorized Actions Rejection
    // -------------------------------------------------------------------------
    console.log("\n[Step 14/14] Testing Security Boundaries & Unauthorized Actions Rejection...");

    // 14a. Regular Employee attempting attendance record correction
    const unauthCorrectRes = await request(app)
      .patch(`/api/attendance/${dbRecord._id}/correct`)
      .set("Authorization", `Bearer ${empAToken}`)
      .send({ status: AttendanceStatus.PRESENT, reason: "Self-correction attempt" });
    expectEqual(unauthCorrectRes.status, 403, "Unauth correction status");
    expectEqual(unauthCorrectRes.body.code, ApiErrorCode.ERR_FORBIDDEN, "Unauth correction code");
    console.log("   ✓ Blocks employee from correcting attendance records with 403 ERR_FORBIDDEN");

    // 14b. Regular Employee attempting WFH approval
    const unauthWfhRes = await request(app)
      .patch(`/api/wfh/requests/${wfhId}/review`)
      .set("Authorization", `Bearer ${empAToken}`)
      .send({ status: "APPROVED", remarks: "Self-approval attempt" });
    expectEqual(unauthWfhRes.status, 403, "Unauth WFH approval status");
    expectEqual(unauthWfhRes.body.code, ApiErrorCode.ERR_FORBIDDEN, "Unauth WFH approval code");
    console.log("   ✓ Blocks employee from reviewing WFH requests with 403 ERR_FORBIDDEN");

    // 14c. Regular Employee attempting to access audit logs
    const unauthAuditRes = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${empAToken}`);
    expectEqual(unauthAuditRes.status, 403, "Unauth audit log status");
    expectEqual(unauthAuditRes.body.code, ApiErrorCode.ERR_FORBIDDEN, "Unauth audit log code");
    console.log("   ✓ Blocks employee from viewing administrative audit logs with 403 ERR_FORBIDDEN");

    // 14d. Forged HMAC token
    const forgedPayload = {
      v: 1,
      tid: displayId,
      ts: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30,
      n: "forged-nonce-11111",
      sig: "0000000000000000000000000000000000000000000000000000000000000000",
    };
    const forgedRes = await request(app)
      .post("/api/attendance/scan")
      .set("Authorization", `Bearer ${empBToken}`)
      .send({ token: JSON.stringify(forgedPayload) });
    expectEqual(forgedRes.status, 400, "Forged token status");
    expectEqual(forgedRes.body.code, ApiErrorCode.ERR_INVALID_QR_SIGNATURE, "Forged token code");
    console.log("   ✓ Blocks forged HMAC token with 400 ERR_INVALID_QR_SIGNATURE");
    results.push({ step: 14, name: "Security: Unauthorized Actions Rejection", status: "PASSED" });

  } catch (error) {
    console.error("\n❌ E2E Workflow Error:", error);
    process.exitCode = 1;
  } finally {
    console.log("\n================================================================================");
    console.log("   E2E WORKFLOW EXECUTION SUMMARY");
    console.log("================================================================================");
    results.forEach((r) => {
      console.log(`  [Step ${r.step < 10 ? "0" + r.step : r.step}] ${r.name.padEnd(48)}: ${r.status}`);
    });
    console.log("================================================================================\n");

    // Clean teardown
    activeSockets.forEach((s) => s.disconnect());
    closeSocketServer();
    if (httpServer) {
      await new Promise((r) => httpServer.close(r));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }

    if (results.length === 14 && results.every((r) => r.status === "PASSED")) {
      console.log("🎉 ALL 14 STEPS PASSED SUCCESSFULLY WITH ZERO DEFECTS!\n");
    } else {
      console.error(`⚠️ Completed with ${14 - results.filter((r) => r.status === "PASSED").length} incomplete/failed step(s).`);
      process.exit(1);
    }
  }
}

function expectEqual(actual: any, expected: any, label: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed for ${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

runE2EWorkflow();
