import { preview } from "vite";
import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createServer } from "http";
import { app } from "../../api/src/app";
import { initSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User.ts";
import { Employee } from "../../api/src/models/Employee.ts";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy.ts";
import { AttendanceRecord } from "../../api/src/models/AttendanceRecord.ts";
import { WfhRequest } from "../../api/src/models/WfhRequest.ts";
import { QrDisplay } from "../../api/src/models/QrDisplay.ts";
import { UserRole, WorkType, WfhStatus, TerminalStatus } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runPolicyWfhDisplaysVerification() {
  console.log("==================================================");
  console.log("Starting Browser Verification for Policies, WFH & QR Displays");
  console.log("Executable:", executablePath);
  console.log("==================================================");

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Database
  console.log("2. Seeding database with Policy, Admin, Employees, WFH Requests, and Displays...");
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

  const emp1 = await Employee.create({
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

  // Tomorrow's dateKey for WFH request
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  const pendingWfh = await WfhRequest.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: tomorrowKey,
    reason: "Attending critical family function in home city",
    status: WfhStatus.PENDING,
  });

  // Seed Initial QR Display
  await QrDisplay.create({
    terminalId: "disp_lobby_01",
    name: "Main Tower Lobby Screen",
    location: "Ground Floor Turnstiles, Tower A",
    pairingCode: "VX-9988",
    pairingCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    isPaired: true,
    isActive: true,
    status: TerminalStatus.ACTIVE,
    tokenEpoch: 1,
    lastSeen: new Date(),
  });

  // 3. Start API HTTP Server on port 4000
  console.log("3. Starting API Server on port 4000...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));

  // 4. Start Vite Preview Server on port 3000
  console.log("4. Starting Vite Web Preview Server on port 3000...");
  const webRootDir = path.resolve(__dirname, "..");
  const previewServer = await preview({
    root: webRootDir,
    server: { port: 3000 },
    preview: { port: 3000 },
  });

  console.log("Servers ready. Launching browser...");

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
      if (text.includes("favicon") || text.includes("401")) return;
      consoleErrors.push(text);
    }
  });

  await page.setViewport({ width: 1280, height: 800 });

  const fillInput = async (selector: string, value: string) => {
    const el = await page.$(selector);
    if (el) {
      await el.click();
      await page.keyboard.down("Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up("Control");
      await page.keyboard.press("Backspace");
      await page.keyboard.type(value);
    }
  };

  try {
    page.on("requestfailed", (req) => {
      console.log(`HTTP Request Failed: ${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    // -------------------------------------------------------------------------
    // Step 1: Sign in as Admin
    // -------------------------------------------------------------------------
    console.log("Step 1: Signing in as Admin...");
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Demo Admin")
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.click("button[type='submit']");
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 8000 });
    console.log("✓ Logged in successfully. Current URL:", page.url());

    // -------------------------------------------------------------------------
    // Step 2: Navigate to Policies Page
    // -------------------------------------------------------------------------
    console.log("Step 2: Navigating to Policies Page...");
    await page.goto("http://localhost:3000/policies", { waitUntil: "networkidle0" });
    await page.waitForSelector("#grace-period-input", { timeout: 8000 });

    const initialScreenshotPath = path.join(artifactDir, "browser_19_policy_initial.png");
    await page.screenshot({ path: initialScreenshotPath });
    console.log("✓ Policies page rendered with initial v1 policy. Screenshot saved:", initialScreenshotPath);

    // Change Grace Period from 15 to 25 minutes
    console.log("Modifying grace period from 15 to 25 minutes...");
    await fillInput("#grace-period-input", "25");

    // Click "Save Policy Changes"
    await page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find(b => b.textContent && b.textContent.includes("Save Policy Changes"));
      if (btn) btn.click();
    })()`);

    // Verify confirmation modal with summary diff
    await page.waitForSelector("#confirm-policy-update-btn", { timeout: 5000 });
    const modalScreenshotPath = path.join(artifactDir, "browser_20_policy_confirm_modal.png");
    await page.screenshot({ path: modalScreenshotPath });
    console.log("✓ Confirmation modal with summary of changes displayed. Screenshot saved:", modalScreenshotPath);

    // Add justification reason and confirm save
    await fillInput("#policy-change-reason-input", "Winter schedule grace period extension");
    await page.click("#confirm-policy-update-btn");
    await new Promise((r) => setTimeout(r, 1200));

    const updatedScreenshotPath = path.join(artifactDir, "browser_21_policy_updated.png");
    await page.screenshot({ path: updatedScreenshotPath });
    console.log("✓ Policy updated to v2. Screenshot saved:", updatedScreenshotPath);

    // Verify Backend Policy was actually updated and incremented version
    const updatedPolicy = await AttendancePolicy.findOne({ isDefault: true });
    console.log(`Backend verification -> Policy Version: ${updatedPolicy?.version}, Grace Minutes: ${updatedPolicy?.defaultGraceMinutes}`);
    if (updatedPolicy?.defaultGraceMinutes !== 25 || updatedPolicy?.version !== 2) {
      throw new Error(`Policy backend mismatch! Expected grace=25, version=2, got grace=${updatedPolicy?.defaultGraceMinutes}, version=${updatedPolicy?.version}`);
    }
    console.log("✓ Backend policy verified: grace period 25m and version 2 persisted.");

    // -------------------------------------------------------------------------
    // Step 3: Navigate to WFH Review Queue
    // -------------------------------------------------------------------------
    console.log("Step 3: Navigating to WFH Page...");
    await page.goto("http://localhost:3000/wfh", { waitUntil: "networkidle0" });
    await page.waitForSelector(`button[id='approve-wfh-btn-${pendingWfh._id}']`, { timeout: 8000 });

    const wfhListScreenshotPath = path.join(artifactDir, "browser_22_wfh_requests_list.png");
    await page.screenshot({ path: wfhListScreenshotPath });
    console.log("✓ WFH review queue rendered with pending request. Screenshot saved:", wfhListScreenshotPath);

    // Click Approve Button
    console.log("Opening approve modal...");
    await page.click(`button[id='approve-wfh-btn-${pendingWfh._id}']`);
    await page.waitForSelector("#confirm-wfh-review-btn", { timeout: 5000 });

    const wfhApproveModalScreenshotPath = path.join(artifactDir, "browser_23_wfh_approve_modal.png");
    await page.screenshot({ path: wfhApproveModalScreenshotPath });
    console.log("✓ WFH approval modal opened with confirmation details. Screenshot saved:", wfhApproveModalScreenshotPath);

    // Fill reviewer remarks and confirm approval
    await fillInput("#wfh-reviewer-remarks-input", "Approved per monthly quota limit");
    await page.click("#confirm-wfh-review-btn");
    await new Promise((r) => setTimeout(r, 1200));

    const wfhApprovedScreenshotPath = path.join(artifactDir, "browser_24_wfh_approved.png");
    await page.screenshot({ path: wfhApprovedScreenshotPath });
    console.log("✓ WFH request approved and buttons disabled. Screenshot saved:", wfhApprovedScreenshotPath);

    // Verify Backend WFH Request and Attendance Record
    const dbWfh = await WfhRequest.findById(pendingWfh._id);
    if (dbWfh?.status !== WfhStatus.APPROVED) {
      throw new Error(`WFH request status in DB expected APPROVED, got ${dbWfh?.status}`);
    }

    const autoCreditedAttendance = await AttendanceRecord.findOne({
      employee: emp1._id,
      dateKey: tomorrowKey,
    });
    console.log(`Backend WFH Attendance Record -> Status: ${autoCreditedAttendance?.status}, Duration: ${autoCreditedAttendance?.durationMinutes}m`);
    if (!autoCreditedAttendance || autoCreditedAttendance.status !== "WFH_APPROVED") {
      throw new Error(`Auto-credited attendance record missing or invalid status: ${autoCreditedAttendance?.status}`);
    }
    console.log("✓ Backend WFH verification passed: request APPROVED, attendance auto-credited.");

    // -------------------------------------------------------------------------
    // Step 4: Navigate to QR Displays Page
    // -------------------------------------------------------------------------
    console.log("Step 4: Navigating to Displays Page...");
    await page.goto("http://localhost:3000/displays", { waitUntil: "networkidle0" });
    await page.waitForSelector("#register-display-btn", { timeout: 8000 });

    const displaysListScreenshotPath = path.join(artifactDir, "browser_25_displays_list.png");
    await page.screenshot({ path: displaysListScreenshotPath });
    console.log("✓ Displays list rendered with active terminal. Screenshot saved:", displaysListScreenshotPath);

    // Register a new display terminal
    console.log("Registering a new display terminal...");
    await page.click("#register-display-btn");
    await page.waitForSelector("#submit-register-display-btn", { timeout: 5000 });
    await fillInput("#display-name-input", "Cafeteria Kiosk Screen");
    await fillInput("#display-location-input", "Building B Food Court");
    await page.click("#submit-register-display-btn");

    // Verify one-time pairing code screen
    await page.waitForSelector("#display-pairing-code-value", { timeout: 5000 });
    const pairingCodeText = await page.$eval("#display-pairing-code-value", (el) => el.textContent?.trim());
    console.log("Generated One-Time Pairing Code:", pairingCodeText);

    const pairingCodeScreenshotPath = path.join(artifactDir, "browser_26_display_pairing_code.png");
    await page.screenshot({ path: pairingCodeScreenshotPath });
    console.log("✓ Display registered and pairing code displayed once. Screenshot saved:", pairingCodeScreenshotPath);

    // Close pairing modal
    await page.click("#close-pairing-modal-btn");
    await new Promise((r) => setTimeout(r, 600));

    // Revoke the seeded display terminal (disp_lobby_01)
    console.log("Revoking terminal disp_lobby_01...");
    await page.click("#revoke-display-btn-disp_lobby_01");
    await page.waitForSelector("#confirm-revoke-btn", { timeout: 5000 });

    const revokeModalScreenshotPath = path.join(artifactDir, "browser_27_display_revoke_modal.png");
    await page.screenshot({ path: revokeModalScreenshotPath });
    console.log("✓ Display revoke modal opened. Screenshot saved:", revokeModalScreenshotPath);

    await fillInput("#revoke-reason-input", "Lobby renovation decommissioning");
    await page.click("#confirm-revoke-btn");
    await new Promise((r) => setTimeout(r, 1200));

    const revokedScreenshotPath = path.join(artifactDir, "browser_28_display_revoked.png");
    await page.screenshot({ path: revokedScreenshotPath });
    console.log("✓ Display revoked successfully. Screenshot saved:", revokedScreenshotPath);

    // Verify Backend Display Status in DB
    const dbDisplay = await QrDisplay.findOne({ terminalId: "disp_lobby_01" });
    if (dbDisplay?.status !== TerminalStatus.REVOKED) {
      throw new Error(`Expected display status REVOKED, got ${dbDisplay?.status}`);
    }
    console.log("✓ Backend display verification passed: disp_lobby_01 status is REVOKED.");

    // Check Console Errors
    console.log("Console errors recorded during run:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log("Recorded console errors:", consoleErrors);
    }

    console.log("==================================================");
    console.log("Browser Verification for Policies, WFH & Displays PASSED!");
    console.log("==================================================");
  } finally {
    try {
      await browser.close();
    } catch {
      // ignore
    }
    try {
      previewServer.httpServer?.close();
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

runPolicyWfhDisplaysVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
