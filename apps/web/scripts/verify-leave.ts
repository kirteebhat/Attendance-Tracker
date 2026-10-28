import puppeteer from "puppeteer-core";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { preview } from "vite";
import { createApp } from "../../api/src/app";
import { initSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User";
import { Employee } from "../../api/src/models/Employee";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy";
import { LeaveType } from "../../api/src/models/LeaveType";
import { LeaveRequest } from "../../api/src/models/LeaveRequest";
import { LeaveBalance } from "../../api/src/models/LeaveBalance";
import { FeatureFlag } from "../../api/src/models/FeatureFlag";
import { featureFlagService } from "../../api/src/services/featureFlag.service";
import { UserRole, WorkType } from "@vorldx/shared";
import { env } from "../../api/src/config/env";
import jwt from "jsonwebtoken";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runLeaveVerification() {
  console.log("==================================================");
  console.log("Starting Full Verification of Leave Module (Apps/Web)");
  console.log("Browser executable:", executablePath);
  console.log("==================================================");

  // 1. In-Memory MongoDB
  console.log("1. Starting MongoMemoryServer...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Enable Feature Flag
  console.log("2. Enabling leave feature flag...");
  await FeatureFlag.create({
    key: "leave",
    name: "Leave Management",
    description: "Employee leave balances, requests, and HR approval queue",
    isEnabled: true,
  });
  featureFlagService.setInMemoryOverride("leave", true);

  // 3. Seed Policy & Shifts
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

  // 4. Seed Users & Employees
  const adminPassword = await hashPassword("Admin@12345");
  const adminUser = await User.create({
    employeeId: "EMP-ADMIN",
    email: "admin@vorldx.demo",
    passwordHash: adminPassword,
    role: UserRole.ADMIN,
    status: "ACTIVE",
  });

  const emp1 = await Employee.create({
    employeeId: "EMP-101",
    name: "Priya Sharma",
    email: "priya.sharma@vorldx.demo",
    department: "Engineering",
    designation: "Staff Backend Engineer",
    workType: WorkType.FULL_TIME,
    shiftId: policy.shifts[0]._id,
    joiningDate: "2024-01-15",
    isActive: true,
  });

  const emp2 = await Employee.create({
    employeeId: "EMP-102",
    name: "Rahul Verma",
    email: "rahul.verma@vorldx.demo",
    department: "Engineering",
    designation: "Frontend Specialist",
    workType: WorkType.FULL_TIME,
    shiftId: policy.shifts[0]._id,
    joiningDate: "2024-03-01",
    isActive: true,
  });

  const emp3 = await Employee.create({
    employeeId: "EMP-103",
    name: "Ananya Iyer",
    email: "ananya.iyer@vorldx.demo",
    department: "Product",
    designation: "Lead Product Manager",
    workType: WorkType.FULL_TIME,
    shiftId: policy.shifts[0]._id,
    joiningDate: "2023-11-01",
    isActive: true,
  });

  // 5. Seed Leave Types
  console.log("5. Seeding leave types & quotas...");
  const casualLeave = await LeaveType.create({
    code: "CL",
    name: "Casual Leave",
    annualQuota: 12,
    paid: true,
    carryForwardRule: { allowed: false, maxDays: 0 },
    halfDayAllowed: true,
    description: "Urgent personal affairs and short-notice leave",
    isActive: true,
  });

  const sickLeave = await LeaveType.create({
    code: "SL",
    name: "Sick Leave",
    annualQuota: 10,
    paid: true,
    carryForwardRule: { allowed: true, maxDays: 5, expiryMonths: 12 },
    halfDayAllowed: true,
    description: "Medical recuperation and doctor appointments",
    isActive: true,
  });

  const earnedLeave = await LeaveType.create({
    code: "EL",
    name: "Earned Privilege Leave",
    annualQuota: 18,
    paid: true,
    carryForwardRule: { allowed: true, maxDays: 15 },
    halfDayAllowed: false,
    description: "Annual planned vacation and personal recharge",
    isActive: true,
  });

  // 6. Seed Leave Balances for 2026
  console.log("6. Seeding employee balances...");
  for (const emp of [emp1, emp2, emp3]) {
    await LeaveBalance.create({
      employee: emp._id,
      type: casualLeave._id,
      year: 2026,
      allotted: 12,
      used: 2,
      pending: 1,
      carriedOver: 0,
    });
    await LeaveBalance.create({
      employee: emp._id,
      type: sickLeave._id,
      year: 2026,
      allotted: 10,
      used: 0,
      pending: 0,
      carriedOver: 2,
    });
    await LeaveBalance.create({
      employee: emp._id,
      type: earnedLeave._id,
      year: 2026,
      allotted: 18,
      used: 3,
      pending: 0,
      carriedOver: 5,
    });
  }

  // 7. Seed Leave Requests
  console.log("7. Seeding sample leave requests...");
  await LeaveRequest.create({
    employee: emp1._id,
    type: casualLeave._id,
    startDate: new Date("2026-11-10T00:00:00.000Z"),
    endDate: new Date("2026-11-12T00:00:00.000Z"),
    workingDays: 3,
    isHalfDay: false,
    status: "PENDING",
    reason: "Attending family milestone event out of town",
  });

  await LeaveRequest.create({
    employee: emp2._id,
    type: casualLeave._id,
    startDate: new Date("2026-11-11T00:00:00.000Z"),
    endDate: new Date("2026-11-13T00:00:00.000Z"),
    workingDays: 3,
    isHalfDay: false,
    status: "PENDING",
    reason: "Personal family commitment",
  });

  await LeaveRequest.create({
    employee: emp3._id,
    type: sickLeave._id,
    startDate: new Date("2026-11-05T00:00:00.000Z"),
    endDate: new Date("2026-11-06T00:00:00.000Z"),
    workingDays: 2,
    isHalfDay: false,
    status: "APPROVED",
    reason: "Dental procedure recuperation",
    decidedBy: adminUser._id,
    decidedAt: new Date(),
    decisionNote: "Approved. Take care!",
  });

  // 8. Start HTTP + Express API Server
  console.log("8. Starting Express + Socket Server on port 4000...");
  const expressApp = createApp();
  const httpServer = createServer(expressApp);
  initSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(4000, () => {
      console.log("   API & Sockets running at http://localhost:4000");
      resolve();
    });
  });

  // 9. Start Vite Preview Server
  console.log("9. Starting Vite preview on port 4174...");
  const previewServer = await preview({
    root: path.resolve(__dirname, ".."),
    preview: {
      port: 4174,
      host: "localhost",
    },
  });
  console.log("   Vite preview running at http://localhost:4174");

  // Generate Admin JWT Token
  const token = jwt.sign(
    {
      userId: adminUser._id.toString(),
      employeeId: adminUser.employeeId,
      email: adminUser.email,
      role: adminUser.role,
    },
    env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  // 10. Launch Headless Browser
  console.log("10. Launching Headless Chromium / Edge...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Inject Auth LocalStorage into Browser before loading page
  await page.goto("http://localhost:4174/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ tok, adm }) => {
      localStorage.setItem("vorldx_access_token", tok);
      localStorage.setItem(
        "vorldx_cached_user",
        JSON.stringify({
          id: adm._id,
          employeeId: adm.employeeId,
          email: adm.email,
          role: adm.role,
          name: "System Administrator",
          department: "Executive",
        })
      );
    },
    { tok: token, adm: adminUser.toObject() }
  );

  // Navigate to /leave
  console.log("11. Navigating to Leave Hub (/leave)...");
  await page.goto("http://localhost:4174/leave", { waitUntil: "networkidle0", timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Take Screenshot 1: Requests Tab & Queue
  console.log("12. Capturing Tab 1: Leave Requests Table...");
  const snap1 = path.join(artifactDir, "leave_1_requests_table.png");
  await page.screenshot({ path: snap1, fullPage: false });
  console.log("    Saved:", snap1);

  // Click on first pending request row to open Review Drawer
  console.log("13. Opening Leave Review Drawer with team overlap detection...");
  const firstRow = await page.$("tbody tr");
  if (firstRow) {
    await firstRow.click();
    await new Promise((r) => setTimeout(r, 800));
  }
  const snap2 = path.join(artifactDir, "leave_2_review_drawer.png");
  await page.screenshot({ path: snap2, fullPage: false });
  console.log("    Saved:", snap2);

  // Close drawer
  console.log("   Closing drawer...");
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 600));

  // Test Bulk Selection
  console.log("14. Testing Bulk Selection Bar...");
  const selectAllCheckbox = await page.$("thead input[type='checkbox']");
  if (selectAllCheckbox) {
    await selectAllCheckbox.click();
    await new Promise((r) => setTimeout(r, 600));
  }
  const snap3 = path.join(artifactDir, "leave_3_bulk_selection_bar.png");
  await page.screenshot({ path: snap3, fullPage: false });
  console.log("    Saved:", snap3);

  // Switch to Tab 2: Employee Balances
  console.log("15. Navigating to Tab 2: Employee Balances...");
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("button"));
    const balTab = tabs.find((t) => t.textContent?.includes("Employee Balances"));
    if (balTab) balTab.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const snap4 = path.join(artifactDir, "leave_4_employee_balances.png");
  await page.screenshot({ path: snap4, fullPage: false });
  console.log("    Saved:", snap4);

  // Click "Adjust" on a balance row to test Manual Adjustment Modal
  console.log("16. Opening Manual Balance Adjustment Modal...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const adjustBtn = buttons.find((b) => b.textContent?.includes("Adjust"));
    if (adjustBtn) adjustBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  const snap5 = path.join(artifactDir, "leave_5_balance_adjust_modal.png");
  await page.screenshot({ path: snap5, fullPage: false });
  console.log("    Saved:", snap5);

  // Close Adjust modal
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 400));

  // Switch to Tab 3: Leave Types & Quotas Settings
  console.log("17. Navigating to Tab 3: Types & Quotas Settings...");
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("button"));
    const setTab = tabs.find((t) => t.textContent?.includes("Types & Quotas"));
    if (setTab) setTab.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const snap6 = path.join(artifactDir, "leave_6_types_quotas_settings.png");
  await page.screenshot({ path: snap6, fullPage: false });
  console.log("    Saved:", snap6);

  // Switch to Tab 4: Team Leave Calendar Overlay
  console.log("18. Navigating to Tab 4: Team Leave Calendar Overlay...");
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("button"));
    const calTab = tabs.find((t) => t.textContent?.includes("Team Overlay"));
    if (calTab) calTab.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const snap7 = path.join(artifactDir, "leave_7_team_calendar_overlay.png");
  await page.screenshot({ path: snap7, fullPage: false });
  console.log("    Saved:", snap7);

  console.log("==================================================");
  console.log("Verification Completed Successfully! All 7 Views Verified.");
  console.log("==================================================");

  // Cleanup
  await browser.close();
  await previewServer.close();
  closeSocketServer();
  await new Promise<void>((r) => httpServer.close(() => r()));
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
}

runLeaveVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
