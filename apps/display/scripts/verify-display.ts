import next from "next";
import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createServer } from "http";
import { app } from "../../api/src/app";
import { initSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User";
import { Employee } from "../../api/src/models/Employee";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy";
import { QrDisplay } from "../../api/src/models/QrDisplay";
import { QrToken } from "../../api/src/models/QrToken";
import { UserRole, WorkType, TerminalStatus } from "@vorldx/shared";
import { requestRotatingChallenge, updateDisplayStatus, revokeDisplay } from "../../api/src/services/qr.service";
import { scanAttendance } from "../../api/src/services/attendance.service";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runDisplayVerification() {
  console.log("==================================================");
  console.log("Starting Browser Verification for Office QR Display Kiosk");
  console.log("Executable:", executablePath);
  console.log("==================================================");

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Database
  console.log("2. Seeding database with Policy, Admin, Employees, and Display Terminal...");
  await AttendancePolicy.create({
    name: "Corporate Standard Policy",
    version: 1,
    timezone: "Asia/Kolkata",
    defaultGraceMinutes: 15,
    minFullDayHours: 8,
    minHalfDayHours: 4,
    monthlyWfhQuota: 4,
    absenceEvaluationCutoffTime: "23:59",
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
  });

  const adminPassword = await hashPassword("Admin@12345");
  const adminUser = await User.create({
    employeeId: "ADM-001",
    email: "admin@vorldx.demo",
    passwordHash: adminPassword,
    role: UserRole.ADMIN,
    status: "ACTIVE",
  });

  await Employee.create({
    employeeId: "ADM-001",
    name: "Vikram Malhotra",
    email: "admin@vorldx.demo",
    department: "Executive",
    designation: "Chief Technology Officer",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-01-01",
    status: "ACTIVE",
    isActive: true,
    userId: adminUser._id,
  });

  const emp1User = await User.create({
    employeeId: "EMP-001",
    email: "emp1@vorldx.demo",
    passwordHash: await hashPassword("Employee@123"),
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
  });

  await Employee.create({
    employeeId: "EMP-001",
    name: "Ananya Sharma",
    email: "emp1@vorldx.demo",
    department: "Engineering",
    designation: "Senior Frontend Engineer",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-03-01",
    status: "ACTIVE",
    isActive: true,
    userId: emp1User._id,
  });

  const emp2User = await User.create({
    employeeId: "EMP-002",
    email: "emp2@vorldx.demo",
    passwordHash: await hashPassword("Employee@123"),
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
  });

  await Employee.create({
    employeeId: "EMP-002",
    name: "Rajesh Patel",
    email: "emp2@vorldx.demo",
    department: "Product",
    designation: "Principal Product Manager",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-02-15",
    status: "ACTIVE",
    isActive: true,
    userId: emp2User._id,
  });

  // Seed Display Terminal awaiting pairing with known pairing code VX-7733
  const pairingCode = "VX-7733";
  await QrDisplay.create({
    terminalId: "disp_lobby_01",
    name: "North Tower Kiosk",
    location: "Ground Floor Lobby Turnstiles",
    pairingCode,
    pairingCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    isPaired: false,
    isActive: true,
    status: TerminalStatus.UNPAIRED,
    tokenEpoch: 1,
  });
  console.log("Seeded Display Terminal with Pairing Code:", pairingCode);

  // 3. Start API HTTP Server on port 4000
  console.log("3. Starting API Server on port 4000...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));

  // 4. Start Next.js Display App on port 3001
  console.log("4. Starting Next.js Display Server on port 3001...");
  const displayDir = path.resolve(__dirname, "..");
  const nextApp = next({
    dev: false,
    dir: displayDir,
    hostname: "localhost",
    port: 3001,
  });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  const displayHttpServer = createServer((req, res) => handle(req, res));
  await new Promise<void>((resolve) => displayHttpServer.listen(3001, resolve));
  console.log("Next.js Display Server listening at http://localhost:3001");

  // 5. Launch Puppeteer
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("favicon") || text.includes("404")) return;
      consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (req) => {
    console.log(`[REQUEST FAILED]: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  try {
    // =========================================================================
    // PHASE 1: 1080p Monitor Viewport (1920x1080) & Pairing Flow
    // =========================================================================
    console.log("Phase 1: Testing on 1080p Viewport (1920x1080)...");
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto("http://localhost:3001", { waitUntil: "networkidle0" });
    await page.waitForSelector("#pairing-code-input", { timeout: 10000 });

    // Capture browser_36_display_pairing_screen_1080p.png
    const shot36 = path.join(artifactDir, "browser_36_display_pairing_screen_1080p.png");
    await page.screenshot({ path: shot36, fullPage: true });
    console.log("Saved artifact:", shot36);

    // Enter Pairing Code
    console.log("Entering pairing code VX-7733...");
    await page.type("#pairing-code-input", pairingCode);
    await new Promise((r) => setTimeout(r, 300));
    await page.click("#pair-submit-btn");

    // Wait for transition to Main Screen
    await page.waitForSelector("#active-qr-container", { timeout: 10000 });
    await page.waitForSelector("#vorldx-dynamic-qr-code", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Verify terminal details on screen
    const terminalNameText = await page.$eval("#display-terminal-name", (el) => el.textContent);
    console.log("Rendered Terminal Name:", terminalNameText);

    // Capture browser_37_display_main_screen_1080p.png
    const shot37 = path.join(artifactDir, "browser_37_display_main_screen_1080p.png");
    await page.screenshot({ path: shot37, fullPage: true });
    console.log("Saved artifact:", shot37);

    // =========================================================================
    // PHASE 2: Token Rotation & Attendance Scan Verification
    // =========================================================================
    console.log("Phase 2: Verifying Token Rotation and Punch Validation...");

    // Fetch the first token from DB that was issued to disp_lobby_01
    const initialTokens = await QrToken.find({ displayId: "disp_lobby_01" }).sort({ issuedAt: -1 });
    if (initialTokens.length === 0) {
      throw new Error("No QR token found in database for disp_lobby_01!");
    }
    const token1 = initialTokens[0].token;
    console.log("Token 1 (initial challenge):", token1.slice(0, 16) + "...");

    // Get the paired raw credential stored in the browser's localStorage
    const rawCredential = await page.evaluate(() => {
      const data = localStorage.getItem("vorldx_display_credentials");
      return data ? JSON.parse(data).credential : null;
    });
    if (!rawCredential) {
      throw new Error("No display credential found in browser localStorage!");
    }

    // Now trigger a token rotation via requestRotatingChallenge
    const rotationResult = await requestRotatingChallenge(
      "disp_lobby_01",
      rawCredential
    );
    const token2 = rotationResult.token;
    console.log("Token 2 (rotated challenge):", token2.slice(0, 16) + "...");

    if (token1 === token2) {
      throw new Error("Rotation failed: token2 is identical to token1!");
    }

    // Wait for the display screen to smoothly pick up token2 via WebSocket
    await new Promise((r) => setTimeout(r, 1500));

    // Capture browser_38_display_rotated_token_1080p.png
    const shot38 = path.join(artifactDir, "browser_38_display_rotated_token_1080p.png");
    await page.screenshot({ path: shot38, fullPage: true });
    console.log("Saved artifact:", shot38);

    // Now scan Token 2 through Attendance API with Employee 1
    console.log("Scanning Token 2 via Attendance Scan Engine with EMP-001...");
    const punchResult = await scanAttendance(emp1User._id.toString(), {
      token: token2,
    });
    console.log("✓ Scan result for Token 2: Status =", punchResult.status, ", PunchType =", punchResult.punchType);

    // Expire Token 1 manually to test rejected old token
    await QrToken.updateOne({ token: token1 }, { $set: { expiresAt: new Date(Date.now() - 5000) } });

    // Attempt scanning old Token 1 with Employee 2
    console.log("Attempting to scan expired Token 1 with EMP-002...");
    let oldTokenRejected = false;
    try {
      await scanAttendance(emp2User._id.toString(), { token: token1 });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.log("✓ Correctly rejected old token with code:", e.code, "-", e.message);
      oldTokenRejected = true;
    }
    if (!oldTokenRejected) {
      throw new Error("Security failure: Old expired token was not rejected!");
    }

    // =========================================================================
    // PHASE 3: Disable Display from HR & Confirm QR Disappears
    // =========================================================================
    console.log("Phase 3: Disabling display from HR admin controls...");
    await updateDisplayStatus("disp_lobby_01", false, "Turnstile sensor calibration", {
      id: adminUser._id.toString(),
      employeeId: "ADM-001",
      role: "ADMIN",
    });

    // Wait for socket broadcast
    await page.waitForSelector("#display-disabled-screen", { timeout: 8000 });
    // Verify QR code is removed from DOM
    const qrPresentWhileDisabled = await page.$("#active-qr-container");
    if (qrPresentWhileDisabled) {
      throw new Error("Security failure: QR code was not blanked when display was disabled!");
    }
    console.log("✓ Confirmed QR code was immediately blanked upon disablement.");

    // Capture browser_39_display_disabled_screen_1080p.png
    const shot39 = path.join(artifactDir, "browser_39_display_disabled_screen_1080p.png");
    await page.screenshot({ path: shot39, fullPage: true });
    console.log("Saved artifact:", shot39);

    // =========================================================================
    // PHASE 4: Tablet-Sized Viewport (768x1024) & Re-enable Display
    // =========================================================================
    console.log("Phase 4: Testing on Tablet Viewport (768x1024) and Re-enabling...");
    await page.setViewport({ width: 768, height: 1024 });

    // Re-enable display
    await updateDisplayStatus("disp_lobby_01", true, "Calibration complete", {
      id: adminUser._id.toString(),
      employeeId: "ADM-001",
      role: "ADMIN",
    });

    // Wait for display to recover and show QR code again
    await page.waitForSelector("#active-qr-container", { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Capture browser_40_display_main_screen_tablet.png
    const shot40 = path.join(artifactDir, "browser_40_display_main_screen_tablet.png");
    await page.screenshot({ path: shot40, fullPage: true });
    console.log("Saved artifact:", shot40);

    // =========================================================================
    // PHASE 5: Revoke Display Terminal Credentials
    // =========================================================================
    console.log("Phase 5: Revoking display terminal credentials...");
    await revokeDisplay("disp_lobby_01", "Hardware decommissioned", {
      id: adminUser._id.toString(),
      employeeId: "ADM-001",
      role: "ADMIN",
    });

    // Wait for revoked screen
    await page.waitForSelector("#display-revoked-screen", { timeout: 8000 });
    const qrPresentWhileRevoked = await page.$("#active-qr-container");
    if (qrPresentWhileRevoked) {
      throw new Error("Security failure: QR code was not blanked when display was revoked!");
    }
    console.log("✓ Confirmed QR code was blanked upon revocation.");

    // Capture browser_41_display_revoked_tablet.png
    const shot41 = path.join(artifactDir, "browser_41_display_revoked_tablet.png");
    await page.screenshot({ path: shot41, fullPage: true });
    console.log("Saved artifact:", shot41);

    // Click "Pair New Terminal"
    console.log("Clicking 'Pair New Terminal' to return to pairing screen...");
    await page.click("#re-pair-screen-btn");
    await page.waitForSelector("#pairing-code-input", { timeout: 8000 });

    // Capture browser_42_display_returned_to_pairing.png
    const shot42 = path.join(artifactDir, "browser_42_display_returned_to_pairing.png");
    await page.screenshot({ path: shot42, fullPage: true });
    console.log("Saved artifact:", shot42);

    // Verify console errors
    console.log("Recorded console errors count:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log("Console errors:", consoleErrors);
    }

    console.log("==================================================");
    console.log("Browser Verification for Office QR Display Kiosk PASSED!");
    console.log("==================================================");
  } finally {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    try {
      displayHttpServer.close();
    } catch {
      // ignore
    }
    try {
      closeSocketServer();
    } catch {
      // ignore
    }
    try {
      if ("closeAllConnections" in apiHttpServer && typeof apiHttpServer.closeAllConnections === "function") {
        apiHttpServer.closeAllConnections();
      }
      apiHttpServer.close();
    } catch {
      // ignore
    }
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    try {
      await mongod.stop();
    } catch {
      // ignore
    }
  }
}

runDisplayVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
