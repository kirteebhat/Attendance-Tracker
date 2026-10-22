import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { preview } from "vite";
import { app } from "../apps/api/src/app";
import { initSocketServer } from "../apps/api/src/sockets/socketServer";
import { User, hashPassword } from "../apps/api/src/models/User";
import { Employee } from "../apps/api/src/models/Employee";
import { AttendancePolicy } from "../apps/api/src/models/AttendancePolicy";
import { AttendanceRecord } from "../apps/api/src/models/AttendanceRecord";
import { WfhRequest } from "../apps/api/src/models/WfhRequest";
import { QrDisplay } from "../apps/api/src/models/QrDisplay";
import { UserRole, WorkType, AttendanceStatus, WfhStatus, TerminalStatus } from "@vorldx/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mobileDistDir = path.resolve(__dirname, "../apps/mobile/dist");
const webRootDir = path.resolve(__dirname, "../apps/web");

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

async function startDemoEnvironment() {
  console.log("\n=======================================================");
  console.log("🚀 Starting VorldX Attendance Demo Environment...");
  console.log("=======================================================\n");

  // 1. In-Memory Database
  console.log("📦 1. Starting In-Memory MongoDB Server...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);
  console.log("   ✓ Database connected (Zero external dependencies needed)\n");

  // 2. Seeding Core Policy & Users
  console.log("🌱 2. Seeding VorldX Company Data...");
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

  // Admin Account
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

  // HR Manager Account
  const hrPassword = await hashPassword("Hr@12345");
  const hrUser = await User.create({
    employeeId: "HR-001",
    email: "hr@vorldx.demo",
    passwordHash: hrPassword,
    role: UserRole.HR,
    status: "ACTIVE",
  });

  await Employee.create({
    employeeId: "HR-001",
    name: "Pooja Hegde",
    email: "hr@vorldx.demo",
    department: "People & Culture",
    designation: "Lead HR Manager",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-02-01",
    status: "ACTIVE",
    isActive: true,
    userId: hrUser._id,
  });

  // Employee 1: Ananya Sharma (EMP-001)
  const empPassword = await hashPassword("Employee@123");
  const emp1User = await User.create({
    employeeId: "EMP-001",
    email: "emp1@vorldx.demo",
    passwordHash: empPassword,
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

  // Employee 2: Rohan Verma (EMP-002)
  const emp2User = await User.create({
    employeeId: "EMP-002",
    email: "rohan.verma@vorldx.demo",
    passwordHash: empPassword,
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
  });

  const emp2 = await Employee.create({
    employeeId: "EMP-002",
    name: "Rohan Verma",
    email: "rohan.verma@vorldx.demo",
    department: "Product",
    designation: "Staff Product Designer",
    workType: WorkType.FULL_TIME,
    joiningDate: "2024-03-15",
    status: "ACTIVE",
    isActive: true,
    userId: emp2User._id,
  });

  // Seed sample attendance records
  await AttendanceRecord.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: "2026-10-21",
    checkInTime: new Date("2026-10-21T09:05:00Z"),
    checkOutTime: new Date("2026-10-21T18:10:00Z"),
    durationMinutes: 545,
    status: AttendanceStatus.PRESENT,
    isLate: false,
    lateMinutes: 0,
    isWfh: false,
    isMissingCheckout: false,
  });

  await AttendanceRecord.create({
    employee: emp2._id,
    employeeId: emp2.employeeId,
    department: emp2.department,
    dateKey: "2026-10-21",
    checkInTime: new Date("2026-10-21T09:25:00Z"),
    checkOutTime: new Date("2026-10-21T18:15:00Z"),
    durationMinutes: 530,
    status: AttendanceStatus.LATE,
    isLate: true,
    lateMinutes: 10,
    isWfh: false,
    isMissingCheckout: false,
  });

  // Seed pending WFH request
  await WfhRequest.create({
    employee: emp1._id,
    employeeId: emp1.employeeId,
    department: emp1.department,
    dateKey: "2026-10-29",
    reason: "Attending annual cloud infrastructure symposium",
    status: WfhStatus.PENDING,
  });

  // Seed pre-authorized display terminal
  await QrDisplay.create({
    terminalId: "DISP-LOBBY-01",
    name: "Headquarters Main Lobby Kiosk",
    location: "Building A, Ground Floor",
    status: TerminalStatus.ACTIVE,
    isActive: true,
    isPaired: true,
    pairingCode: "784912",
    pairedAt: new Date(),
    lastSeen: new Date(),
    tokenEpoch: 1,
  });

  console.log("   ✓ Seeded Admin, HR, Employees, Attendance Records, and WFH Requests\n");

  // 3. Start API HTTP Server on port 4000
  console.log("🌐 3. Starting Express REST & Socket.IO API on Port 4000...");
  const apiHttpServer = createServer(app);
  initSocketServer(apiHttpServer);
  await new Promise<void>((resolve) => apiHttpServer.listen(4000, resolve));
  console.log("   ✓ API Server running on http://localhost:4000\n");

  // 4. Start HR Web Preview Server on port 3000
  console.log("🖥️  4. Starting HR Web Portal on Port 3000...");
  await preview({
    root: webRootDir,
    server: { port: 3000 },
    preview: { port: 3000 },
  });
  console.log("   ✓ HR Web Portal running on http://localhost:3000\n");

  // 5. Start Mobile App Web SPA on port 8081
  console.log("📱 5. Starting Employee Mobile App on Port 8081...");
  const mobileSpaServer = createStaticSpaServer(mobileDistDir);
  await new Promise<void>((resolve) => mobileSpaServer.listen(8081, resolve));
  console.log("   ✓ Mobile App running on http://localhost:8081\n");

  console.log("=======================================================");
  console.log("✨ ALL SERVICES READY! YOU CAN NOW TEST IN YOUR BROWSER:");
  console.log("=======================================================\n");

  console.log("1. HR / Admin Website:");
  console.log("   👉 URL: http://localhost:3000");
  console.log("   👤 Email:    admin@vorldx.demo  (or click 'Demo Admin' button)");
  console.log("   🔑 Password: Admin@12345");
  console.log("   📋 Features to test:");
  console.log("      • Dashboard: Real-time punch metrics, 7-day trend, recent punch feed");
  console.log("      • Employees: Directory, filters, search, add/edit drawer, profile snapshot");
  console.log("      • Attendance: Ledger date picker, status badges, manual correction modal");
  console.log("      • Policies: Shifts, grace periods, WFH quota editor, holidays manager");
  console.log("      • WFH Queue: Review remote requests, approve/reject with remarks");
  console.log("      • Displays: Terminal registry, pairing codes, online status, revocation");
  console.log("      • Reports: Summary, employee/department breakdowns, CSV export");
  console.log("      • Audit Logs: Forensic delta view, before/after diffs\n");

  console.log("2. Employee Mobile App (Open in a second browser window / mobile mode):");
  console.log("   👉 URL: http://localhost:8081");
  console.log("   👤 Email:    emp1@vorldx.demo  (or EMP-001)");
  console.log("   🔑 Password: Employee@123");
  console.log("   📋 Tabs to test:");
  console.log("      • Home: Today's check-in/out status, hours, monthly statistics");
  console.log("      • Scan: QR scanner viewfinder with guidance frame & manual token drawer");
  console.log("      • History: Date-wise records, month stepper, status filter pills");
  console.log("      • WFH: Quota status, new remote request form, live approval updates");
  console.log("      • Profile: Shift details (09:00 - 18:00, 15m grace), work info, sign out\n");

  console.log("3. Test Real-Time Synchronization:");
  console.log("   Keep http://localhost:3000 and http://localhost:8081 open side-by-side!");
  console.log("   • Submit a WFH request on the phone -> It instantly pops up in the HR queue.");
  console.log("   • Click 'Approve' on the HR website -> The phone updates instantly via Socket.IO!\n");

  console.log("Press Ctrl+C to stop all servers when done.");

  const shutdown = async () => {
    console.log("\nStopping servers and cleaning up...");
    mobileSpaServer.close();
    apiHttpServer.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startDemoEnvironment().catch((err) => {
  console.error("Failed to start demo environment:", err);
  process.exit(1);
});
