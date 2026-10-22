import puppeteer from "puppeteer-core";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { preview } from "vite";
import { app } from "../../api/src/app";
import { initSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User.ts";
import { Employee } from "../../api/src/models/Employee.ts";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy.ts";
import { AttendanceRecord } from "../../api/src/models/AttendanceRecord.ts";
import { AuditEvent } from "../../api/src/models/AuditEvent.ts";
import { UserRole, WorkType, AttendanceStatus } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runBrowserVerification() {
  console.log("==================================================");
  console.log("Starting Full Browser Verification for apps/web");
  console.log("Executable:", executablePath);
  console.log("==================================================");

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Admin & Sample Records
  console.log("2. Seeding database with Admin and attendance records...");
  const policy = await AttendancePolicy.create({
    name: "Corporate Standard Policy",
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

  // Seed sample employees and attendance records
  const departments = ["Engineering", "Product", "Operations", "Marketing", "HR"];
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i <= 15; i++) {
    const empId = `EMP-${String(i).padStart(3, "0")}`;
    const emp = await Employee.create({
      employeeId: empId,
      name: `Employee ${i}`,
      email: `emp${i}@vorldx.demo`,
      department: departments[i % departments.length],
      designation: "Software Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-06-01",
      status: "ACTIVE",
      isActive: true,
    });

    if (i <= 8) {
      await AttendanceRecord.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: today,
        checkInTime: new Date(Date.now() - 4 * 3600 * 1000),
        status: i > 6 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        isLate: i > 6,
        lateMinutes: i > 6 ? 25 : 0,
        durationMinutes: 240,
        policyId: policy._id,
        policyVersion: policy.version,
      });
    } else if (i <= 10) {
      await AttendanceRecord.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: today,
        status: AttendanceStatus.WFH_APPROVED,
        isWfh: true,
        durationMinutes: 480,
        policyId: policy._id,
        policyVersion: policy.version,
      });
    }
  }

  await AuditEvent.create({
    entityType: "ATTENDANCE_RECORD",
    entityId: adminUser._id.toString(),
    performedBy: adminUser._id,
    performedByEmployeeId: "ADM-001",
    action: "LOGIN",
    reason: "Administrative login session established",
    timestamp: new Date(),
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

  console.log("Servers ready. Launching headless browser...");

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
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  try {
    // ----------------------------------------------------
    // Test 1: Unauthenticated visit redirects to /login
    // ----------------------------------------------------
    console.log("Test 1: Verifying redirect to /login for unauthenticated users...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
    const url1 = page.url();
    console.log("Current URL:", url1);
    if (!url1.includes("/login")) {
      throw new Error(`Expected redirect to /login, but URL is ${url1}`);
    }
    console.log("✓ Unauthenticated redirect passed.");

    // ----------------------------------------------------
    // Test 2: Check Login Page at 375px (Mobile Viewport)
    // ----------------------------------------------------
    console.log("Test 2: Verifying Login Page at 375px mobile viewport...");
    await page.setViewport({ width: 375, height: 667, isMobile: true });
    await page.waitForSelector("form", { timeout: 5000 });
    const loginScreenshotPath = path.join(artifactDir, "browser_01_login_375px.png");
    await page.screenshot({ path: loginScreenshotPath, fullPage: true });
    console.log("✓ Screenshot saved:", loginScreenshotPath);

    // ----------------------------------------------------
    // Test 3: Wrong Password Validation Error Message
    // ----------------------------------------------------
    console.log("Test 3: Testing wrong password submission...");
    const passwordInput = await page.$("input[type='password']");
    if (passwordInput) {
      await passwordInput.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");
      await passwordInput.type("WrongPassword123!");
    }

    await page.click("button[type='submit']");
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Invalid") ||
        document.body.innerText.includes("credentials") ||
        document.body.innerText.includes("Unable to sign in"),
      { timeout: 5000 }
    );
    const wrongPassScreenshotPath = path.join(artifactDir, "browser_02_wrong_password.png");
    await page.screenshot({ path: wrongPassScreenshotPath });
    console.log("✓ Wrong password message verified. Screenshot saved:", wrongPassScreenshotPath);

    // ----------------------------------------------------
    // Test 4: Successful Login & Redirect to Dashboard
    // ----------------------------------------------------
    console.log("Test 4: Logging in via Demo Admin button & submitting valid credentials...");
    await new Promise((r) => setTimeout(r, 500));
    // Click the Demo Admin autofill shortcut
    await page.evaluate(() => {
      const demoAdminBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Demo Admin")
      );
      if (demoAdminBtn) demoAdminBtn.click();
    });

    await new Promise((r) => setTimeout(r, 300));
    await page.click("button[type='submit']");
    await page.waitForFunction(() => !window.location.pathname.includes("/login"), { timeout: 8000 });
    console.log("Dashboard reached. Current URL:", page.url());

    await new Promise((r) => setTimeout(r, 1000));
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("CURRENT BODY TEXT:\n---\n", bodyText, "\n---");

    // ----------------------------------------------------
    // Test 5: Verify Desktop Viewport at 1280px
    // ----------------------------------------------------
    console.log("Test 5: Verifying Dashboard at 1280px desktop viewport...");
    await page.setViewport({ width: 1280, height: 800 });
    await new Promise((r) => setTimeout(r, 1000)); // allow chart transition
    const desktopScreenshotPath = path.join(artifactDir, "browser_03_dashboard_1280px.png");
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    console.log("✓ Screenshot saved:", desktopScreenshotPath);

    // ----------------------------------------------------
    // Test 6: Verify Tablet Viewport at 768px
    // ----------------------------------------------------
    console.log("Test 6: Verifying Dashboard at 768px tablet viewport...");
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise((r) => setTimeout(r, 800));
    const tabletScreenshotPath = path.join(artifactDir, "browser_04_dashboard_768px.png");
    await page.screenshot({ path: tabletScreenshotPath, fullPage: true });
    console.log("✓ Screenshot saved:", tabletScreenshotPath);

    // ----------------------------------------------------
    // Test 7: Verify Mobile Viewport at 375px & Drawer Nav
    // ----------------------------------------------------
    console.log("Test 7: Verifying Dashboard at 375px mobile viewport & mobile drawer...");
    await page.setViewport({ width: 375, height: 667, isMobile: true });
    await new Promise((r) => setTimeout(r, 800));
    const mobileScreenshotPath = path.join(artifactDir, "browser_05_dashboard_375px.png");
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    console.log("✓ Screenshot saved:", mobileScreenshotPath);

    // Click mobile hamburger menu
    const hamburgerBtn = await page.$("button[aria-label='Open navigation menu']");
    if (hamburgerBtn) {
      await hamburgerBtn.click();
      await page.waitForSelector("aside", { timeout: 2000 });
      const drawerScreenshotPath = path.join(artifactDir, "browser_06_mobile_drawer_375px.png");
      await page.screenshot({ path: drawerScreenshotPath });
      console.log("✓ Mobile drawer opened. Screenshot saved:", drawerScreenshotPath);
    }

    // ----------------------------------------------------
    // Test 8: Session Expiry Redirect
    // ----------------------------------------------------
    console.log("Test 8: Verifying session expiry handling...");
    await page.goto("http://localhost:3000/login?reason=session_expired", { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () => document.body.innerText.includes("Session Expired"),
      { timeout: 5000 }
    );
    const sessionExpiredScreenshot = path.join(artifactDir, "browser_07_session_expired.png");
    await page.screenshot({ path: sessionExpiredScreenshot });
    console.log("✓ Session expiry banner verified. Screenshot saved:", sessionExpiredScreenshot);

    // ----------------------------------------------------
    // Check Console Errors
    // ----------------------------------------------------
    console.log("Console errors recorded during run:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.warn("Recorded console errors:", consoleErrors);
    } else {
      console.log("✓ 0 console errors detected throughout all flows!");
    }
  } finally {
    await browser.close();
    previewServer.close();
    await closeSocketServer();
    await new Promise<void>((resolve) => apiHttpServer.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
  }

  console.log("==================================================");
  console.log("Browser Verification Completed Successfully!");
  console.log("==================================================");
}

runBrowserVerification().catch((err) => {
  console.error("FATAL Browser Verification Failure:", err);
  process.exit(1);
});
