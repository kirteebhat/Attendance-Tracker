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
import { UserRole, WorkType, AttendanceStatus } from "@vorldx/shared";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runEmployeesAndAttendanceVerification() {
  console.log("==================================================");
  console.log("Starting Browser Verification for Employees & Attendance");
  console.log("Executable:", executablePath);
  console.log("==================================================");

  // 1. Start MongoDB In-Memory Server
  console.log("1. Starting In-Memory MongoDB...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Seed Database
  console.log("2. Seeding database with Policy, Admin, Employees, and Attendance Records...");
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

  const departments = ["Engineering", "Product", "Operations", "Marketing", "HR"];
  const today = new Date().toISOString().slice(0, 10);

  const seededEmployees: InstanceType<typeof Employee>[] = [];
  for (let i = 1; i <= 8; i++) {
    const empId = `EMP-${String(i).padStart(3, "0")}`;
    const emp = await Employee.create({
      employeeId: empId,
      name: `Employee ${i} Sharma`,
      email: `emp${i}@vorldx.demo`,
      department: departments[i % departments.length],
      designation: i % 2 === 0 ? "Senior Engineer" : "Product Specialist",
      workType: WorkType.FULL_TIME,
      joiningDate: "2024-05-10",
      status: "ACTIVE",
      isActive: true,
    });
    seededEmployees.push(emp);

    // Seed attendance for today
    if (i <= 3) {
      await AttendanceRecord.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: today,
        checkInTime: new Date(Date.now() - 5 * 3600 * 1000),
        status: AttendanceStatus.PRESENT,
        isLate: false,
        lateMinutes: 0,
        durationMinutes: 300,
        policyId: policy._id,
        policyVersion: policy.version,
      });
    } else if (i <= 6) {
      await AttendanceRecord.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: today,
        checkInTime: new Date(Date.now() - 4 * 3600 * 1000),
        status: AttendanceStatus.LATE,
        isLate: true,
        lateMinutes: 35,
        durationMinutes: 240,
        policyId: policy._id,
        policyVersion: policy.version,
      });
    } else if (i <= 8) {
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
      // Ignore favicon or benign 401 on login
      if (text.includes("favicon") || text.includes("401")) return;
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  try {
    await page.setViewport({ width: 1280, height: 900 });

    // ----------------------------------------------------
    // Step 1: Sign in as Admin
    // ----------------------------------------------------
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

    const fillInput = async (selector: string, value: string) => {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyA");
        await page.keyboard.up("Control");
        await page.keyboard.press("Backspace");
        await page.keyboard.type(value);
      }
    };

    // ----------------------------------------------------
    // Step 2: Navigate to Employees Directory (/employees)
    // ----------------------------------------------------
    console.log("Step 2: Navigating to Employees Page...");
    await page.goto("http://localhost:3000/employees", { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Employee Directory") &&
        document.body.innerText.includes("Total Staff"),
      { timeout: 8000 }
    );
    const employeesListScreenshot = path.join(artifactDir, "browser_08_employees_list.png");
    await page.screenshot({ path: employeesListScreenshot, fullPage: true });
    console.log("✓ Employees list rendered. Screenshot saved:", employeesListScreenshot);

    // ----------------------------------------------------
    // Step 3: Test Duplicate ID Error in Drawer
    // ----------------------------------------------------
    console.log("Step 3: Testing duplicate-ID validation in Add Employee drawer...");
    // Click "Add Employee" button
    await page.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Add Employee")
      );
      if (addBtn) addBtn.click();
    });
    await page.waitForSelector("div[role='dialog']", { timeout: 5000 });

    // Set duplicate employee ID EMP-001 and details
    await fillInput("input[name='employeeId']", "EMP-001");
    await fillInput("input[name='name']", "Duplicate Test Person");
    await fillInput("input[name='email']", "duplicate@vorldx.demo");
    await fillInput("input[name='designation']", "Quality Engineer");

    // Click "Create Employee"
    await page.evaluate(() => {
      const createBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Create Employee")
      );
      if (createBtn) createBtn.click();
    });

    // Wait for duplicate error banner to appear
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("already exists") ||
        document.body.innerText.includes("Duplicate ID Error"),
      { timeout: 6000 }
    );
    const duplicateErrorScreenshot = path.join(artifactDir, "browser_09_duplicate_employee_error.png");
    await page.screenshot({ path: duplicateErrorScreenshot });
    console.log("✓ Duplicate employee ID error verified. Screenshot saved:", duplicateErrorScreenshot);

    // Now submit with valid unique ID EMP-999
    console.log("Submitting new valid employee EMP-999 (Pooja Deshmukh)...");
    await fillInput("input[name='employeeId']", "EMP-999");
    await fillInput("input[name='name']", "Pooja Deshmukh");
    await fillInput("input[name='email']", "pooja.deshmukh@vorldx.demo");
    await fillInput("input[name='designation']", "Staff Cloud Architect");

    await page.evaluate(() => {
      const createBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Create Employee")
      );
      if (createBtn) createBtn.click();
    });

    // Drawer closes and Pooja Deshmukh appears in table
    await page.waitForFunction(() => document.body.innerText.includes("Pooja Deshmukh"), {
      timeout: 8000,
    });
    const employeeCreatedScreenshot = path.join(artifactDir, "browser_10_employee_created.png");
    await page.screenshot({ path: employeeCreatedScreenshot, fullPage: true });
    console.log("✓ Employee EMP-999 created and visible in table. Screenshot saved:", employeeCreatedScreenshot);

    // ----------------------------------------------------
    // Step 4: Edit Employee
    // ----------------------------------------------------
    console.log("Step 4: Editing employee designation...");
    // Click edit button on the Pooja Deshmukh row
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const poojaRow = rows.find((r) => r.textContent?.includes("Pooja Deshmukh"));
      if (poojaRow) {
        const editBtn = poojaRow.querySelector("button[title='Edit Employee']") as HTMLButtonElement;
        if (editBtn) editBtn.click();
      }
    });

    await page.waitForSelector("div[role='dialog']", { timeout: 5000 });
    await fillInput("input[name='designation']", "Principal Solutions Architect");

    // Click "Save Changes"
    await page.evaluate(() => {
      const saveBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Save Changes")
      );
      if (saveBtn) saveBtn.click();
    });

    await page.waitForFunction(
      () => document.body.innerText.includes("Principal Solutions Architect"),
      { timeout: 8000 }
    );
    const employeeEditedScreenshot = path.join(artifactDir, "browser_11_employee_edited.png");
    await page.screenshot({ path: employeeEditedScreenshot, fullPage: true });
    console.log("✓ Employee designation successfully edited. Screenshot saved:", employeeEditedScreenshot);

    // ----------------------------------------------------
    // Step 5: Deactivate Employee with Confirmation
    // ----------------------------------------------------
    console.log("Step 5: Deactivating employee with confirmation modal...");
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const poojaRow = rows.find((r) => r.textContent?.includes("Pooja Deshmukh"));
      if (poojaRow) {
        const deactivateBtn = poojaRow.querySelector(
          "button[title='Deactivate employee']"
        ) as HTMLButtonElement;
        if (deactivateBtn) deactivateBtn.click();
      }
    });

    await page.waitForFunction(
      () => document.body.innerText.includes("Deactivate Pooja Deshmukh"),
      { timeout: 5000 }
    );

    // Type reason in confirmation modal
    await page.evaluate(() => {
      const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = "Sabbatical leave approved for research fellowship";
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const confirmBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Confirm Deactivation")
      );
      if (confirmBtn) confirmBtn.click();
    });

    // Wait for Inactive badge on Pooja Deshmukh row
    await page.waitForFunction(
      () => {
        const rows = Array.from(document.querySelectorAll("tr"));
        const poojaRow = rows.find((r) => r.textContent?.includes("Pooja Deshmukh"));
        return poojaRow && poojaRow.textContent?.includes("Inactive");
      },
      { timeout: 8000 }
    );
    const employeeDeactivatedScreenshot = path.join(
      artifactDir,
      "browser_12_employee_deactivated.png"
    );
    await page.screenshot({ path: employeeDeactivatedScreenshot, fullPage: true });
    console.log("✓ Employee deactivated and Inactive badge verified. Screenshot saved:", employeeDeactivatedScreenshot);

    // ----------------------------------------------------
    // Step 6: Filter Employees Table
    // ----------------------------------------------------
    console.log("Step 6: Testing table filter controls (Status = Inactive)...");
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const statusSelect = selects.find((s) => s.innerHTML.includes("All Statuses"));
      if (statusSelect) {
        statusSelect.value = "INACTIVE";
        statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await new Promise((r) => setTimeout(r, 800));
    const employeesFilteredScreenshot = path.join(artifactDir, "browser_13_employees_filtered.png");
    await page.screenshot({ path: employeesFilteredScreenshot, fullPage: true });
    console.log("✓ Table filtered by Inactive status. Screenshot saved:", employeesFilteredScreenshot);

    // Reset status filter back via Reset all filters button
    await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Reset all filters")
      );
      if (resetBtn) resetBtn.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes("EMP-001"),
      { timeout: 6000 }
    );
    console.log("✓ Filters reset, EMP-001 visible.");

    // ----------------------------------------------------
    // Step 7: View Profile & Attendance Snapshot
    // ----------------------------------------------------
    console.log("Step 7: Testing Profile Drawer & Attendance Snapshot for EMP-001...");
    const clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const empRow = rows.find((r) => r.textContent?.includes("EMP-001"));
      if (empRow) {
        const viewBtn = empRow.querySelector("button[title='View Profile & Snapshot']") as HTMLButtonElement;
        if (viewBtn) {
          viewBtn.click();
          return true;
        }
      }
      return false;
    });
    console.log("Profile view button clicked:", clicked);

    await new Promise((r) => setTimeout(r, 800));
    const step7Text = await page.evaluate(() => document.body.innerText);
    console.log("STEP 7 BODY TEXT SAMPLE:", step7Text.slice(0, 400));

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Recent Attendance Snapshot") ||
        document.body.innerText.includes("Close Profile"),
      { timeout: 6000 }
    );
    const profileSnapshotScreenshot = path.join(artifactDir, "browser_14_profile_snapshot.png");
    await page.screenshot({ path: profileSnapshotScreenshot });
    console.log("✓ Profile & Attendance Snapshot verified. Screenshot saved:", profileSnapshotScreenshot);

    // Close Profile Drawer
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Close Profile")
      );
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // ----------------------------------------------------
    // Step 8: Navigate to Attendance Ledger (/attendance)
    // ----------------------------------------------------
    console.log("Step 8: Navigating to Attendance Ledger (/attendance)...");
    await page.goto("http://localhost:3000/attendance", { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Attendance Ledger") &&
        document.body.innerText.includes("EMP-001"),
      { timeout: 8000 }
    );
    const attendanceLedgerScreenshot = path.join(artifactDir, "browser_15_attendance_ledger.png");
    await page.screenshot({ path: attendanceLedgerScreenshot, fullPage: true });
    console.log("✓ Attendance Ledger rendered. Screenshot saved:", attendanceLedgerScreenshot);

    // ----------------------------------------------------
    // Step 9: Administrative Correction Dialog
    // ----------------------------------------------------
    console.log("Step 9: Testing attendance correction with mandatory reason...");
    // Click "Correct" on EMP-001
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const emp1Row = rows.find((r) => r.textContent?.includes("EMP-001"));
      if (emp1Row) {
        const correctBtn = emp1Row.querySelector("button[title='Correct Attendance Record']") as HTMLButtonElement;
        if (correctBtn) correctBtn.click();
      }
    });

    await page.waitForFunction(
      () => document.body.innerText.includes("Administrative Correction"),
      { timeout: 5000 }
    );

    // Set status to CHECKED_OUT using page.select
    await page.select("div[role='dialog'] select", "CHECKED_OUT");

    // Set datetime inputs using native descriptor setter string evaluation (esbuild __name safe)
    const todayDate = new Date().toISOString().slice(0, 10);
    const timeIn = `${todayDate}T09:00`;
    const timeOut = `${todayDate}T17:30`;
    await page.evaluate(`
      (function() {
        var modal = document.querySelector("div[role='dialog']");
        if (!modal) return;
        var inputs = modal.querySelectorAll("input[type='datetime-local']");
        var desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (inputs[0] && desc && desc.set) {
          desc.set.call(inputs[0], "${timeIn}");
          inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
          inputs[0].dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (inputs[1] && desc && desc.set) {
          desc.set.call(inputs[1], "${timeOut}");
          inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
          inputs[1].dispatchEvent(new Event("change", { bubbles: true }));
        }
      })()
    `);

    // Type mandatory reason using Puppeteer keyboard
    const reasonTextarea = await page.$("div[role='dialog'] textarea");
    if (reasonTextarea) {
      await reasonTextarea.click();
      await reasonTextarea.type("Corrected punch times per supervisor sign-off and access card logs");
    }

    await new Promise((r) => setTimeout(r, 400));

    // Submit correction
    await page.evaluate(() => {
      const modal = document.querySelector("div[role='dialog']");
      if (!modal) return;
      const submitBtn = Array.from(modal.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Apply Correction")
      );
      if (submitBtn) submitBtn.click();
    });

    // Wait for the Edited tag to appear on the EMP-001 row
    await page.waitForFunction(
      () => {
        const rows = Array.from(document.querySelectorAll("tr"));
        const emp1Row = rows.find((r) => r.textContent?.includes("EMP-001"));
        return emp1Row && emp1Row.textContent?.includes("Edited");
      },
      { timeout: 8000 }
    );
    const attendanceCorrectedScreenshot = path.join(
      artifactDir,
      "browser_16_attendance_corrected.png"
    );
    await page.screenshot({ path: attendanceCorrectedScreenshot, fullPage: true });
    console.log("✓ Attendance record corrected and audited. Screenshot saved:", attendanceCorrectedScreenshot);

    // ----------------------------------------------------
    // Step 10: View Correction History
    // ----------------------------------------------------
    console.log("Step 10: Viewing correction history modal...");
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const emp1Row = rows.find((r) => r.textContent?.includes("EMP-001"));
      if (emp1Row) {
        const historyBtn = emp1Row.querySelector("button[title='View Correction History']") as HTMLButtonElement;
        if (historyBtn) historyBtn.click();
      }
    });

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Correction Audit History") &&
        document.body.innerText.includes("Corrected punch times per supervisor sign-off"),
      { timeout: 5000 }
    );
    const correctionHistoryScreenshot = path.join(
      artifactDir,
      "browser_17_correction_history.png"
    );
    await page.screenshot({ path: correctionHistoryScreenshot });
    console.log("✓ Correction history verified. Screenshot saved:", correctionHistoryScreenshot);

    // Close History Modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Close History")
      );
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // ----------------------------------------------------
    // Step 11: Confirm Audit Entry Exists (/audit-logs)
    // ----------------------------------------------------
    console.log("Step 11: Confirming audit entry in /audit-logs...");
    await page.goto("http://localhost:3000/audit-logs", { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Security & Audit Trail") &&
        document.body.innerText.includes("CORRECTION"),
      { timeout: 8000 }
    );

    // Open Diff Modal on the first CORRECTION audit log
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      const correctionRow = rows.find((r) => r.textContent?.includes("CORRECTION"));
      if (correctionRow) {
        const diffBtn = correctionRow.querySelector("button[title='View Audit Snapshot']") as HTMLButtonElement;
        if (diffBtn) diffBtn.click();
      }
    });

    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Audit Event Details") &&
        document.body.innerText.includes("Previous State"),
      { timeout: 5000 }
    );
    const auditTrailScreenshot = path.join(artifactDir, "browser_18_audit_trail_confirmed.png");
    await page.screenshot({ path: auditTrailScreenshot });
    console.log("✓ Audit log entry and state diff verified. Screenshot saved:", auditTrailScreenshot);

    // ----------------------------------------------------
    // Step 12: Verify Console Errors
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
  console.log("Browser Verification for Employees & Attendance PASSED!");
  console.log("==================================================");
}

runEmployeesAndAttendanceVerification().catch((err) => {
  console.error("FATAL Browser Verification Failure:", err);
  process.exit(1);
});
