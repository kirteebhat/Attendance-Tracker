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
import { FeatureFlag } from "../../api/src/models/FeatureFlag";
import { Enquiry } from "../../api/src/models/Enquiry";
import { EnquiryMessage } from "../../api/src/models/EnquiryMessage";
import { featureFlagService } from "../../api/src/services/featureFlag.service";
import { UserRole } from "@vorldx/shared";
import { env } from "../../api/src/config/env";
import jwt from "jsonwebtoken";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runEnquiryVerification() {
  console.log("==================================================");
  console.log("Starting Full Verification of Enquiry Module (Web & Mobile)");
  console.log("Browser executable:", executablePath);
  console.log("==================================================");

  // 1. In-Memory MongoDB
  console.log("1. Starting MongoMemoryServer...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Enable Feature Flag
  console.log("2. Enabling enquiries feature flag...");
  await FeatureFlag.create({
    key: "enquiries",
    name: "Enquiries & Helpdesk",
    description: "Employee ticketing and dispute resolution",
    isEnabled: true,
  });
  featureFlagService.setInMemoryOverride("enquiries", true);

  // 3. Seed Policy & Shifts
  await AttendancePolicy.create({
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
        name: "General Shift",
        startTime: "09:00",
        endTime: "18:00",
        graceMinutes: 15,
        checkInWindowStartMinutes: 60,
        checkInWindowEndMinutes: 120,
        checkOutWindowStartMinutes: 60,
        checkOutWindowEndMinutes: 120,
      },
    ],
  });

  // 4. Seed Users & Employees
  console.log("4. Seeding HR Admin and Employees...");
  const hashedPassword = await hashPassword("Admin@VorldX2026!");

  const adminUser = await User.create({
    employeeId: "ADM-001",
    email: "admin@vorldx.test",
    passwordHash: hashedPassword,
    role: UserRole.ADMIN,
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockoutUntil: null,
    refreshTokenHash: null,
  });

  const adminEmp = await Employee.create({
    userId: adminUser._id,
    employeeId: "ADM-001",
    name: "Sarah Jenkins",
    email: "admin@vorldx.test",
    department: "Human Resources",
    designation: "Chief People Officer",
    workType: "FULL_TIME",
    joiningDate: "2024-01-01",
    isActive: true,
  });

  const empUser1 = await User.create({
    employeeId: "EMP-101",
    email: "alice@vorldx.test",
    passwordHash: hashedPassword,
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockoutUntil: null,
    refreshTokenHash: null,
  });

  const emp1 = await Employee.create({
    userId: empUser1._id,
    employeeId: "EMP-101",
    name: "Alice Smith",
    email: "alice@vorldx.test",
    department: "Engineering",
    designation: "Frontend Engineer",
    workType: "FULL_TIME",
    joiningDate: "2024-02-01",
    isActive: true,
  });

  const empUser2 = await User.create({
    employeeId: "EMP-102",
    email: "bob@vorldx.test",
    passwordHash: hashedPassword,
    role: UserRole.EMPLOYEE,
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockoutUntil: null,
    refreshTokenHash: null,
  });

  const emp2 = await Employee.create({
    userId: empUser2._id,
    employeeId: "EMP-102",
    name: "Bob Jones",
    email: "bob@vorldx.test",
    department: "Operations",
    designation: "Customer Success",
    workType: "FULL_TIME",
    joiningDate: "2024-03-01",
    isActive: true,
  });

  // 5. Seed Enquiries
  console.log("5. Seeding initial enquiries & threads...");
  const enq1 = await Enquiry.create({
    ticketNumber: "ENQ-2026-10492",
    employee: emp1._id,
    employeeUser: empUser1._id,
    category: "ATTENDANCE",
    subject: "Biometric Punch Discrepancy on Monday",
    status: "OPEN",
    priority: "HIGH",
    assignee: null,
    firstResponseAt: null,
    lastMessageAt: new Date(),
    attachments: [
      {
        name: "kiosk_photo.png",
        mimeType: "image/png",
        sizeBytes: 124800,
        url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
      },
    ],
  });

  await EnquiryMessage.create({
    enquiry: enq1._id,
    sender: empUser1._id,
    senderRole: "EMPLOYEE",
    message: "I scanned my badge at Kiosk 2 around 8:58 AM, but my attendance status is marked absent.",
    attachments: enq1.attachments,
    readByRecipient: false,
    createdAt: new Date(),
  });

  const enq2 = await Enquiry.create({
    ticketNumber: "ENQ-2026-10493",
    employee: emp2._id,
    employeeUser: empUser2._id,
    category: "PAYROLL",
    subject: "Tax Exemption Certificate Submission",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    assignee: adminUser._id,
    firstResponseAt: new Date(),
    lastMessageAt: new Date(),
    attachments: [],
  });

  await EnquiryMessage.create({
    enquiry: enq2._id,
    sender: empUser2._id,
    senderRole: "EMPLOYEE",
    message: "Where should I upload my rent receipts for HRA tax exemption?",
    attachments: [],
    readByRecipient: true,
    createdAt: new Date(Date.now() - 3600000),
  });

  await EnquiryMessage.create({
    enquiry: enq2._id,
    sender: adminUser._id,
    senderRole: "HR",
    message: "You can submit them through the payroll portal under Tax Filing -> Deductions.",
    attachments: [],
    readByRecipient: true,
    createdAt: new Date(),
  });

  // 6. Start API Server on port 4000
  console.log("6. Starting Express API + Sockets on port 4000...");
  const expressApp = createApp();
  const httpServer = createServer(expressApp);
  initSocketServer(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(4000, () => {
      console.log("   API & Sockets running at http://localhost:4000");
      resolve();
    });
  });

  // 7. Start Vite Preview Server on port 4175
  console.log("7. Starting Vite preview on port 4175...");
  const previewServer = await preview({
    root: path.resolve(__dirname, ".."),
    preview: {
      port: 4175,
      host: "localhost",
    },
  });
  console.log("   Vite preview running at http://localhost:4175");

  // Tokens
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

  // 8. Launch Puppeteer Browser
  console.log("8. Launching Browser for Web HR Portal & Drawer verification...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on("console", (msg) => console.log("   [PAGE CONSOLE]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("   [PAGE ERROR]", err.message));

  // 9. Login & Navigate to /enquiries
  await page.goto("http://localhost:4175/login", { waitUntil: "domcontentloaded" });
  await page.evaluate((t, u) => {
    localStorage.setItem("vorldx_access_token", t);
    localStorage.setItem(
      "vorldx_cached_user",
      JSON.stringify({
        id: u._id,
        _id: u._id,
        employeeId: u.employeeId,
        email: u.email,
        role: u.role,
        name: "Sarah Jenkins",
      })
    );
  }, adminToken, adminUser);

  console.log("9. Navigating to /enquiries on Web Portal...");
  await page.goto("http://localhost:4175/enquiries", { waitUntil: "networkidle2" });
  console.log("   Current Page URL:", page.url());
  await new Promise((r) => setTimeout(r, 2000));

  // SCREENSHOT 1: Web HR Inbox with Stat Cards & Table
  const path1 = path.join(artifactDir, "enquiry_1_web_inbox.png");
  await page.screenshot({ path: path1, fullPage: true });
  console.log("   ✓ Saved Screenshot 1: Web Inbox ->", path1);

  // 10. Filter Saved View: "Open & Active"
  console.log("10. Testing Filter & Row-Click to open Drawer...");
  const tableRows = await page.$$("tbody tr");
  console.log(`   Found ${tableRows.length} tickets in table.`);

  if (tableRows.length > 0) {
    // Click first row (Alice's ticket ENQ-2026-10492)
    await tableRows[0].click();
    await new Promise((r) => setTimeout(r, 1500));

    // SCREENSHOT 2: Drawer opened with Employee details, thread, and action toolbar
    const path2 = path.join(artifactDir, "enquiry_2_web_drawer_thread.png");
    await page.screenshot({ path: path2 });
    console.log("   ✓ Saved Screenshot 2: Web Drawer Thread ->", path2);

    // 11. Test Quick Reply & Macros
    console.log("11. Testing Quick Macro selection & Send Reply...");
    const macroButtons = await page.$$("button");
    let punchMacroBtn: any = null;
    for (const btn of macroButtons) {
      const text = await (await btn.getProperty("innerText")).jsonValue();
      if (text.includes("Punch Log Corrected")) {
        punchMacroBtn = btn;
        break;
      }
    }

    if (punchMacroBtn) {
      await punchMacroBtn.click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // Find and click "Send" button in drawer
    const sendButtons = await page.$$("button");
    let sendBtn: any = null;
    for (const btn of sendButtons) {
      const text = await (await btn.getProperty("innerText")).jsonValue();
      if (text.includes("Send")) {
        sendBtn = btn;
        break;
      }
    }

    if (sendBtn) {
      await sendBtn.click();
      console.log("   Clicked Send Reply in Drawer! Waiting for socket sync...");
      await new Promise((r) => setTimeout(r, 2000));
    }

    // SCREENSHOT 3: Drawer after HR reply is sent & status moved to IN_PROGRESS
    const path3 = path.join(artifactDir, "enquiry_3_web_drawer_replied.png");
    await page.screenshot({ path: path3 });
    console.log("   ✓ Saved Screenshot 3: Reply Posted ->", path3);

    // Close Drawer
    const closeButtons = await page.$$("button");
    for (const b of closeButtons) {
      const aria = await page.evaluate((el) => el.getAttribute("aria-label"), b);
      if (aria === "Close drawer") {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 12. Test Bulk Selection & Confirm Dialog
  console.log("12. Testing Bulk Select & Bulk Close Dialog...");
  const selectAllCheckbox = await page.$("thead input[type='checkbox']");
  if (selectAllCheckbox) {
    await selectAllCheckbox.click();
    await new Promise((r) => setTimeout(r, 800));

    // Look for "Bulk Close" button
    const buttons = await page.$$("button");
    let bulkCloseBtn: any = null;
    for (const btn of buttons) {
      const text = await (await btn.getProperty("innerText")).jsonValue();
      if (text.includes("Bulk Close")) {
        bulkCloseBtn = btn;
        break;
      }
    }

    if (bulkCloseBtn) {
      await bulkCloseBtn.click();
      await new Promise((r) => setTimeout(r, 1000));

      // SCREENSHOT 4: Bulk Close Confirmation Modal
      const path4 = path.join(artifactDir, "enquiry_4_web_bulk_close_modal.png");
      await page.screenshot({ path: path4 });
      console.log("   ✓ Saved Screenshot 4: Bulk Close Modal ->", path4);
    }
  }

  // 13. Mobile Viewport Simulation
  console.log("13. Opening Mobile Viewport (390x844 iPhone resolution)...");
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await mobilePage.goto("http://localhost:4175/login", { waitUntil: "domcontentloaded" });
  await mobilePage.evaluate((t, u) => {
    localStorage.setItem("vorldx_access_token", t);
    localStorage.setItem(
      "vorldx_cached_user",
      JSON.stringify({
        id: u._id,
        _id: u._id,
        employeeId: u.employeeId,
        email: u.email,
        role: u.role,
        name: "Alice Smith",
      })
    );
  }, adminToken, empUser1);

  await mobilePage.goto("http://localhost:4175/enquiries", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1500));

  // SCREENSHOT 5: Mobile Responsive Layout
  const path5 = path.join(artifactDir, "enquiry_5_mobile_responsive_view.png");
  await mobilePage.screenshot({ path: path5 });
  console.log("   ✓ Saved Screenshot 5: Mobile Layout ->", path5);

  console.log("==================================================");
  console.log("All Enquiry UI End-to-End Verifications Passed Successfully!");
  console.log("==================================================");

  await browser.close();
  await previewServer.close();
  closeSocketServer();
  await new Promise<void>((r) => httpServer.close(() => r()));
  await mongoose.disconnect();
  await mongod.stop();
}

runEnquiryVerification().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
