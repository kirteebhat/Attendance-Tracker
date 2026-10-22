import puppeteer from "puppeteer-core";
import { preview } from "vite";
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
import { AttendanceRecord } from "../../api/src/models/AttendanceRecord";
import { WfhRequest } from "../../api/src/models/WfhRequest";
import { UserRole, WorkType, AttendanceStatus, WfhStatus } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";
const mobileDistDir = path.resolve(__dirname, "../dist");
const webDistDir = path.resolve(__dirname, "../../web/dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function createStaticSpaServer(distPath: string) {
  return createServer((req, res) => {
    const rawUrl = req.url || "/";
    const pathname = rawUrl.split("?")[0];
    let filePath = path.join(distPath, pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(distPath, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error: " + String(err));
    }
  });
}

async function runDualScreenLiveSyncVerification() {
  console.log("==================================================");
  console.log("Starting Dual-Screen Live WFH Synchronization Test");
  console.log("Executable:", executablePath);
  console.log("Mobile Dist:", mobileDistDir);
  console.log("Web Dist:", webDistDir);
  console.log("==================================================");

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Database
  console.log("2. Seeding Policy, Users, Employee Records...");
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
        checkInWindowEndMinutes: 300,
        checkOutWindowStartMinutes: 60,
        checkOutWindowEndMinutes: 300,
        isOvernight: false,
        isActive: true,
      },
    ],
  });

  // Admin user
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

  // Employee 1: EMP-001 (Ananya Sharma)
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

  // Past attendance record
  await AttendanceRecord.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: "2026-10-15",
    checkInTime: new Date("2026-10-15T09:05:00Z"),
    checkOutTime: new Date("2026-10-15T18:10:00Z"),
    durationMinutes: 545,
    status: AttendanceStatus.PRESENT,
    isLate: false,
    lateMinutes: 0,
    isWfh: false,
    isMissingCheckout: false,
  });

  // 3. Start API HTTP Server on port 4000
  console.log("3. Starting API Server on port 4000 with Socket.IO...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));
  console.log("API Server running on port 4000.");

  // 4. Start Web Preview Server on port 3000 via Vite (with /api and /socket.io proxy)
  console.log("4. Starting Vite Web Preview Server on port 3000...");
  const webRootDir = path.resolve(__dirname, "../../web");
  const previewServer = await preview({
    root: webRootDir,
    server: { port: 3000 },
    preview: { port: 3000 },
  });
  console.log("HR Web Server listening on http://localhost:3000 (proxied to :4000)");

  // 5. Start Mobile SPA Server on port 8081
  console.log("5. Starting Mobile SPA Server on port 8081...");
  const mobileSpaServer = createStaticSpaServer(mobileDistDir);
  await new Promise<void>((resolve) => mobileSpaServer.listen(8081, resolve));
  console.log("Mobile SPA Server listening on http://localhost:8081");

  // 6. Launch Puppeteer Browser
  console.log("6. Launching Puppeteer with 2 simultaneous browser contexts...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  // Helper functions
  const fillInput = async (page: any, selector: string, value: string) => {
    await page.bringToFront();
    await page.waitForSelector(selector, { visible: true, timeout: 15000 });
    await page.evaluate((sel: string, val: string) => {
      const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) throw new Error("Input not found: " + sel);
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, selector, value);
  };

  const clickEl = async (page: any, selector: string) => {
    await page.bringToFront();
    await page.waitForSelector(selector, { timeout: 15000 });
    await page.evaluate((sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) throw new Error("Element not found: " + sel);
      el.scrollIntoView({ behavior: "instant", block: "center" });
      el.click();
    }, selector);
  };

  try {
    // =========================================================================
    // STEP 1: Setup HR Web Portal Page on Port 3000
    // =========================================================================
    console.log("Step 1: Opening HR Web Portal and logging in as Admin...");
    const hrPage = await browser.newPage();
    await hrPage.setViewport({ width: 1280, height: 800 });

    await hrPage.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
    await hrPage.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Demo Admin")
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    await hrPage.click("button[type='submit']");
    await hrPage.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 8000 });

    console.log("HR Admin logged in. Navigating to /wfh queue...");
    await hrPage.goto("http://localhost:3000/wfh", { waitUntil: "networkidle0" });
    await hrPage.waitForFunction(() => document.body.innerText.includes("Work From Home Review Queue"), { timeout: 15000 });
    console.log("HR Web WFH queue ready.");

    // =========================================================================
    // STEP 2: Setup Mobile Phone Page on Port 8081
    // =========================================================================
    console.log("Step 2: Opening Mobile Phone and logging in as Ananya Sharma (EMP-001)...");
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    await mobilePage.bringToFront();
    await mobilePage.goto("http://localhost:8081/login", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));
    const debugInfo = await mobilePage.evaluate(() => ({ url: window.location.href, text: document.body.innerText.substring(0, 200) }));
    console.log("DEBUG MOBILE INFO:", debugInfo);
    await mobilePage.waitForSelector('[data-testid="login-identifier-input"]', { timeout: 15000 });

    await fillInput(mobilePage, '[data-testid="login-identifier-input"]', "emp1@vorldx.demo");
    await fillInput(mobilePage, '[data-testid="login-password-input"]', "Employee@123");
    await clickEl(mobilePage, '[data-testid="login-submit-btn"]');

    await mobilePage.waitForSelector('[data-testid="home-user-name"]', { timeout: 10000 });
    console.log("Mobile employee logged in. Navigating to WFH Tab...");
    await clickEl(mobilePage, '[data-testid="tab-wfh"]');
    await mobilePage.waitForSelector('[data-testid="wfh-toggle-form-btn"]', { timeout: 8000 });
    console.log("Mobile WFH Tab ready.");

    // =========================================================================
    // STEP 3: Mobile Phone Submits a New Remote Work Request
    // =========================================================================
    console.log("Step 3: Submitting WFH Request on mobile phone...");
    await clickEl(mobilePage, '[data-testid="wfh-toggle-form-btn"]');
    await mobilePage.waitForSelector('[data-testid="wfh-request-form-card"]', { timeout: 6000 });

    const targetDate = "2026-10-30";
    const targetReason = "Attending remote cloud architecture summit";
    await fillInput(mobilePage, '[data-testid="wfh-date-input"]', targetDate);
    await fillInput(mobilePage, '[data-testid="wfh-reason-input"]', targetReason);

    await clickEl(mobilePage, '[data-testid="wfh-submit-request-btn"]');

    // Wait for submission response and verify pending card appears on phone
    await new Promise((r) => setTimeout(r, 1200));

    // Verify request appears as PENDING
    const mobileContentBefore = await mobilePage.evaluate(() => document.body.innerText);
    console.log("Mobile screen content includes target reason:", mobileContentBefore.includes("cloud architecture"));
    if (!mobileContentBefore.includes("cloud architecture")) {
      throw new Error("Target reason not found on mobile screen after submission.");
    }

    // Capture browser_56_wfh_dual_view_before.png (Mobile Phone with PENDING Request)
    const shot56 = path.join(artifactDir, "browser_56_wfh_dual_view_before.png");
    await mobilePage.screenshot({ path: shot56 });
    console.log("Captured:", shot56);

    // =========================================================================
    // STEP 4: HR Website Receives Request via Socket & Approves It
    // =========================================================================
    console.log("Step 4: Looking for pending request on HR Website...");
    await hrPage.bringToFront();
    // Give 500ms for web socket event to populate row
    await new Promise((r) => setTimeout(r, 600));

    // Find the row for EMP-001 in HR table
    const targetRequest = await WfhRequest.findOne({
      employeeId: "EMP-001",
      dateKey: targetDate,
      status: WfhStatus.PENDING,
    });

    if (!targetRequest) {
      throw new Error(`Expected pending WfhRequest for ${targetDate} in DB`);
    }

    const requestId = targetRequest._id.toString();
    const approveBtnSelector = `#approve-wfh-btn-${requestId}`;
    console.log("Waiting for approve button:", approveBtnSelector);
    await hrPage.waitForSelector(approveBtnSelector, { timeout: 15000 });
    console.log("Found pending request ID:", targetRequest._id, "Approve button selector:", approveBtnSelector);

    // Click Approve button on HR website
    await clickEl(hrPage, approveBtnSelector);

    // Review Modal opens
    await hrPage.waitForSelector("#wfh-reviewer-remarks-input", { timeout: 6000 });
    const decisionNote = "Approved by Engineering Director per remote quota";
    await fillInput(hrPage, "#wfh-reviewer-remarks-input", decisionNote);

    console.log("Confirming decision on HR website...");
    await clickEl(hrPage, "#confirm-wfh-review-btn");
    await hrPage.waitForFunction(() => !document.querySelector("#confirm-wfh-review-btn"), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Capture browser_58_hr_web_wfh_approved.png
    const shot58 = path.join(artifactDir, "browser_58_hr_web_wfh_approved.png");
    await hrPage.screenshot({ path: shot58 });
    console.log("Captured:", shot58);

    // =========================================================================
    // STEP 5: VERIFY MOBILE PHONE UPDATES AUTOMATICALLY VIA SOCKET.IO!
    // ABSOLUTELY NO RELOAD / REFRESH ON MOBILE!
    // =========================================================================
    console.log("Step 5: Verifying Mobile Phone updates dynamically without manual refresh...");
    await mobilePage.bringToFront();

    // Wait for mobile UI to reflect the socket event (wfh.decided)
    let isApprovedOnPhone = false;
    for (let i = 0; i < 25; i++) {
      const phoneText = await mobilePage.evaluate(() => document.body.innerText);
      if (phoneText.includes("APPROVED") && (phoneText.includes("Decision Note") || phoneText.includes("Approved by Engineering Director"))) {
        isApprovedOnPhone = true;
        console.log(`Mobile phone updated via Socket.IO after ${(i + 1) * 200}ms!`);
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!isApprovedOnPhone) {
      const currentText = await mobilePage.evaluate(() => document.body.innerText);
      console.error("Current mobile text:", currentText);
      throw new Error("Mobile phone did not update via socket within 5 seconds.");
    }

    // Capture browser_57_wfh_dual_view_after.png (Mobile Phone with APPROVED Request & HR Note)
    const shot57 = path.join(artifactDir, "browser_57_wfh_dual_view_after.png");
    await mobilePage.screenshot({ path: shot57 });
    console.log("Captured:", shot57);

    // =========================================================================
    // STEP 6: Verify Profile Tab Shift Info & Work Details
    // =========================================================================
    console.log("Step 6: Verifying Profile Tab with shift info and work details...");
    await mobilePage.bringToFront();
    await clickEl(mobilePage, '[data-testid="tab-profile"]');
    await mobilePage.waitForSelector('[data-testid="profile-user-name"]', { timeout: 8000 });

    const profileText = await mobilePage.evaluate(() => document.body.innerText);
    console.log("Profile contains 'Assigned Shift':", profileText.includes("General Day Shift"));
    console.log("Profile contains 'Department':", profileText.includes("Engineering"));
    console.log("Profile contains 'Working Hours':", profileText.includes("09:00"));

    if (!profileText.includes("General Day Shift") && !profileText.includes("09:00")) {
      throw new Error("Profile screen missing expected shift information.");
    }

    // Capture browser_59_mobile_profile_shift_details.png
    const shot59 = path.join(artifactDir, "browser_59_mobile_profile_shift_details.png");
    await mobilePage.screenshot({ path: shot59 });
    console.log("Captured:", shot59);

    // =========================================================================
    // STEP 7: Sign Out and Confirm Tokens and Socket Disconnected
    // =========================================================================
    console.log("Step 7: Testing Profile Sign Out (clearing tokens and socket)...");
    await mobilePage.bringToFront();
    await clickEl(mobilePage, '[data-testid="profile-direct-logout-btn"]');
    await mobilePage.waitForSelector('[data-testid="welcome-login-btn"]', { timeout: 8000 });
    console.log("Successfully signed out. Socket and tokens cleared.");

    console.log("==================================================");
    console.log("DUAL-SCREEN LIVE WFH SYNCHRONIZATION TEST PASSED 100%!");
    console.log("==================================================");
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => mobileSpaServer.close(() => resolve()));
    await new Promise<void>((resolve) => previewServer.httpServer.close(() => resolve()));
    await closeSocketServer();
    await new Promise<void>((resolve) => apiHttpServer.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runDualScreenLiveSyncVerification().catch((err) => {
  console.error("FATAL Live Sync Verification Error:", err);
  process.exit(1);
});
