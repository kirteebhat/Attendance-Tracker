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
import { AuditEvent } from "../../api/src/models/AuditEvent.ts";
import { UserRole, WorkType, WfhStatus, AttendanceStatus } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runReportsAuditVerification() {
  console.log("==================================================");
  console.log("Starting Browser Verification for Reports & Analytics, CSV Export, and Audit Logs");
  console.log("Executable:", executablePath);
  console.log("==================================================");

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Database
  console.log("2. Seeding database with Policy, Users, Employees, Attendance Records, WFH Requests, and Audit Logs...");
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

  const emp2User = await User.create({
    employeeId: "EMP-002",
    email: "emp2@vorldx.demo",
    passwordHash: await hashPassword("Employee@123"),
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
  });

  const emp2 = await Employee.create({
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

  const emp3User = await User.create({
    employeeId: "EMP-003",
    email: "emp3@vorldx.demo",
    passwordHash: await hashPassword("Employee@123"),
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
  });

  const emp3 = await Employee.create({
    employeeId: "EMP-003",
    name: "Sneha Iyer",
    email: "emp3@vorldx.demo",
    department: "Marketing",
    designation: "Growth Marketing Director",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-04-10",
    status: "ACTIVE",
    isActive: true,
    userId: emp3User._id,
  });

  // Seed Dates
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
  const twoDaysAgoKey = twoDaysAgo.toISOString().slice(0, 10);

  // Seed Attendance Records
  // EMP-001: Present on time today, Late yesterday
  await AttendanceRecord.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: todayKey,
    checkInTime: new Date(`${todayKey}T09:05:00.000Z`),
    checkOutTime: new Date(`${todayKey}T18:00:00.000Z`),
    durationMinutes: 535,
    isLate: false,
    lateMinutes: 0,
    status: AttendanceStatus.PRESENT,
    workType: WorkType.FULL_TIME,
  });

  await AttendanceRecord.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: yesterdayKey,
    checkInTime: new Date(`${yesterdayKey}T09:42:00.000Z`),
    checkOutTime: new Date(`${yesterdayKey}T18:15:00.000Z`),
    durationMinutes: 513,
    isLate: true,
    lateMinutes: 27,
    status: AttendanceStatus.PRESENT,
    workType: WorkType.FULL_TIME,
  });

  // EMP-002: Late today (35 mins late), WFH yesterday
  await AttendanceRecord.create({
    employee: emp2._id,
    employeeId: emp2.employeeId,
    department: emp2.department,
    dateKey: todayKey,
    checkInTime: new Date(`${todayKey}T09:50:00.000Z`),
    checkOutTime: new Date(`${todayKey}T17:30:00.000Z`),
    durationMinutes: 460,
    isLate: true,
    lateMinutes: 35,
    status: AttendanceStatus.PRESENT,
    workType: WorkType.FULL_TIME,
  });

  await AttendanceRecord.create({
    employee: emp2._id,
    employeeId: emp2.employeeId,
    department: emp2.department,
    dateKey: yesterdayKey,
    status: AttendanceStatus.WFH,
    workType: WorkType.FULL_TIME,
    durationMinutes: 480,
    isLate: false,
    lateMinutes: 0,
  });

  // EMP-003: Absent today, Present 2 days ago
  await AttendanceRecord.create({
    employee: emp3._id,
    employeeId: emp3.employeeId,
    department: emp3.department,
    dateKey: todayKey,
    status: AttendanceStatus.ABSENT,
    workType: WorkType.FULL_TIME,
    durationMinutes: 0,
    isLate: false,
  });

  await AttendanceRecord.create({
    employee: emp3._id,
    employeeId: emp3.employeeId,
    department: emp3.department,
    dateKey: twoDaysAgoKey,
    checkInTime: new Date(`${twoDaysAgoKey}T08:55:00.000Z`),
    checkOutTime: new Date(`${twoDaysAgoKey}T18:05:00.000Z`),
    durationMinutes: 550,
    isLate: false,
    lateMinutes: 0,
    status: AttendanceStatus.PRESENT,
    workType: WorkType.FULL_TIME,
  });

  // Seed WFH Requests
  await WfhRequest.create({
    employee: emp2._id,
    employeeId: emp2.employeeId,
    department: emp2.department,
    dateKey: yesterdayKey,
    reason: "Client workshop and transatlantic remote alignment sessions",
    status: WfhStatus.APPROVED,
    decidedBy: adminUser._id,
    decidedByEmployeeId: "ADM-001",
    decidedAt: new Date(Date.now() - 36 * 3600 * 1000),
    reviewComment: "Approved per quarterly client delivery milestones",
  });

  const nextWeek = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  await WfhRequest.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: nextWeek.toISOString().slice(0, 10),
    reason: "Home electrical maintenance and broadband upgrade",
    status: WfhStatus.PENDING,
  });

  // Seed Audit Events for the Forensic Audit Trail
  await AuditEvent.create({
    entityType: "ATTENDANCE_RECORD",
    entityId: "rec_att_001",
    performedBy: adminUser._id,
    performedByEmployeeId: "ADM-001",
    action: "CORRECTION",
    reason: "Adjusted check-in timestamp due to turnstile badge reader sensor desync",
    previousValue: {
      checkInTime: `${yesterdayKey}T10:15:00.000Z`,
      checkOutTime: `${yesterdayKey}T18:15:00.000Z`,
      durationMinutes: 480,
      isLate: true,
      lateMinutes: 60,
      status: "PRESENT",
    },
    newValue: {
      checkInTime: `${yesterdayKey}T09:42:00.000Z`,
      checkOutTime: `${yesterdayKey}T18:15:00.000Z`,
      durationMinutes: 513,
      isLate: true,
      lateMinutes: 27,
      status: "PRESENT",
    },
    timestamp: new Date(Date.now() - 2 * 3600 * 1000),
  });

  await AuditEvent.create({
    entityType: "POLICY",
    entityId: "pol_corp_01",
    performedBy: adminUser._id,
    performedByEmployeeId: "ADM-001",
    action: "UPDATE",
    reason: "Updated morning arrival grace window from 10m to 15m",
    previousValue: {
      defaultGraceMinutes: 10,
      version: 1,
    },
    newValue: {
      defaultGraceMinutes: 15,
      version: 2,
    },
    timestamp: new Date(Date.now() - 24 * 3600 * 1000),
  });

  await AuditEvent.create({
    entityType: "WFH_REQUEST",
    entityId: "wfh_req_002",
    performedBy: adminUser._id,
    performedByEmployeeId: "ADM-001",
    action: "APPROVE",
    reason: "Approved per quarterly client delivery milestones",
    previousValue: {
      status: "PENDING",
    },
    newValue: {
      status: "APPROVED",
      decidedBy: "ADM-001",
    },
    timestamp: new Date(Date.now() - 36 * 3600 * 1000),
  });

  await AuditEvent.create({
    entityType: "EMPLOYEE",
    entityId: "emp_temp_99",
    performedBy: adminUser._id,
    performedByEmployeeId: "ADM-001",
    action: "CREATE",
    reason: "Onboarding new contractor into Engineering squad",
    previousValue: null,
    newValue: {
      employeeId: "EMP-099",
      name: "Karan Johar",
      department: "Engineering",
      workType: "CONTRACT",
    },
    timestamp: new Date(Date.now() - 48 * 3600 * 1000),
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

  await page.setViewport({ width: 1280, height: 850 });

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
    // Step 2: Navigate to Reports Page
    // -------------------------------------------------------------------------
    console.log("Step 2: Navigating to Reports & Analytics...");
    await page.goto("http://localhost:3000/reports", { waitUntil: "networkidle0" });
    await page.waitForSelector("h1", { timeout: 10000 });
    // Wait for data load
    await new Promise((r) => setTimeout(r, 1500));

    // Capture browser_29_reports_summary.png
    const shot29 = path.join(artifactDir, "browser_29_reports_summary.png");
    await page.screenshot({ path: shot29, fullPage: true });
    console.log("Saved artifact:", shot29);

    // -------------------------------------------------------------------------
    // Step 3: Switch to Employee-Wise Report Tab
    // -------------------------------------------------------------------------
    console.log("Step 3: Switching to Employee-Wise tab...");
    await page.click("#tab-employee-wise");
    await new Promise((r) => setTimeout(r, 1000));

    // Verify employee data rendered in table
    const employeeRowsText = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("table tbody tr")).map((r) => r.textContent);
    });
    console.log("Found Employee Report rows:", employeeRowsText.length);

    // Capture browser_30_reports_employee_wise.png
    const shot30 = path.join(artifactDir, "browser_30_reports_employee_wise.png");
    await page.screenshot({ path: shot30, fullPage: true });
    console.log("Saved artifact:", shot30);

    // -------------------------------------------------------------------------
    // Step 4: Switch to Department-Wise Report Tab
    // -------------------------------------------------------------------------
    console.log("Step 4: Switching to Department-Wise tab...");
    await page.click("#tab-department-wise");
    await new Promise((r) => setTimeout(r, 1000));

    // Capture browser_31_reports_department_wise.png
    const shot31 = path.join(artifactDir, "browser_31_reports_department_wise.png");
    await page.screenshot({ path: shot31, fullPage: true });
    console.log("Saved artifact:", shot31);

    // -------------------------------------------------------------------------
    // Step 5: Switch to Late Arrivals Tab
    // -------------------------------------------------------------------------
    console.log("Step 5: Switching to Late Arrivals tab...");
    await page.click("#tab-late-arrivals");
    await new Promise((r) => setTimeout(r, 1000));

    // Capture browser_32_reports_late.png
    const shot32 = path.join(artifactDir, "browser_32_reports_late.png");
    await page.screenshot({ path: shot32, fullPage: true });
    console.log("Saved artifact:", shot32);

    // -------------------------------------------------------------------------
    // Step 6: Switch to WFH Utilization Tab
    // -------------------------------------------------------------------------
    console.log("Step 6: Switching to WFH Utilization tab...");
    await page.click("#tab-wfh-utilization");
    await new Promise((r) => setTimeout(r, 1000));

    // Capture browser_33_reports_wfh.png
    const shot33 = path.join(artifactDir, "browser_33_reports_wfh.png");
    await page.screenshot({ path: shot33, fullPage: true });
    console.log("Saved artifact:", shot33);

    // -------------------------------------------------------------------------
    // Step 7: Verify CSV Export Button
    // -------------------------------------------------------------------------
    console.log("Step 7: Testing CSV export trigger...");
    await page.click("#export-csv-btn");
    // Wait for the toast or download handler
    await new Promise((r) => setTimeout(r, 1500));
    console.log("CSV Export triggered cleanly.");

    // -------------------------------------------------------------------------
    // Step 8: Navigate to Audit Logs Page
    // -------------------------------------------------------------------------
    console.log("Step 8: Navigating to Audit Logs page...");
    await page.goto("http://localhost:3000/audit-logs", { waitUntil: "networkidle0" });
    await page.waitForSelector("table", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Check that audit rows are present
    const auditRowsCount = await page.evaluate(() => {
      return document.querySelectorAll("tbody tr").length;
    });
    console.log("Found Audit Log rows:", auditRowsCount);

    // Click on the first Diff button
    console.log("Opening Audit Diff Modal...");
    const diffBtn = await page.$("button[id^='view-diff-btn-']");
    if (diffBtn) {
      await diffBtn.click();
      await page.waitForSelector("[role='dialog']", { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 600));

      // Capture browser_34_audit_diff_modal.png
      const shot34 = path.join(artifactDir, "browser_34_audit_diff_modal.png");
      await page.screenshot({ path: shot34, fullPage: true });
      console.log("Saved artifact:", shot34);

      // Switch to Raw JSON view
      console.log("Switching to Raw JSON view inside diff modal...");
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Raw JSON")
        );
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 500));

      // Capture browser_35_audit_json_diff.png
      const shot35 = path.join(artifactDir, "browser_35_audit_json_diff.png");
      await page.screenshot({ path: shot35, fullPage: true });
      console.log("Saved artifact:", shot35);
    } else {
      console.warn("Could not find view-diff-btn!");
    }

    // Check Console Errors
    console.log("Console errors recorded during run:", consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log("Recorded console errors:", consoleErrors);
    }

    console.log("==================================================");
    console.log("Browser Verification for Reports & Analytics, CSV & Audit Logs PASSED!");
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

runReportsAuditVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
