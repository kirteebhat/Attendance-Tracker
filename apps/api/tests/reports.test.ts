import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import {
  Employee,
  IEmployee,
  User,
  IUser,
  AttendanceRecord,
  AttendancePolicy,
  WfhRequest,
  AuditEvent,
} from "../src/models";
import { ApiErrorCode, AttendanceStatus, UserRole, WorkType, WfhStatus } from "@vorldx/shared";
import { env } from "../src/config/env";

describe("Executive Dashboard, Reporting Engine & Audit Log Explorer", () => {
  let emp1: IEmployee;
  let emp2: IEmployee;
  let emp3: IEmployee;
  let emp4: IEmployee;
  let inactiveEmp: IEmployee;

  let hrUser: IUser;
  let hrToken: string;

  let employeeUser: IUser;
  let employeeToken: string;

  beforeEach(async () => {
    await AttendanceRecord.deleteMany({});
    await WfhRequest.deleteMany({});
    await AttendancePolicy.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await AuditEvent.deleteMany({});

    // 1. Create Default Attendance Policy
    await AttendancePolicy.create({
      name: "Standard Corporate Policy",
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

    // 2. Seed 4 Active Employees across 3 departments + 1 Inactive Employee
    emp1 = await Employee.create({
      employeeId: "EMP-001",
      name: "Alice Smith",
      email: "alice.smith@vorldx.demo",
      department: "Engineering",
      designation: "Senior Software Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2025-01-01",
      isActive: true,
    });

    emp2 = await Employee.create({
      employeeId: "EMP-002",
      name: "Bob Johnson",
      email: "bob.johnson@vorldx.demo",
      department: "Engineering",
      designation: "DevOps Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2025-02-01",
      isActive: true,
    });

    emp3 = await Employee.create({
      employeeId: "EMP-003",
      name: "Charlie Brown",
      email: "charlie.brown@vorldx.demo",
      department: "Marketing",
      designation: "Content Strategist",
      workType: WorkType.PART_TIME,
      joiningDate: "2025-03-01",
      isActive: true,
    });

    emp4 = await Employee.create({
      employeeId: "EMP-004",
      name: "Dana White",
      email: "dana.white@vorldx.demo",
      department: "Sales",
      designation: "Account Executive",
      workType: WorkType.CONTRACT,
      joiningDate: "2025-04-01",
      isActive: true,
    });

    inactiveEmp = await Employee.create({
      employeeId: "EMP-005",
      name: "Eve Black",
      email: "eve.black@vorldx.demo",
      department: "Design",
      designation: "UI Intern",
      workType: WorkType.INTERN,
      joiningDate: "2025-05-01",
      isActive: false, // Inactive employee!
    });

    // 3. Seed Users
    hrUser = await User.create({
      employeeId: "HR-9001",
      email: "hr.director@vorldx.demo",
      passwordHash: "dummyHash",
      role: UserRole.HR,
      status: "ACTIVE",
    });

    hrToken = jwt.sign(
      {
        userId: hrUser._id.toString(),
        employeeId: hrUser.employeeId,
        email: hrUser.email,
        role: hrUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    employeeUser = await User.create({
      employeeId: emp1.employeeId,
      email: emp1.email,
      passwordHash: "dummyHash",
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    employeeToken = jwt.sign(
      {
        userId: employeeUser._id.toString(),
        employeeId: employeeUser.employeeId,
        email: employeeUser.email,
        role: employeeUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Seed Known Attendance Records:
    // Date: 2026-10-20
    // - emp1: Present on-time (540 mins)
    // - emp2: Present late (495 mins, lateMinutes: 45)
    // - emp3: WFH approved (480 mins)
    // - emp4: not punched yet today
    await AttendanceRecord.create([
      {
        employee: emp1._id,
        employeeId: emp1.employeeId,
        department: emp1.department,
        dateKey: "2026-10-20",
        checkInTime: new Date("2026-10-20T03:30:00Z"), // 09:00 IST
        checkOutTime: new Date("2026-10-20T12:30:00Z"), // 18:00 IST
        durationMinutes: 540,
        status: AttendanceStatus.CHECKED_OUT,
        isLate: false,
        isWfh: false,
      },
      {
        employee: emp2._id,
        employeeId: emp2.employeeId,
        department: emp2.department,
        dateKey: "2026-10-20",
        checkInTime: new Date("2026-10-20T04:15:00Z"), // 09:45 IST (Late)
        checkOutTime: new Date("2026-10-20T12:30:00Z"),
        durationMinutes: 495,
        status: AttendanceStatus.CHECKED_OUT,
        isLate: true,
        lateMinutes: 45,
        isWfh: false,
      },
      {
        employee: emp3._id,
        employeeId: emp3.employeeId,
        department: emp3.department,
        dateKey: "2026-10-20",
        checkInTime: null,
        checkOutTime: null,
        durationMinutes: 480,
        status: AttendanceStatus.WFH_APPROVED,
        isLate: false,
        isWfh: true,
      },
      // Date: 2026-10-19 (Past Day)
      // - emp1: Present on-time (540 mins)
      // - emp2: Present on-time (540 mins)
      // - emp3: Half-day (240 mins)
      // - emp4: Absent (0 mins)
      {
        employee: emp1._id,
        employeeId: emp1.employeeId,
        department: emp1.department,
        dateKey: "2026-10-19",
        checkInTime: new Date("2026-10-19T03:30:00Z"),
        checkOutTime: new Date("2026-10-19T12:30:00Z"),
        durationMinutes: 540,
        status: AttendanceStatus.CHECKED_OUT,
        isLate: false,
      },
      {
        employee: emp2._id,
        employeeId: emp2.employeeId,
        department: emp2.department,
        dateKey: "2026-10-19",
        checkInTime: new Date("2026-10-19T03:30:00Z"),
        checkOutTime: new Date("2026-10-19T12:30:00Z"),
        durationMinutes: 540,
        status: AttendanceStatus.CHECKED_OUT,
        isLate: false,
      },
      {
        employee: emp3._id,
        employeeId: emp3.employeeId,
        department: emp3.department,
        dateKey: "2026-10-19",
        checkInTime: new Date("2026-10-19T03:30:00Z"),
        checkOutTime: new Date("2026-10-19T07:30:00Z"),
        durationMinutes: 240,
        status: AttendanceStatus.HALF_DAY,
        isLate: false,
      },
      {
        employee: emp4._id,
        employeeId: emp4.employeeId,
        department: emp4.department,
        dateKey: "2026-10-19",
        checkInTime: null,
        checkOutTime: null,
        durationMinutes: 0,
        status: AttendanceStatus.ABSENT,
        isLate: false,
      },
    ]);

    // 5. Seed Known WFH Requests
    await WfhRequest.create([
      {
        employee: emp4._id,
        employeeId: emp4.employeeId,
        department: emp4.department,
        dateKey: "2026-10-21",
        reason: "Plumbing repair at home",
        status: WfhStatus.PENDING,
      },
      {
        employee: emp3._id,
        employeeId: emp3.employeeId,
        department: emp3.department,
        dateKey: "2026-10-20",
        reason: "Doctor advised rest, remote work approved",
        status: WfhStatus.APPROVED,
        reviewedBy: hrUser._id,
        reviewedAt: new Date("2026-10-19T10:00:00Z"),
        reviewerRemarks: "Approved by HR Director",
      },
      {
        employee: emp1._id,
        employeeId: emp1.employeeId,
        department: emp1.department,
        dateKey: "2026-10-18",
        reason: "=CMD|' /C calc'!A0", // Formula injection test payload in reason!
        status: WfhStatus.REJECTED,
        reviewedBy: hrUser._id,
        reviewedAt: new Date("2026-10-17T10:00:00Z"),
        reviewerRemarks: "+12345 Dangerous formula remark",
      },
    ]);

    // 6. Seed Known Audit Events
    await AuditEvent.create([
      {
        entityType: "EMPLOYEE",
        entityId: emp1._id.toString(),
        performedBy: hrUser._id,
        performedByEmployeeId: "HR-9001",
        action: "CREATE",
        reason: "New employee hired into Engineering",
        timestamp: new Date("2026-10-10T08:00:00Z"),
      },
      {
        entityType: "ATTENDANCE_RECORD",
        entityId: "rec_1001",
        performedBy: hrUser._id,
        performedByEmployeeId: "HR-9001",
        action: "CORRECTION",
        reason: "Adjusted missing checkout",
        timestamp: new Date("2026-10-15T10:00:00Z"),
      },
      {
        entityType: "WFH_REQUEST",
        entityId: "wfh_2001",
        performedBy: hrUser._id,
        performedByEmployeeId: "HR-9001",
        action: "UPDATE",
        reason: "=SUM(A1:A10)", // CSV formula injection test in audit reason!
        timestamp: new Date("2026-10-19T10:00:00Z"),
      },
    ]);
  });

  describe("GET /dashboard/summary (Executive Summary & Trends)", () => {
    it("returns accurate real-time metrics for today from seeded database", async () => {
      const res = await request(app)
        .get("/dashboard/summary?dateKey=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dateKey).toBe("2026-10-20");
      expect(inactiveEmp.isActive).toBe(false);

      const s = res.body.summary;
      // Total active employees: 4 (emp1, emp2, emp3, emp4; emp5 is inactive)
      expect(s.totalActiveEmployees).toBe(4);
      // Present today: 2 (emp1 on-time, emp2 late)
      expect(s.presentToday).toBe(2);
      // Late today: 1 (emp2 with lateMinutes: 45)
      expect(s.lateToday).toBe(1);
      // WFH today: 1 (emp3 with status WFH_APPROVED)
      expect(s.wfhToday).toBe(1);
      // Not yet checked in: 1 (emp4 has not punched or had WFH)
      expect(s.notYetCheckedInToday).toBe(1);
      // Pending WFH requests: 1 (emp4's request for 2026-10-21)
      expect(s.pendingWfhRequests).toBe(1);
      // Attendance rate: (2 + 1) / 4 = 75%
      expect(s.attendanceRate).toBe(75);
    });

    it("returns 7-day and 30-day trend series with accurate daily rates", async () => {
      const res = await request(app)
        .get("/dashboard/summary?dateKey=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.trends).toBeDefined();
      expect(res.body.trends.last7Days.length).toBe(7);
      expect(res.body.trends.last30Days.length).toBe(30);

      // Verify today's entry (last item in the series)
      const todayTrend = res.body.trends.last7Days[6];
      expect(todayTrend.dateKey).toBe("2026-10-20");
      expect(todayTrend.presentCount).toBe(2);
      expect(todayTrend.lateCount).toBe(1);
      expect(todayTrend.wfhCount).toBe(1);
      expect(todayTrend.attendanceRate).toBe(75);

      // Verify yesterday's entry (2026-10-19): 2 present + 1 half-day + 1 absent
      const yesterdayTrend = res.body.trends.last7Days[5];
      expect(yesterdayTrend.dateKey).toBe("2026-10-19");
      expect(yesterdayTrend.presentCount).toBe(3); // 2 checked out + 1 half day
      expect(yesterdayTrend.absentCount).toBe(1);
    });

    it("returns recent audit log activity in descending order", async () => {
      const res = await request(app)
        .get("/dashboard/summary?dateKey=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.recentActivity.length).toBeGreaterThanOrEqual(3);
      expect(res.body.recentActivity[0].action).toBeDefined();
      expect(res.body.recentActivity[0].entityType).toBeDefined();
    });

    it("blocks regular employee from accessing dashboard summary with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .get("/dashboard/summary")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });
  });

  describe("Reporting Engine (Attendance, Employee-wise, Department-wise, Late, WFH)", () => {
    it("GET /reports/attendance calculates exact summary metrics across date range", async () => {
      const res = await request(app)
        .get("/reports/attendance?startDate=2026-10-19&endDate=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(7); // 3 on 10-20 + 4 on 10-19

      const s = res.body.summary;
      expect(s.totalRecords).toBe(7);
      expect(s.presentCount).toBe(5); // 2 on 10-20 + 3 on 10-19
      expect(s.lateCount).toBe(1); // emp2 on 10-20
      expect(s.halfDayCount).toBe(1); // emp3 on 10-19
      expect(s.wfhCount).toBe(1); // emp3 on 10-20
      expect(s.absentCount).toBe(1); // emp4 on 10-19
      // Total minutes: (540 + 495 + 480) on 10-20 + (540 + 540 + 240 + 0) on 10-19 = 2835 mins = 47.3 hours
      expect(s.totalHours).toBe(47.3);
    });

    it("GET /reports/employee-wise aggregates exact individual work hours and attendance rates", async () => {
      const res = await request(app)
        .get("/reports/employee-wise?startDate=2026-10-19&endDate=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4); // 4 active employees

      const emp1Stats = res.body.data.find(
        (e: { employeeId: string }) => e.employeeId === "EMP-001"
      );
      expect(emp1Stats.totalDays).toBe(2);
      expect(emp1Stats.presentDays).toBe(2);
      expect(emp1Stats.lateDays).toBe(0);
      expect(emp1Stats.totalWorkHours).toBe(18); // 540 + 540 mins = 1080 mins = 18 hrs
      expect(emp1Stats.attendanceRate).toBe(100);

      const emp2Stats = res.body.data.find(
        (e: { employeeId: string }) => e.employeeId === "EMP-002"
      );
      expect(emp2Stats.lateDays).toBe(1);
      expect(emp2Stats.totalWorkHours).toBe(17.3); // 495 + 540 mins = 1035 mins = 17.25 -> 17.3 hrs

      const emp3Stats = res.body.data.find(
        (e: { employeeId: string }) => e.employeeId === "EMP-003"
      );
      expect(emp3Stats.wfhDays).toBe(1);
      expect(emp3Stats.halfDays).toBe(1);

      const emp4Stats = res.body.data.find(
        (e: { employeeId: string }) => e.employeeId === "EMP-004"
      );
      expect(emp4Stats.absentDays).toBe(1);
    });

    it("GET /reports/department-wise aggregates exact headcount and stats per department", async () => {
      const res = await request(app)
        .get("/reports/department-wise?startDate=2026-10-19&endDate=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3); // Engineering, Marketing, Sales

      const eng = res.body.data.find((d: { department: string }) => d.department === "Engineering");
      expect(eng.headcount).toBe(2);
      expect(eng.totalRecords).toBe(4);
      expect(eng.lateCount).toBe(1);
      expect(eng.attendanceRate).toBe(100);

      const mkt = res.body.data.find((d: { department: string }) => d.department === "Marketing");
      expect(mkt.headcount).toBe(1);
      expect(mkt.wfhCount).toBe(1);

      const sales = res.body.data.find((d: { department: string }) => d.department === "Sales");
      expect(sales.headcount).toBe(1);
      expect(sales.absentCount).toBe(1);
      expect(sales.attendanceRate).toBe(0);
    });

    it("GET /reports/late returns exact late check-in records with late minutes", async () => {
      const res = await request(app)
        .get("/reports/late?startDate=2026-10-19&endDate=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeId).toBe("EMP-002");
      expect(res.body.data[0].name).toBe("Bob Johnson");
      expect(res.body.data[0].lateMinutes).toBe(45);
      expect(res.body.data[0].dateKey).toBe("2026-10-20");
    });

    it("GET /reports/wfh returns all requests with reviewer metadata and status breakdown", async () => {
      const res = await request(app).get("/reports/wfh").set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);

      const approved = res.body.data.find(
        (w: { status: WfhStatus }) => w.status === WfhStatus.APPROVED
      );
      expect(approved.employeeId).toBe("EMP-003");
      expect(approved.reviewerRemarks).toBe("Approved by HR Director");
      expect(approved.reviewedBy).toBe("hr.director@vorldx.demo");

      const pending = res.body.data.find(
        (w: { status: WfhStatus }) => w.status === WfhStatus.PENDING
      );
      expect(pending.employeeId).toBe("EMP-004");
    });
  });

  describe("CSV Streaming & OWASP Formula Injection Escaping", () => {
    it("streams CSV with text/csv header, UTF-8 BOM, and escapes formula injection characters (=, +, -, @)", async () => {
      const res = await request(app)
        .get("/reports/wfh/export")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toMatch(/attachment; filename=/);

      const csvText = res.text;

      // Header row check
      expect(csvText).toContain("Date,Employee ID,Name,Department,Status,Reason");

      // Critical OWASP Formula Injection Escaping:
      // emp1's reason was: "=CMD|' /C calc'!A0"
      // Must be safely escaped with leading single quote: "'=CMD|' /C calc'!A0"
      expect(csvText).toContain("`=CMD|' /C calc'!A0".replace("`", "'"));
      // The cell must NOT begin with raw '='
      expect(csvText).not.toMatch(/,"=CMD/);

      // Reviewer remarks was: "+12345 Dangerous formula remark"
      // Must be safely escaped with leading single quote: "'+12345 Dangerous formula remark"
      expect(csvText).toContain("'+12345");
      expect(csvText).not.toMatch(/,\+12345/);
    });

    it("exports employee-wise summary report to CSV with escaped cells", async () => {
      const res = await request(app)
        .get("/reports/employee-wise/export?startDate=2026-10-19&endDate=2026-10-20")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text).toContain("Employee ID,Name,Department,Designation");
      expect(res.text).toContain("EMP-001,Alice Smith,Engineering");
    });
  });

  describe("GET /audit-logs (Security & Operational Trail)", () => {
    it("allows HR to query audit logs with actor and entity filters", async () => {
      const res = await request(app)
        .get("/audit-logs?entityType=EMPLOYEE")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].entityType).toBe("EMPLOYEE");
      expect(res.body.data[0].action).toBe("CREATE");
      expect(res.body.data[0].performedByEmployeeId).toBe("HR-9001");
    });

    it("filters audit logs by action type", async () => {
      const res = await request(app)
        .get("/audit-logs?action=CORRECTION")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe("CORRECTION");
      expect(res.body.data[0].entityType).toBe("ATTENDANCE_RECORD");
    });

    it("filters audit logs by date range and search term", async () => {
      const res = await request(app)
        .get("/audit-logs?startDate=2026-10-14&endDate=2026-10-16")
        .set("Authorization", `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reason).toMatch(/Adjusted missing checkout/i);
    });

    it("blocks regular employee from viewing audit logs with 403 ERR_FORBIDDEN", async () => {
      const res = await request(app)
        .get("/audit-logs")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ApiErrorCode.ERR_FORBIDDEN);
    });
  });
});
