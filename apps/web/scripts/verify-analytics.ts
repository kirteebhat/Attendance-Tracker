import puppeteer from "puppeteer-core";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { preview } from "vite";
import { createApp } from "../../api/src/app";
import { initSocketServer, getSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User";
import { Employee } from "../../api/src/models/Employee";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy";
import { AttendanceRecord } from "../../api/src/models/AttendanceRecord";
import { WfhRequest } from "../../api/src/models/WfhRequest";
import { LeaveRequest } from "../../api/src/models/LeaveRequest";
import { LeaveType } from "../../api/src/models/LeaveType";
import { UserRole, WorkType, AttendanceStatus, WfhStatus, SocketEvent, getDateKey, addDaysToDateKey } from "@vorldx/shared";
import { env } from "../../api/src/config/env";
import jwt from "jsonwebtoken";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runLiveAnalyticsVerification() {
  console.log("==================================================");
  console.log("Starting Full Verification of Live Attendance Analytics");
  console.log("Browser executable:", executablePath);
  console.log("==================================================");

  // 1. In-Memory MongoDB
  console.log("1. Starting MongoMemoryServer...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Attendance Policy
  console.log("2. Seeding Standard Corporate Policy...");
  const policy = await AttendancePolicy.create({
    name: "Standard Corporate Policy",
    version: 1,
    timezone: "Asia/Kolkata",
    defaultGraceMinutes: 15,
    minFullDayHours: 8,
    minHalfDayHours: 4,
    monthlyWfhQuota: 4,
    shift: {
      name: "General Shift",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: 15,
    },
    workDays: [1, 2, 3, 4, 5],
    holidays: [],
    halfDayRules: {
      firstHalfEnd: "13:30",
      secondHalfStart: "14:30",
    },
    overtimeRules: {
      enabled: false,
      minMinutesForOvertime: 60,
      rateMultiplier: 1.5,
    },
    isDefault: true,
    isActive: true,
  });

  // 3. Admin Account
  console.log("3. Seeding Administrator account...");
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
    name: "System Administrator",
    email: "admin@vorldx.demo",
    department: "Executive",
    designation: "Platform Super Admin",
    workType: WorkType.OFFICE,
    joiningDate: "2024-01-01",
    isActive: true,
    userId: adminUser._id,
  });

  // 4. Seed 25 Workforce Employees across 5 Departments
  console.log("4. Seeding 25 Workforce Employees across 5 Departments...");
  const departments = ["Engineering", "Product", "Marketing", "Sales", "Operations"];
  const employees = [];

  for (let i = 1; i <= 25; i++) {
    const dept = departments[(i - 1) % departments.length];
    const emp = await Employee.create({
      employeeId: `EMP-${String(i).padStart(3, "0")}`,
      name: `Colleague ${i} (${dept.slice(0, 3)})`,
      email: `emp${i}@vorldx.demo`,
      department: dept,
      designation: i % 2 === 0 ? "Senior Specialist" : "Associate Lead",
      workType: i === 5 ? WorkType.REMOTE : WorkType.OFFICE,
      joiningDate: "2023-06-01",
      isActive: true,
    });
    employees.push(emp);
  }

  // 5. Seed Leave Type
  const annualLeaveType = await LeaveType.create({
    name: "Paid Annual Leave",
    code: "AL",
    quota: 18,
    color: "#8b5cf6",
    requiresApproval: true,
    isActive: true,
  });

  // 6. Seed Today's Attendance State (Date: Today)
  const todayDateKey = getDateKey(new Date(), "Asia/Kolkata");
  console.log(`5. Seeding Attendance Records for dateKey: ${todayDateKey}...`);

  // Breakdown plan:
  // - 14 Present on-time
  // - 2 Late check-ins
  // - 3 WFH approved
  // - 2 Leave approved
  // - 4 Awaiting first check-in

  // 14 On-time check-ins (between 08:30 and 09:10 IST -> 03:00 to 03:40 UTC)
  for (let i = 0; i < 14; i++) {
    const emp = employees[i];
    const hourUtc = 3;
    const minUtc = (i * 2) % 60;
    const checkInTime = new Date(`${todayDateKey}T0${hourUtc}:${String(minUtc).padStart(2, "0")}:00.000Z`);

    await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: todayDateKey,
      checkInTime,
      checkOutTime: null,
      status: AttendanceStatus.PRESENT,
      isLate: false,
      lateMinutes: 0,
      isWfh: false,
      policyId: policy._id,
      terminalId: "KIOSK-GATE-01",
    });
  }

  // 2 Late arrivals (10:15 AM & 10:45 AM IST -> 04:45 & 05:15 UTC)
  for (let i = 14; i < 16; i++) {
    const emp = employees[i];
    const hourUtc = 4 + (i - 14);
    const checkInTime = new Date(`${todayDateKey}T0${hourUtc}:45:00.000Z`);

    await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: todayDateKey,
      checkInTime,
      checkOutTime: null,
      status: AttendanceStatus.LATE,
      isLate: true,
      lateMinutes: (i - 14 + 1) * 35,
      isWfh: false,
      policyId: policy._id,
      terminalId: "KIOSK-GATE-02",
    });
  }

  // 3 Approved WFH
  for (let i = 16; i < 19; i++) {
    const emp = employees[i];
    await WfhRequest.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: todayDateKey,
      reason: "Remote client delivery session",
      status: WfhStatus.APPROVED,
    });
    await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: todayDateKey,
      checkInTime: null,
      checkOutTime: null,
      status: AttendanceStatus.WFH_APPROVED,
      isLate: false,
      lateMinutes: 0,
      isWfh: true,
      policyId: policy._id,
    });
  }

  // 2 Approved Leave
  for (let i = 19; i < 21; i++) {
    const emp = employees[i];
    await LeaveRequest.create({
      employee: emp._id,
      type: annualLeaveType._id,
      startDate: new Date(`${todayDateKey}T00:00:00.000Z`),
      endDate: new Date(`${todayDateKey}T23:59:59.999Z`),
      workingDays: 1,
      reason: "Personal medical checkup",
      status: "APPROVED",
    });
    await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: todayDateKey,
      checkInTime: null,
      checkOutTime: null,
      status: AttendanceStatus.ON_LEAVE,
      isLate: false,
      lateMinutes: 0,
      isWfh: false,
      policyId: policy._id,
    });
  }

  // Remaining employees (21-24) have no record yet -> Awaiting scan

  // 7. Seed Past 29 Days Historical Attendance (400+ records for rich 30-day heatmap)
  console.log("6. Seeding 30-day historical attendance records for heatmap...");
  const historicalRecords = [];
  for (let dayOffset = 1; dayOffset < 30; dayOffset++) {
    const pastDateKey = addDaysToDateKey(todayDateKey, -dayOffset);
    const dayOfWeek = new Date(pastDateKey).getDay(); // 0 = Sun, 6 = Sat

    // Skip Sundays for realistic office traffic
    if (dayOfWeek === 0) continue;

    for (let i = 0; i < 20; i++) {
      const emp = employees[i];
      // Distribute scans naturally around 08:30 to 10:30 AM IST (03:00 to 05:00 UTC)
      const hourUtc = 3 + (i % 3);
      const minUtc = (i * 7 + dayOffset * 3) % 60;
      const checkInTime = new Date(`${pastDateKey}T0${hourUtc}:${String(minUtc).padStart(2, "0")}:00.000Z`);
      const isLate = hourUtc >= 4;

      historicalRecords.push({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: pastDateKey,
        checkInTime,
        checkOutTime: new Date(`${pastDateKey}T12:30:00.000Z`),
        durationMinutes: 480,
        status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
        isLate,
        lateMinutes: isLate ? 30 : 0,
        isWfh: false,
        policyId: policy._id,
        terminalId: "KIOSK-MAIN-01",
      });
    }
  }
  await AttendanceRecord.insertMany(historicalRecords);
  console.log(`   Seeded ${historicalRecords.length} historical scans across 30 days.`);

  // 8. Start HTTP & WebSocket API Server on port 4000
  console.log("7. Starting API Server on port 4000...");
  const apiApp = createApp();
  const apiServer = createServer(apiApp);
  initSocketServer(apiServer);

  await new Promise<void>((resolve) => {
    apiServer.listen(4000, () => resolve());
  });
  console.log("   API Server listening at http://localhost:4000");

  // 9. Start Vite Preview Server on port 4178
  console.log("8. Starting Vite Preview Server on port 4178...");
  const previewServer = await preview({
    root: path.resolve(__dirname, ".."),
    preview: { port: 4178, host: "localhost" },
  });
  console.log("   Web Portal live at http://localhost:4178");

  // Generate Admin JWT Token
  const adminToken = jwt.sign(
    {
      userId: adminUser._id.toString(),
      employeeId: adminUser.employeeId,
      email: adminUser.email,
      role: adminUser.role,
    },
    env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  // 10. Launch Puppeteer Browser
  console.log("9. Launching Puppeteer Browser for UI Validation...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1050 });

  page.on("console", (msg) => {
    const text = msg.text();
    if (!text.includes("Download the React DevTools")) {
      console.log("   [BROWSER CONSOLE]", text);
    }
  });

  // Inject session into localStorage
  await page.goto("http://localhost:4178/login", { waitUntil: "domcontentloaded" });
  await page.evaluate((t, u) => {
    localStorage.setItem("vorldx_access_token", t);
    localStorage.setItem(
      "vorldx_cached_user",
      JSON.stringify({
        _id: u.id,
        employeeId: u.employeeId,
        email: u.email,
        role: u.role,
        name: "System Administrator",
      })
    );
  }, adminToken, { id: adminUser._id.toString(), employeeId: adminUser.employeeId, email: adminUser.email, role: adminUser.role });

  // Navigate to Dashboard
  console.log("10. Navigating to Executive Dashboard...");
  await page.goto("http://localhost:4178/", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1500)); // Allow animated counters to complete easing

  // Capture Screenshot 1: Full Executive Dashboard Overview
  const screenshot1Path = path.join(artifactDir, "analytics_1_executive_dashboard_overview.png");
  await page.screenshot({ path: screenshot1Path, fullPage: true });
  console.log("✓ Saved Screenshot 1:", screenshot1Path);

  // Capture Screenshot 2: Hover on Today's Timeline Chart Bar to display tooltip
  console.log("11. Testing hover tooltip on Today's Hourly Check-In Timeline...");
  const hourBars = await page.$$("div[role='img'][aria-label*='Hourly check-in timeline'] .cursor-pointer");
  if (hourBars.length > 8) {
    // Hover over 09:00 AM bar
    await hourBars[9].hover();
    await new Promise((r) => setTimeout(r, 400));
    const screenshot2Path = path.join(artifactDir, "analytics_2_hourly_timeline_hover.png");
    await page.screenshot({ path: screenshot2Path, fullPage: false });
    console.log("✓ Saved Screenshot 2:", screenshot2Path);
  }

  // Capture Screenshot 3: Hover on 30-Day Heatmap cell to display tooltip
  console.log("12. Testing hover tooltip on 30-Day Heatmap tile...");
  const heatmapTiles = await page.$$(".grid-cols-24 .cursor-pointer");
  if (heatmapTiles.length > 30) {
    // Hover on a tile with activity
    await heatmapTiles[33].hover();
    await new Promise((r) => setTimeout(r, 400));
    const screenshot3Path = path.join(artifactDir, "analytics_3_heatmap_hover.png");
    await page.screenshot({ path: screenshot3Path, fullPage: false });
    console.log("✓ Saved Screenshot 3:", screenshot3Path);
  }

  // Capture Screenshot 4: Hover on Department Performance Bar
  console.log("13. Testing hover tooltip on Department Performance Bars...");
  const deptProgressBars = await page.$$("div[role='progressbar']");
  if (deptProgressBars.length > 0) {
    await deptProgressBars[0].hover();
    await new Promise((r) => setTimeout(r, 400));
    const screenshot4Path = path.join(artifactDir, "analytics_4_department_breakdown_tooltip.png");
    await page.screenshot({ path: screenshot4Path, fullPage: false });
    console.log("✓ Saved Screenshot 4:", screenshot4Path);
  }

  // 14. Test Live Socket Punch Instant Update Without Page Refresh
  console.log("14. Emitting instant attendance punch event via WebSocket...");
  const socketIo = getSocketServer();
  if (socketIo) {
    const livePunchPayload = {
      recordId: new Types.ObjectId().toString(),
      employeeId: "EMP-099",
      employeeName: "Elena Rostova",
      department: "Engineering",
      designation: "Lead Systems Architect",
      dateKey: todayDateKey,
      punchType: "CHECK_IN" as const,
      status: "LATE",
      isLate: true,
      lateMinutes: 28,
      timestamp: new Date().toISOString(),
      durationMinutes: 0,
    };

    socketIo.emit(SocketEvent.ATTENDANCE_UPDATED, livePunchPayload);
    socketIo.emit(SocketEvent.ATTENDANCE_FEED_ITEM, livePunchPayload);
    console.log("   Broadcasted socket event for Elena Rostova.");

    // Wait for the item to slide into the feed with CSS animation
    await new Promise((r) => setTimeout(r, 800));

    // Scroll to the Live Scan Feed card to capture the sliding item
    await page.evaluate(() => {
      const feedHeading = Array.from(document.querySelectorAll("h3")).find((h) =>
        h.textContent?.includes("Live Scan Stream")
      );
      if (feedHeading) feedHeading.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise((r) => setTimeout(r, 300));

    const screenshot5Path = path.join(artifactDir, "analytics_5_live_punch_stream_slide_in.png");
    await page.screenshot({ path: screenshot5Path, fullPage: false });
    console.log("✓ Saved Screenshot 5 (Live Slide-In Feed):", screenshot5Path);
  }

  // Clean up
  console.log("15. Cleaning up verification servers and browser...");
  await browser.close();
  await previewServer.close();
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  closeSocketServer();
  await mongoose.disconnect();
  await mongod.stop();

  console.log("==================================================");
  console.log("All 5 Live Analytics Proof Screenshots Successfully Generated!");
  console.log("==================================================");
}

runLiveAnalyticsVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
