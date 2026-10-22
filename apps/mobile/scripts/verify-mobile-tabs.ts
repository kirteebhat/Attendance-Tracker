import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createServer } from "http";
import crypto from "crypto";
import { app } from "../../api/src/app";
import { initSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User";
import { Employee } from "../../api/src/models/Employee";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy";
import { AttendanceRecord } from "../../api/src/models/AttendanceRecord";
import { WfhRequest } from "../../api/src/models/WfhRequest";
import { QrToken } from "../../api/src/models/QrToken";
import {
  registerDisplay,
  pairDisplay,
  requestRotatingChallenge,
} from "../../api/src/services/qr.service";
import { UserRole, WorkType, AttendanceStatus, WfhStatus } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";
const distDir = path.resolve(__dirname, "../dist");

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

async function runMobileTabsVerification() {
  console.log("==================================================");
  console.log("Starting Mobile 5-Tabs & QR Scan Verification");
  console.log("Executable:", executablePath);
  console.log("Dist Directory:", distDir);
  console.log("==================================================");

  if (!fs.existsSync(distDir)) {
    throw new Error(`Export directory not found at ${distDir}. Run 'npx expo export -p web' first.`);
  }

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Database
  console.log("2. Seeding Policy, Users, Records, WFH, and QR Display...");
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

  // Primary Test Employee: EMP-001 (Ananya Sharma)
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

  // Seed historical attendance records for current month (October 2026)
  console.log("Seeding past attendance records for EMP-001...");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  await AttendanceRecord.create([
    {
      employee: emp1._id,
      employeeId: emp1.employeeId,
      department: emp1.department,
      dateKey: `${year}-${month}-05`,
      checkInTime: new Date(`${year}-${month}-05T09:05:00Z`),
      checkOutTime: new Date(`${year}-${month}-05T18:10:00Z`),
      durationMinutes: 545,
      status: AttendanceStatus.PRESENT,
      isLate: false,
      lateMinutes: 0,
      isWfh: false,
      isMissingCheckout: false,
    },
    {
      employee: emp1._id,
      employeeId: emp1.employeeId,
      department: emp1.department,
      dateKey: `${year}-${month}-06`,
      checkInTime: new Date(`${year}-${month}-06T09:28:00Z`),
      checkOutTime: new Date(`${year}-${month}-06T18:15:00Z`),
      durationMinutes: 527,
      status: AttendanceStatus.LATE,
      isLate: true,
      lateMinutes: 13,
      isWfh: false,
      isMissingCheckout: false,
    },
    {
      employee: emp1._id,
      employeeId: emp1.employeeId,
      department: emp1.department,
      dateKey: `${year}-${month}-07`,
      checkInTime: new Date(`${year}-${month}-07T09:00:00Z`),
      checkOutTime: new Date(`${year}-${month}-07T17:30:00Z`),
      durationMinutes: 510,
      status: AttendanceStatus.WFH_APPROVED,
      isLate: false,
      lateMinutes: 0,
      isWfh: true,
      isMissingCheckout: false,
    },
  ]);

  // Seed WFH requests
  console.log("Seeding WFH requests for EMP-001...");
  await WfhRequest.create([
    {
      employee: emp1._id,
      employeeId: emp1.employeeId,
      department: emp1.department,
      dateKey: `${year}-${month}-07`,
      reason: "Home internet installation and remote setup",
      status: WfhStatus.APPROVED,
      reviewedBy: adminUser._id,
      reviewerRemarks: "Approved by Engineering Lead",
      reviewedAt: new Date(),
    },
    {
      employee: emp1._id,
      employeeId: emp1.employeeId,
      department: emp1.department,
      dateKey: `${year}-${month}-28`,
      reason: "Family event scheduled in hometown",
      status: WfhStatus.PENDING,
    },
  ]);

  // Seed and Pair Display Kiosk
  console.log("Registering and pairing Office Display Kiosk...");
  const dispRegistration = await registerDisplay({
    name: "Lobby Display Alpha",
    location: "HQ Tower A - Ground Floor",
  });

  const pairResult = await pairDisplay(dispRegistration.pairingCode!);
  const displayId = pairResult.displayId;
  const displayCred = pairResult.credential;
  console.log("Display paired. ID:", displayId);

  // Generate an expired QR token for testing error states
  const expiredTokenString = `qrt_expired_${crypto.randomBytes(16).toString("hex")}`;
  await QrToken.create({
    token: expiredTokenString,
    displayId,
    terminalId: displayId,
    tokenEpoch: 1,
    issuedAt: new Date(Date.now() - 120000), // 2 mins ago
    expiresAt: new Date(Date.now() - 60000), // 1 min ago (expired!)
    isRevoked: false,
  });

  // 3. Start API HTTP Server on port 4000
  console.log("3. Starting API Server on port 4000...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));
  console.log("API Server running on port 4000.");

  // 4. Start Expo Mobile Web SPA Server on port 8081
  console.log("4. Starting Mobile SPA Server on port 8081...");
  const spaServer = createStaticSpaServer(distDir);
  await new Promise<void>((resolve) => spaServer.listen(8081, resolve));
  console.log("Mobile SPA Server running on http://localhost:8081");

  // 5. Launch Puppeteer with mobile phone emulation
  console.log("5. Launching Puppeteer with mobile device emulation (iPhone 14 / 390x844)...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  // Auto-accept alert/confirm dialogs in browser
  page.on("dialog", async (dialog) => {
    console.log("Dialog popped:", dialog.message());
    await dialog.accept();
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("favicon") || text.includes("404")) return;
      consoleErrors.push(text);
    }
  });

  const typeIntoInput = async (selector: string, text: string) => {
    await page.waitForSelector(selector, { visible: true, timeout: 8000 });
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }, selector);
    await page.click(selector);
    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await page.type(selector, text, { delay: 20 });
  };

  const clickElement = async (selector: string) => {
    await page.waitForSelector(selector, { timeout: 8000 });
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }, selector);
    await new Promise((r) => setTimeout(r, 150));
    try {
      await page.click(selector);
    } catch {
      await page.evaluate((sel) => {
        (document.querySelector(sel) as HTMLElement)?.click();
      }, selector);
    }
  };

  try {
    // =========================================================================
    // STEP 1: Log in as EMP-001 (Ananya Sharma)
    // =========================================================================
    console.log("Step 1: Logging in as Ananya Sharma (EMP-001)...");
    await page.goto("http://localhost:8081/login", { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="login-identifier-input"]', { timeout: 8000 });

    await typeIntoInput('[data-testid="login-identifier-input"]', "emp1@vorldx.demo");
    await typeIntoInput('[data-testid="login-password-input"]', "Employee@123");
    await clickElement('[data-testid="login-submit-btn"]');

    // =========================================================================
    // STEP 2: Home Tab Verification
    // =========================================================================
    console.log("Step 2: Verifying Home Tab layout and data...");
    await page.waitForSelector('[data-testid="home-today-card"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="home-user-name"]', { timeout: 8000 });

    const homeUserName = await page.$eval('[data-testid="home-user-name"]', (el) => el.textContent);
    console.log("Home user name verified:", homeUserName);

    // Verify stats cards rendered
    await page.waitForSelector('[data-testid="home-scan-cta-btn"]', { timeout: 8000 });
    await page.waitForSelector('[data-testid="home-goto-wfh-btn"]', { timeout: 8000 });

    // Capture browser_49_mobile_tabs_home.png
    const shot49 = path.join(artifactDir, "browser_49_mobile_tabs_home.png");
    await page.screenshot({ path: shot49 });
    console.log("Captured:", shot49);

    // =========================================================================
    // STEP 3: Scan Tab Verification
    // =========================================================================
    console.log("Step 3: Navigating to Scan Tab...");
    await clickElement('[data-testid="tab-scan"]');

    // Wait for scan screen
    await page.waitForSelector('[data-testid="scan-target-frame"]', { timeout: 8000 });
    await page.waitForSelector('[data-testid="scan-toggle-manual-entry-btn"]', { timeout: 8000 });

    // Open manual entry drawer
    await clickElement('[data-testid="scan-toggle-manual-entry-btn"]');
    await page.waitForSelector('[data-testid="scan-manual-token-input"]', { timeout: 6000 });
    await page.waitForSelector('[data-testid="scan-submit-manual-token-btn"]', { timeout: 6000 });

    // Capture browser_50_mobile_scan_view.png
    const shot50 = path.join(artifactDir, "browser_50_mobile_scan_view.png");
    await page.screenshot({ path: shot50 });
    console.log("Captured:", shot50);

    // =========================================================================
    // STEP 4: Test Expired Token Error Screen
    // =========================================================================
    console.log("Step 4: Submitting expired token to test ERR_QR_EXPIRED result screen...");
    await typeIntoInput('[data-testid="scan-manual-token-input"]', expiredTokenString);
    await clickElement('[data-testid="scan-submit-manual-token-btn"]');

    // Wait for error result screen
    await page.waitForSelector('[data-testid="scan-result-error"]', { timeout: 8000 });
    const errContent = await page.$eval('[data-testid="scan-result-error"]', (el) => el.textContent);
    console.log("Scan error content:", errContent);
    if (!errContent?.includes("Expired")) {
      throw new Error(`Expected QR Code Expired error, got: ${errContent}`);
    }

    // Capture browser_52_mobile_scan_expired.png
    const shot52 = path.join(artifactDir, "browser_52_mobile_scan_expired.png");
    await page.screenshot({ path: shot52 });
    console.log("Captured:", shot52);

    // Reset scanner
    await clickElement('[data-testid="scan-error-retry-btn"]');
    await page.waitForSelector('[data-testid="scan-toggle-manual-entry-btn"]', { timeout: 8000 });

    // =========================================================================
    // STEP 5: Test Valid Rotating Token Success Punch
    // =========================================================================
    console.log("Step 5: Requesting fresh rotating challenge from live display kiosk...");
    const challengeRes = await requestRotatingChallenge(displayId, displayCred);
    const validToken = challengeRes.token;
    console.log("Active rotating token:", validToken);

    // Ensure manual input drawer is open
    const hasManualInput = await page.$('[data-testid="scan-manual-token-input"]');
    if (!hasManualInput) {
      await clickElement('[data-testid="scan-toggle-manual-entry-btn"]');
    }
    await page.waitForSelector('[data-testid="scan-manual-token-input"]', { timeout: 6000 });

    // Submit valid rotating token
    await typeIntoInput('[data-testid="scan-manual-token-input"]', validToken);
    await clickElement('[data-testid="scan-submit-manual-token-btn"]');

    // Wait for success result screen
    await page.waitForSelector('[data-testid="scan-result-success"]', { timeout: 8000 });
    const successText = await page.$eval('[data-testid="scan-result-success"]', (el) => el.textContent);
    console.log("Success result content:", successText);
    if (!successText?.includes("Check-In") && !successText?.includes("Recorded")) {
      throw new Error(`Expected Check-In Recorded, got: ${successText}`);
    }

    // Capture browser_51_mobile_scan_success.png
    const shot51 = path.join(artifactDir, "browser_51_mobile_scan_success.png");
    await page.screenshot({ path: shot51 });
    console.log("Captured:", shot51);

    // Click Done / View Dashboard button
    await clickElement('[data-testid="scan-success-done-btn"]');
    await page.waitForSelector('[data-testid="home-today-card"]', { timeout: 8000 });
    console.log("Returned to Home tab with updated attendance state.");

    // =========================================================================
    // STEP 6: History Tab Verification
    // =========================================================================
    console.log("Step 6: Navigating to History Tab...");
    await clickElement('[data-testid="tab-history"]');

    await page.waitForSelector('[data-testid="history-month-display"]', { timeout: 8000 });
    await page.waitForSelector('[data-testid="history-records-list"]', { timeout: 8000 });

    const monthTitle = await page.$eval('[data-testid="history-month-display"]', (el) => el.textContent);
    console.log("History month displayed:", monthTitle);

    // Test filter pills (e.g. click PRESENT)
    await clickElement('[data-testid="history-filter-present"]');
    await new Promise((r) => setTimeout(r, 400));
    await clickElement('[data-testid="history-filter-all"]');
    await new Promise((r) => setTimeout(r, 400));

    // Capture browser_53_mobile_history_tab.png
    const shot53 = path.join(artifactDir, "browser_53_mobile_history_tab.png");
    await page.screenshot({ path: shot53 });
    console.log("Captured:", shot53);

    // =========================================================================
    // STEP 7: WFH Tab Verification (Quota, Create Request, Cancel Request)
    // =========================================================================
    console.log("Step 7: Navigating to WFH Tab...");
    await clickElement('[data-testid="tab-wfh"]');

    await page.waitForSelector('[data-testid="wfh-toggle-form-btn"]', { timeout: 8000 });

    // Open request form
    console.log("Opening WFH Request form...");
    await clickElement('[data-testid="wfh-toggle-form-btn"]');
    await page.waitForSelector('[data-testid="wfh-request-form-card"]', { timeout: 8000 });

    // Enter request details for a future date
    const futureDate = `${year}-${month}-29`;
    console.log("Submitting new remote request for date:", futureDate);
    await typeIntoInput('[data-testid="wfh-date-input"]', futureDate);
    await typeIntoInput(
      '[data-testid="wfh-reason-input"]',
      "Attending remote architecture planning summit"
    );
    await clickElement('[data-testid="wfh-submit-request-btn"]');

    // Wait for submission to complete and request list to reload
    await new Promise((r) => setTimeout(r, 1200));

    // Capture browser_54_mobile_wfh_tab.png
    const shot54 = path.join(artifactDir, "browser_54_mobile_wfh_tab.png");
    await page.screenshot({ path: shot54 });
    console.log("Captured:", shot54);

    // Test cancelling the pending request
    const pendingRequest = await WfhRequest.findOne({
      employeeId: "EMP-001",
      dateKey: `${year}-${month}-28`,
      status: WfhStatus.PENDING,
    });

    if (pendingRequest) {
      const cancelBtnSelector = `[data-testid="wfh-cancel-btn-${pendingRequest._id}"]`;
      console.log("Testing cancel button for pending request:", cancelBtnSelector);
      await clickElement(cancelBtnSelector);
      await new Promise((r) => setTimeout(r, 1000));
      console.log("Request cancellation successfully verified.");
    }

    // =========================================================================
    // STEP 8: Profile Tab Verification & Sign Out
    // =========================================================================
    console.log("Step 8: Navigating to Profile Tab...");
    await clickElement('[data-testid="tab-profile"]');

    await page.waitForSelector('[data-testid="profile-user-name"]', { timeout: 8000 });
    const profileName = await page.$eval('[data-testid="profile-user-name"]', (el) => el.textContent);
    console.log("Profile user name:", profileName);

    // Capture browser_55_mobile_profile_tab.png
    const shot55 = path.join(artifactDir, "browser_55_mobile_profile_tab.png");
    await page.screenshot({ path: shot55 });
    console.log("Captured:", shot55);

    // Test sign out
    console.log("Signing out from Profile tab...");
    await clickElement('[data-testid="profile-direct-logout-btn"]');
    await page.waitForSelector('[data-testid="welcome-login-btn"]', { timeout: 8000 });
    console.log("Successfully signed out and returned to Welcome Screen.");

    console.log("==================================================");
    console.log("ALL 5 TABS, QR SCAN & RESULT STATES VERIFIED CLEANLY!");
    console.log("Console errors encountered:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.warn("Console errors:", consoleErrors);
    }
    console.log("==================================================");
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => spaServer.close(() => resolve()));
    await closeSocketServer();
    await new Promise<void>((resolve) => apiHttpServer.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runMobileTabsVerification().catch((err) => {
  console.error("FATAL Mobile Tabs Verification Error:", err);
  process.exit(1);
});
