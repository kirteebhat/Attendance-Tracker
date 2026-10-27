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
import { CalendarEvent } from "../../api/src/models/CalendarEvent.ts";
import { WfhRequest } from "../../api/src/models/WfhRequest.ts";
import { UserRole, WorkType, AttendanceStatus, WfhStatus } from "@vorldx/shared";
import { env } from "../../api/src/config/env.ts";
import jwt from "jsonwebtoken";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runCalendarVerification() {
  console.log("==================================================");
  console.log("Starting Full Verification of Calendar Module");
  console.log("Executable:", executablePath);
  console.log("==================================================");

  // 1. In-Memory MongoDB
  console.log("1. Starting MongoMemoryServer...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Data
  console.log("2. Seeding policy, admin user, calendar events, WFH, and absences...");
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

  const empDoc = await Employee.create({
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

  const curYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split("T")[0];

  // Seed Calendar Events
  await CalendarEvent.create([
    {
      type: "holiday",
      title: "Republic Day",
      startDate: new Date(`${curYear}-01-26T00:00:00.000Z`),
      endDate: new Date(`${curYear}-01-26T23:59:59.999Z`),
      isFullDay: true,
      source: "manual",
      audience: { scope: "all" },
    },
    {
      type: "holiday",
      title: "Independence Day",
      startDate: new Date(`${curYear}-08-15T00:00:00.000Z`),
      endDate: new Date(`${curYear}-08-15T23:59:59.999Z`),
      isFullDay: true,
      source: "manual",
      audience: { scope: "all" },
    },
    {
      type: "companyOffDay",
      title: "Annual Founder's Off-Day",
      startDate: new Date(`${todayStr}T00:00:00.000Z`),
      endDate: new Date(`${todayStr}T23:59:59.999Z`),
      isFullDay: true,
      source: "manual",
      audience: { scope: "all" },
    },
    {
      type: "meeting",
      title: "Engineering Sprint Review",
      startDate: new Date(`${todayStr}T10:00:00.000Z`),
      endDate: new Date(`${todayStr}T11:00:00.000Z`),
      isFullDay: false,
      source: "manual",
      audience: { scope: "department", departments: ["Engineering"] },
    },
  ]);

  // Seed Approved WFH request on today
  await WfhRequest.create({
    employee: empDoc._id,
    employeeId: empDoc.employeeId,
    department: empDoc.department,
    dateKey: todayStr,
    reason: "Remote Architecture Planning Day",
    status: WfhStatus.APPROVED,
    reviewedBy: adminUser._id,
    reviewedAt: new Date(),
  });

  // Seed Absent record on today
  const absentEmp = await Employee.create({
    employeeId: "EMP-099",
    name: "Rahul Verma",
    email: "rahul@vorldx.demo",
    department: "Marketing",
    designation: "Marketing Lead",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-02-01",
    status: "ACTIVE",
    isActive: true,
  });

  await AttendanceRecord.create({
    employee: absentEmp._id,
    employeeId: absentEmp.employeeId,
    department: absentEmp.department,
    dateKey: todayStr,
    status: AttendanceStatus.ABSENT,
    durationMinutes: 0,
    policyId: policy._id,
    policyVersion: policy.version,
  });

  // Generate Admin JWT Token
  const jwtSecret = env.JWT_SECRET;
  const adminToken = jwt.sign(
    {
      userId: adminUser._id.toString(),
      employeeId: adminUser.employeeId,
      role: adminUser.role,
      email: adminUser.email,
    },
    jwtSecret,
    { expiresIn: "1d" }
  );

  // 3. Start API HTTP Server on port 4000
  console.log("3. Starting API Server on port 4000...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));

  // 4. Start Vite Web Preview Server on port 3000
  console.log("4. Starting Vite Web Preview Server on port 3000...");
  const webRootDir = path.resolve(__dirname, "..");
  const previewServer = await preview({
    root: webRootDir,
    server: { port: 3000 },
    preview: { port: 3000 },
  });

  console.log("Servers ready. Launching two browsers for dual verification...");

  // 5. Launch Puppeteer
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1440, height: 900 });

  // Handle localStorage auth on page1
  await page1.goto("http://localhost:3000/login");
  await page1.evaluate(
    ({ token, userDoc }) => {
      localStorage.setItem("vorldx_access_token", token);
      localStorage.setItem("vorldx_cached_user", JSON.stringify(userDoc));
    },
    {
      token: adminToken,
      userDoc: {
        _id: adminUser._id.toString(),
        employeeId: "ADM-001",
        email: "admin@vorldx.demo",
        role: "ADMIN",
        status: "ACTIVE",
      },
    }
  );

  // Navigate to Calendar
  console.log("Navigating Page 1 to /calendar...");
  await page1.goto("http://localhost:3000/calendar", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500));

  // Screenshot 1: Month View
  console.log("Taking screenshot 1: Month View...");
  await page1.screenshot({
    path: path.join(artifactDir, "calendar_1_month_view.png"),
    fullPage: true,
  });

  // Switch to Week View
  console.log("Testing Week View...");
  const weekBtn = await page1.waitForSelector('button[title*="Week View"]');
  if (weekBtn) await weekBtn.click();
  await new Promise((r) => setTimeout(r, 1000));
  await page1.screenshot({
    path: path.join(artifactDir, "calendar_2_week_view.png"),
    fullPage: true,
  });

  // Switch to Year View
  console.log("Testing Year View...");
  const yearBtn = await page1.waitForSelector('button[title*="Year View"]');
  if (yearBtn) await yearBtn.click();
  await new Promise((r) => setTimeout(r, 1000));
  await page1.screenshot({
    path: path.join(artifactDir, "calendar_3_year_view.png"),
    fullPage: true,
  });

  // Switch back to Month View
  const monthBtn = await page1.waitForSelector('button[title*="Month View"]');
  if (monthBtn) await monthBtn.click();
  await new Promise((r) => setTimeout(r, 800));

  // Test Drawer: Open Add Calendar Entry
  console.log("Testing Drawer: Add Calendar Entry...");
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const addBtn = buttons.find((b) => b.textContent?.includes("Add Calendar Entry"));
    addBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Type title
  const titleInput = await page1.$('input[placeholder*="Republic Day"]');
  if (titleInput) {
    await titleInput.type("Quarterly Strategy All-Hands");
  }
  await page1.screenshot({
    path: path.join(artifactDir, "calendar_4_drawer_add.png"),
  });

  // Close drawer
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const cancelBtn = buttons.find((b) => b.textContent?.trim() === "Cancel");
    cancelBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Test Import Holidays Modal
  console.log("Testing Import Holidays Modal...");
  await page1.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const importBtn = buttons.find((b) => b.textContent?.includes("Import Holidays"));
    importBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  await page1.screenshot({
    path: path.join(artifactDir, "calendar_5_import_preview_modal.png"),
  });

  // Close Import Modal
  await page1.evaluate(() => {
    const modal = document.querySelector('div[role="dialog"]');
    if (modal) {
      const buttons = Array.from(modal.querySelectorAll("button"));
      const cancelBtn = buttons.find((b) => b.textContent?.trim() === "Cancel");
      cancelBtn?.click();
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  // Test Two Browsers simultaneously for Live Socket Sync!
  console.log("5. Testing Two Browsers with Real-time Socket Event Delivery...");
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1440, height: 900 });
  await page2.goto("http://localhost:3000/login");
  await page2.evaluate(
    ({ token, userDoc }) => {
      localStorage.setItem("vorldx_access_token", token);
      localStorage.setItem("vorldx_cached_user", JSON.stringify(userDoc));
    },
    {
      token: adminToken,
      userDoc: {
        _id: adminUser._id.toString(),
        employeeId: "ADM-001",
        email: "admin@vorldx.demo",
        role: "ADMIN",
        status: "ACTIVE",
      },
    }
  );

  await page2.goto("http://localhost:3000/calendar", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1000));

  // Browser 1 creates an event via API
  console.log("Browser 1 creates 'Global Technology Symposium'...");
  await CalendarEvent.create({
    type: "event",
    title: "Global Technology Symposium",
    startDate: new Date(`${todayStr}T09:00:00.000Z`),
    endDate: new Date(`${todayStr}T17:00:00.000Z`),
    isFullDay: true,
    source: "manual",
    audience: { scope: "all" },
  });

  // Emit calendar.updated through socket server
  const { eventEmitterService } = await import("../../api/src/services/eventEmitter.service.ts");
  eventEmitterService.emit("calendar.updated", {
    action: "create",
    event: { title: "Global Technology Symposium" },
    timestamp: new Date().toISOString(),
  });

  // Wait for Browser 2 to receive the event and re-render
  console.log("Waiting for Browser 2 to receive real-time socket event...");
  await new Promise((r) => setTimeout(r, 2000));

  await page2.screenshot({
    path: path.join(artifactDir, "calendar_6_browser2_live_synced.png"),
    fullPage: true,
  });

  console.log("All screenshots saved to:", artifactDir);
  console.log("Closing browsers and servers...");

  await browser.close();
  await previewServer.close();
  await new Promise<void>((resolve) => apiHttpServer.close(() => resolve()));
  closeSocketServer();
  await mongoose.disconnect();
  await mongod.stop();

  console.log("Verification finished successfully!");
}

runCalendarVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
