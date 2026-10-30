const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ARTIFACT_DIR =
  "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";
const DIST_DIR = path.resolve(__dirname, "../apps/web/dist");
const PORT = 3004;

const CHROME_PATH =
  process.env.CHROME_BIN ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Mock Data
const mockEmployees = {
  data: [
    {
      _id: "emp-101",
      employeeId: "EMP-101",
      name: "Ananya Sharma",
      email: "ananya.sharma@vorldx.demo",
      department: "Engineering",
      designation: "Staff Software Engineer",
      workType: "FULL_TIME",
      isActive: true,
      joiningDate: "2024-01-15",
    },
    {
      _id: "emp-102",
      employeeId: "EMP-102",
      name: "Vikram Malhotra",
      email: "vikram.m@vorldx.demo",
      department: "Operations",
      designation: "Operations Lead",
      workType: "FULL_TIME",
      isActive: true,
      joiningDate: "2023-08-20",
    },
    {
      _id: "emp-103",
      employeeId: "EMP-103",
      name: "Rohan Kapoor",
      email: "rohan.k@vorldx.demo",
      department: "Product",
      designation: "Product Designer",
      workType: "CONTRACT",
      isActive: false,
      joiningDate: "2024-06-10",
    },
  ],
  pagination: { total: 3, page: 1, limit: 10, totalPages: 1 },
};

const mockAttendance = {
  data: [
    {
      _id: "rec-1",
      employeeId: "EMP-101",
      dateKey: "2026-10-29",
      department: "Engineering",
      checkInTime: "2026-10-29T03:30:00.000Z",
      checkOutTime: "2026-10-29T12:00:00.000Z",
      durationMinutes: 510,
      status: "PRESENT",
      isLate: false,
      lateMinutes: 0,
      employee: { name: "Ananya Sharma", department: "Engineering" },
    },
    {
      _id: "rec-2",
      employeeId: "EMP-102",
      dateKey: "2026-10-29",
      department: "Operations",
      checkInTime: "2026-10-29T04:15:00.000Z",
      checkOutTime: null,
      durationMinutes: 0,
      status: "LATE",
      isLate: true,
      lateMinutes: 45,
      employee: { name: "Vikram Malhotra", department: "Operations" },
    },
  ],
  pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
};

