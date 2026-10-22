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
import { UserRole, WorkType } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";
const distDir = path.resolve(__dirname, "../dist");

// MIME types lookup for static server
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

/**
 * Creates a lightweight static file server with SPA fallback for Expo Router
 */
function createStaticSpaServer(distPath: string) {
  return createServer((req, res) => {
    const rawUrl = req.url || "/";
    const pathname = rawUrl.split("?")[0];
    let filePath = path.join(distPath, pathname);

    // If requesting directory or root, serve index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    // SPA fallback: If file doesn't exist, serve dist/index.html
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

async function runMobileVerification() {
  console.log("==================================================");
  console.log("Starting Browser Verification for VorldX Mobile App");
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
  console.log("2. Seeding database with Policy, Admin, and Employees...");
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

  // Employee 1: EMP-001 (already registered with user account)
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

  // Employee 2: EMP-002 (unregistered employee awaiting activation)
  await Employee.create({
    employeeId: "EMP-002",
    name: "Rohan Verma",
    email: "rohan.verma@vorldx.demo",
    department: "Product Design",
    designation: "UI/UX Specialist",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-04-15",
    status: "ACTIVE",
    isActive: true,
    userId: null,
  });

  console.log("Database seeded successfully.");

  // 3. Start API HTTP Server on port 4000
  console.log("3. Starting API Server on port 4000...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));
  console.log("API Server listening on port 4000.");

  // 4. Start Expo Mobile Web SPA Server on port 8081
  console.log("4. Starting Mobile SPA Server on port 8081...");
  const spaServer = createStaticSpaServer(distDir);
  await new Promise<void>((resolve) => spaServer.listen(8081, resolve));
  console.log("Mobile SPA Server listening on http://localhost:8081");

  // 5. Launch Puppeteer in Mobile Viewport (iPhone 14 / modern Android: 390x844 or 375x812)
  console.log("5. Launching Puppeteer with mobile phone emulation...");
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

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("favicon") || text.includes("404")) return;
      consoleErrors.push(text);
    }
  });

  // Helper for typing text cleanly
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
    await page.type(selector, text, { delay: 25 });
  };

  // Helper for clicking elements safely across mobile viewport
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
    // STEP 1: Welcome Screen
    // =========================================================================
    console.log("Step 1: Navigating to Welcome Screen...");
    await page.goto("http://localhost:8081", { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="welcome-login-btn"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="welcome-register-btn"]', { timeout: 10000 });

    const shot43 = path.join(artifactDir, "browser_43_mobile_welcome.png");
    await page.screenshot({ path: shot43 });
    console.log("Captured:", shot43);

    // =========================================================================
    // STEP 2: Step 1 Registration Screen & Error Handling
    // =========================================================================
    console.log("Step 2: Testing Registration Step 1 (Employee ID input & error states)...");
    await clickElement('[data-testid="welcome-register-btn"]');
    await page.waitForSelector('[data-testid="register-employee-id-input"]', { timeout: 8000 });

    // Test non-existent employee ID EMP-999
    console.log("Submitting unknown Employee ID EMP-999...");
    await typeIntoInput('[data-testid="register-employee-id-input"]', "EMP-999");
    await clickElement('[data-testid="register-submit-btn"]');

    await page.waitForSelector('[data-testid="register-error-banner"]', { timeout: 8000 });
    const errText1 = await page.$eval('[data-testid="register-error-banner"]', (el) => el.textContent);
    console.log("Error banner for EMP-999:", errText1);
    if (!errText1?.includes("EMP-999")) {
      throw new Error(`Expected error banner to mention EMP-999, got: ${errText1}`);
    }

    // Capture browser_44_mobile_register_error.png
    const shot44 = path.join(artifactDir, "browser_44_mobile_register_error.png");
    await page.screenshot({ path: shot44 });
    console.log("Captured:", shot44);

    // Test already registered employee EMP-001
    console.log("Submitting already registered Employee ID EMP-001...");
    await typeIntoInput('[data-testid="register-employee-id-input"]', "EMP-001");
    await clickElement('[data-testid="register-submit-btn"]');

    await new Promise((r) => setTimeout(r, 600));
    const errText2 = await page.$eval('[data-testid="register-error-banner"]', (el) => el.textContent);
    console.log("Error banner for EMP-001:", errText2);
    if (!errText2?.includes("already registered")) {
      throw new Error(`Expected already registered error, got: ${errText2}`);
    }

    // =========================================================================
    // STEP 3: Step 2 OTP Verification Screen with Demo Banner
    // =========================================================================
    console.log("Step 3: Submitting valid unregistered Employee ID EMP-002...");
    await typeIntoInput('[data-testid="register-employee-id-input"]', "EMP-002");
    await clickElement('[data-testid="register-submit-btn"]');

    // Wait for transition to Verify OTP screen
    await page.waitForSelector('[data-testid="verify-otp-input"]', { timeout: 8000 });
    await page.waitForSelector('[data-testid="demo-otp-banner"]', { timeout: 8000 });

    // Capture browser_45_mobile_verify_otp.png
    const shot45 = path.join(artifactDir, "browser_45_mobile_verify_otp.png");
    await page.screenshot({ path: shot45 });
    console.log("Captured:", shot45);

    // Test submitting wrong OTP 000000
    console.log("Testing wrong OTP submission (000000)...");
    await typeIntoInput('[data-testid="verify-otp-input"]', "000000");
    await clickElement('[data-testid="verify-otp-submit-btn"]');

    await page.waitForSelector('[data-testid="verify-otp-error-banner"]', { timeout: 8000 });
    const otpErrText = await page.$eval('[data-testid="verify-otp-error-banner"]', (el) => el.textContent);
    console.log("OTP error banner:", otpErrText);
    if (!otpErrText?.includes("Incorrect")) {
      throw new Error(`Expected invalid OTP error message, got: ${otpErrText}`);
    }

    // Use Auto-Fill Demo Code button
    console.log("Clicking 'Auto-Fill Demo Code' button...");
    await clickElement('[data-testid="auto-fill-otp-btn"]');
    await new Promise((r) => setTimeout(r, 300));

    // Submit valid OTP
    console.log("Submitting verified demo OTP...");
    await clickElement('[data-testid="verify-otp-submit-btn"]');

    // =========================================================================
    // STEP 4: Step 3 Set Password Screen
    // =========================================================================
    console.log("Step 4: Waiting for Set Password Screen...");
    await page.waitForSelector('[data-testid="set-password-input"]', { timeout: 8000 });
    await page.waitForSelector('[data-testid="set-confirm-password-input"]', { timeout: 8000 });

    // Capture browser_46_mobile_set_password.png
    const shot46 = path.join(artifactDir, "browser_46_mobile_set_password.png");
    await page.screenshot({ path: shot46 });
    console.log("Captured:", shot46);

    // Enter secure password and confirm
    console.log("Entering password and completing registration...");
    await typeIntoInput('[data-testid="set-password-input"]', "MobilePass@2026");
    await typeIntoInput('[data-testid="set-confirm-password-input"]', "MobilePass@2026");
    await clickElement('[data-testid="set-password-submit-btn"]');

    // =========================================================================
    // STEP 5: Authenticated Home Profile Screen
    // =========================================================================
    console.log("Step 5: Waiting for Home Profile Screen...");
    await page.waitForSelector('[data-testid="home-user-name"]', { timeout: 10000 });
    const userName = await page.$eval('[data-testid="home-user-name"]', (el) => el.textContent);
    console.log("Home profile name:", userName);
    if (!userName?.includes("Rohan Verma")) {
      throw new Error(`Expected home profile to show Rohan Verma, got: ${userName}`);
    }

    // Capture browser_47_mobile_home_profile.png
    const shot47 = path.join(artifactDir, "browser_47_mobile_home_profile.png");
    await page.screenshot({ path: shot47 });
    console.log("Captured:", shot47);

    // =========================================================================
    // STEP 6: Sign Out and Return to Welcome Screen
    // =========================================================================
    console.log("Step 6: Signing out of account...");
    await clickElement('[data-testid="home-direct-logout-btn"]');
    await page.waitForSelector('[data-testid="welcome-login-btn"]', { timeout: 8000 });
    console.log("Successfully returned to Welcome screen.");

    // =========================================================================
    // STEP 7: Sign In Screen & Credential Validation
    // =========================================================================
    console.log("Step 7: Testing Login flow...");
    await page.goto("http://localhost:8081/login", { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="login-identifier-input"]', { timeout: 8000 });
    await page.waitForSelector('[data-testid="login-password-input"]', { timeout: 8000 });

    // Test wrong credentials
    console.log("Testing invalid credentials...");
    await typeIntoInput('[data-testid="login-identifier-input"]', "emp1@vorldx.demo");
    await typeIntoInput('[data-testid="login-password-input"]', "WrongPassword123");
    await clickElement('[data-testid="login-submit-btn"]');

    await page.waitForSelector('[data-testid="login-error-banner"]', { timeout: 8000 });
    const loginErrText = await page.$eval('[data-testid="login-error-banner"]', (el) => el.textContent);
    console.log("Login error banner:", loginErrText);

    // Test quick-fill demo account
    console.log("Testing Quick-Fill Demo Account button...");
    await clickElement('[data-testid="login-demo-fill-btn"]');
    await new Promise((r) => setTimeout(r, 400));

    // Capture browser_48_mobile_login.png
    const shot48 = path.join(artifactDir, "browser_48_mobile_login.png");
    await page.screenshot({ path: shot48 });
    console.log("Captured:", shot48);

    // Sign in
    console.log("Signing in as Ananya Sharma...");
    await clickElement('[data-testid="login-submit-btn"]');

    await page.waitForSelector('[data-testid="home-user-name"]', { timeout: 10000 });
    const emp1Name = await page.$eval('[data-testid="home-user-name"]', (el) => el.textContent);
    console.log("Signed in as:", emp1Name);
    if (!emp1Name?.includes("Ananya Sharma")) {
      throw new Error(`Expected login to show Ananya Sharma, got: ${emp1Name}`);
    }

    console.log("==================================================");
    console.log("All Mobile App UI and API flows verified cleanly!");
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

runMobileVerification().catch((err) => {
  console.error("FATAL Mobile Verification Error:", err);
  process.exit(1);
});