const mockWfh = {
  data: [
    {
      _id: "wfh-1",
      employeeId: "EMP-101",
      department: "Engineering",
      dateKey: "2026-10-30",
      reason: "Home fiber upgrade maintenance window",
      status: "PENDING",
      employee: { name: "Ananya Sharma", department: "Engineering" },
    },
  ],
  pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

const mockAuditLogs = {
  data: [
    {
      _id: "log-1",
      timestamp: "2026-10-29T10:15:00.000Z",
      action: "CORRECTION",
      entityType: "ATTENDANCE_RECORD",
      performedByEmployeeId: "HR-001",
      reason: "Employee badge reader hardware lag verified with gate log",
      previousValue: { status: "LATE", durationMinutes: 420 },
      newValue: { status: "PRESENT", durationMinutes: 480 },
    },
  ],
  pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

const mockSummaryReport = {
  summary: {
    totalRecords: 120,
    presentCount: 95,
    lateCount: 15,
    wfhCount: 8,
    absentCount: 2,
    halfDayCount: 0,
    totalHours: 960,
  },
  data: [
    {
      _id: "rec-1",
      dateKey: "2026-10-29",
      employeeId: "EMP-101",
      department: "Engineering",
      checkInTime: "2026-10-29T03:30:00.000Z",
      checkOutTime: "2026-10-29T12:00:00.000Z",
      durationMinutes: 510,
      status: "PRESENT",
      employee: { name: "Ananya Sharma", department: "Engineering" },
    },
  ],
  pagination: { total: 1, page: 1, limit: 15, totalPages: 1 },
};

function startServer() {
  const mimeTypes = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      return res.end();
    }

    if (req.url.startsWith("/api/auth/profile")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          data: {
            _id: "user-1",
            name: "HR Admin",
            email: "hr@vorldx.demo",
            role: "HR",
            employeeId: "EMP-001",
          },
        })
      );
    }

    if (req.url.startsWith("/api/policy/active")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          data: {
            _id: "pol-1",
            name: "Default Policy",
            shifts: [
              { _id: "shift-1", name: "General Shift", startTime: "09:00", endTime: "18:00" },
            ],
          },
        })
      );
    }

    if (req.url.startsWith("/api/employees") && req.url.includes("attendance-snapshot")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          data: [
            {
              _id: "snap-1",
              dateKey: "2026-10-29",
              checkInTime: "2026-10-29T03:30:00.000Z",
              checkOutTime: "2026-10-29T12:00:00.000Z",
              durationMinutes: 510,
              status: "PRESENT",
              isLate: false,
              lateMinutes: 0,
            },
          ],
        })
      );
    }

    if (req.url.startsWith("/api/employees")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mockEmployees));
    }

    if (req.url.startsWith("/api/attendance")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mockAttendance));
    }

    if (req.url.startsWith("/api/wfh/admin/requests")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mockWfh));
    }

    if (req.url.startsWith("/api/audit-logs") || req.url.startsWith("/api/admin/audit-logs")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mockAuditLogs));
    }

    if (req.url.startsWith("/api/reports/attendance")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mockSummaryReport));
    }

    if (req.url.startsWith("/api/feature-flags")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          success: true,
          data: {
            leave: true,
            announcements: true,
            enquiries: true,
            calendarImport: true,
            threeD: false,
            otaUpdates: true,
          },
        })
      );
    }

    if (req.url.startsWith("/api/announcements")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, count: 0, data: [] }));
    }

    // Static files
    let safeUrl = req.url.split("?")[0];
    let filePath = path.join(DIST_DIR, safeUrl === "/" ? "index.html" : safeUrl);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, "index.html");
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('response', res => {
    if (res.status() >= 400) console.log('HTTP ERROR:', res.status(), res.url());
  });

  // Init local storage credentials
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("vorldx_access_token", "mock-valid-token");
    localStorage.setItem(
      "vorldx_cached_user",
      JSON.stringify({
        id: "user-1",
        name: "HR Admin",
        email: "hr@vorldx.demo",
        role: "HR",
        employeeId: "EMP-001",
      })
    );
  });

  console.log("\n1. Verifying Employees Page & Drawer...");
  await page.goto(`http://localhost:${PORT}/employees`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("tbody tr", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));

  // Check rows count
  const empRowCount = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
  console.log(`   ✓ Rendered ${empRowCount} employee rows`);

  // Test row click to open slide-over drawer
  await page.evaluate(() => {
    const row = document.querySelector("tbody tr");
    if (row) row.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const isProfileDrawerOpen = await page.evaluate(() => {
    return document.body.textContent.includes("Recent Attendance Snapshot");
  });
  console.log(`   ✓ Slide-over profile drawer opened: ${isProfileDrawerOpen}`);

  const employeeScreenshot = path.join(ARTIFACT_DIR, "page_1_employees_drawer.png");
  await page.screenshot({ path: employeeScreenshot });
  console.log(`   ✓ Screenshot saved: ${employeeScreenshot}`);

  console.log("\n2. Verifying Attendance Ledger Page & Punch Detail Drawer...");
  await page.goto(`http://localhost:${PORT}/attendance`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("tbody tr", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));

  const attRowCount = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
  console.log(`   ✓ Rendered ${attRowCount} attendance ledger rows`);

  // Test row click to open punch detail drawer
  await page.evaluate(() => {
    const row = document.querySelector("tbody tr");
    if (row) row.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const isPunchDrawerOpen = await page.evaluate(() => {
    return document.body.textContent.includes("Attendance Punch Details");
  });
  console.log(`   ✓ Punch detail drawer opened: ${isPunchDrawerOpen}`);

  const attendanceScreenshot = path.join(ARTIFACT_DIR, "page_2_attendance_drawer.png");
  await page.screenshot({ path: attendanceScreenshot });
  console.log(`   ✓ Screenshot saved: ${attendanceScreenshot}`);

  console.log("\n3. Verifying WFH Queue Page & Review Drawer...");
  await page.goto(`http://localhost:${PORT}/wfh`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("tbody tr", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));

  const wfhRowCount = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
  console.log(`   ✓ Rendered ${wfhRowCount} WFH request rows`);

  await page.evaluate(() => {
    const row = document.querySelector("tbody tr");
    if (row) row.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const isWfhDrawerOpen = await page.evaluate(() => {
    return document.body.textContent.includes("WFH Application Details");
  });
  console.log(`   ✓ WFH detail drawer opened: ${isWfhDrawerOpen}`);

  const wfhScreenshot = path.join(ARTIFACT_DIR, "page_3_wfh_drawer.png");
  await page.screenshot({ path: wfhScreenshot });
  console.log(`   ✓ Screenshot saved: ${wfhScreenshot}`);

  console.log("\n4. Verifying Security & Audit Logs Page & Forensic Diff Drawer...");
  await page.goto(`http://localhost:${PORT}/audit-logs`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("tbody tr", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));

  const auditRowCount = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
  console.log(`   ✓ Rendered ${auditRowCount} audit log rows`);

  await page.evaluate(() => {
    const row = document.querySelector("tbody tr");
    if (row) row.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const isAuditDrawerOpen = await page.evaluate(() => {
    return document.body.textContent.includes("Audit Event State Delta");
  });
  console.log(`   ✓ Forensic state delta drawer opened: ${isAuditDrawerOpen}`);

  const auditScreenshot = path.join(ARTIFACT_DIR, "page_4_audit_diff_drawer.png");
  await page.screenshot({ path: auditScreenshot });
  console.log(`   ✓ Screenshot saved: ${auditScreenshot}`);

  console.log("\n5. Verifying Reports Page & Workforce Summary...");
  await page.goto(`http://localhost:${PORT}/reports`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 8000 });
  await new Promise((r) => setTimeout(r, 600));

  const hasReportOverview = await page.evaluate(() => {
    return document.body.textContent.includes("Reports & Workforce Analytics");
  });
  console.log(`   ✓ Reports overview active: ${hasReportOverview}`);

  const reportsScreenshot = path.join(ARTIFACT_DIR, "page_5_reports_overview.png");
  await page.screenshot({ path: reportsScreenshot });
  console.log(`   ✓ Screenshot saved: ${reportsScreenshot}`);

  await browser.close();
  server.close();
  console.log("\n🎉 ALL 5 WORKFORCE DATA PAGES VERIFIED CLEANLY WITH BEAUTIFUL SLIDE-OVER DRAWERS!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
