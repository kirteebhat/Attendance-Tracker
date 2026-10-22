import { describe, it, expect } from "vitest";
import {
  Employee,
  AttendanceRecord,
  WfhRequest,
  QrChallenge,
  RegistrationOtp,
  AttendancePolicy,
  Holiday,
  QrDisplay,
  AuditEvent,
} from "../src/models";
import { AttendanceStatus, WfhStatus, TerminalStatus, WorkType } from "@vorldx/shared";

describe("Mongoose Models & Schema Constraints", () => {
  it("enforces unique employeeId and unique email on Employee", async () => {
    // Ensure indexes are built
    await Employee.init();

    const emp1 = await Employee.create({
      employeeId: "VX-101",
      name: "Aarav Sharma",
      email: "aarav.sharma@vorldx.demo",
      department: "Engineering",
      designation: "Frontend Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-01-15",
    });
    expect(emp1._id).toBeDefined();

    // Duplicate employeeId must fail
    await expect(
      Employee.create({
        employeeId: "VX-101",
        name: "Different Name",
        email: "different.email@vorldx.demo",
        department: "Engineering",
        designation: "QA Engineer",
        workType: WorkType.FULL_TIME,
        joiningDate: "2026-02-01",
      })
    ).rejects.toThrow();

    // Duplicate email must fail
    await expect(
      Employee.create({
        employeeId: "VX-102",
        name: "Second Person",
        email: "aarav.sharma@vorldx.demo",
        department: "Design",
        designation: "UI Designer",
        workType: WorkType.FULL_TIME,
        joiningDate: "2026-02-01",
      })
    ).rejects.toThrow();
  });

  it("enforces unique compound index (employee, dateKey) on AttendanceRecord", async () => {
    await AttendanceRecord.init();

    const emp = await Employee.create({
      employeeId: "VX-201",
      name: "Priya Patel",
      email: "priya.patel@vorldx.demo",
      department: "Operations",
      designation: "Operations Lead",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-01-10",
    });

    const record1 = await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: "2026-10-20",
      status: AttendanceStatus.PRESENT,
      checkInTime: new Date("2026-10-20T03:30:00Z"),
    });
    expect(record1._id).toBeDefined();

    // Attempting to create a second attendance record for the SAME employee and SAME dateKey must fail with duplicate key
    await expect(
      AttendanceRecord.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: "2026-10-20",
        status: AttendanceStatus.LATE,
        checkInTime: new Date("2026-10-20T04:00:00Z"),
      })
    ).rejects.toThrow();

    // But a different dateKey for the same employee must succeed
    const record2 = await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: "2026-10-21",
      status: AttendanceStatus.PRESENT,
      checkInTime: new Date("2026-10-21T03:30:00Z"),
    });
    expect(record2._id).toBeDefined();
  });

  it("preserves original values on AttendanceRecord when a correction is logged", async () => {
    const emp = await Employee.create({
      employeeId: "VX-301",
      name: "Rohan Verma",
      email: "rohan.verma@vorldx.demo",
      department: "Engineering",
      designation: "Backend Engineer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-02-15",
    });

    const originalCheckIn = new Date("2026-10-20T04:15:00Z"); // Late punch
    const record = await AttendanceRecord.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: "2026-10-20",
      status: AttendanceStatus.LATE,
      isLate: true,
      lateMinutes: 45,
      checkInTime: originalCheckIn,
    });

    // Simulate HR manual correction: update to PRESENT with justification while archiving original values
    record.originalValues = {
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      status: record.status,
      durationMinutes: record.durationMinutes,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
    };
    record.isManuallyCorrected = true;
    record.correctionReason = "Biometric display network delay verified by office log";
    record.status = AttendanceStatus.PRESENT;
    record.isLate = false;
    record.lateMinutes = 0;
    record.checkInTime = new Date("2026-10-20T03:30:00Z");
    record.correctedAt = new Date();

    await record.save();

    const updated = await AttendanceRecord.findById(record._id);
    expect(updated?.isManuallyCorrected).toBe(true);
    expect(updated?.status).toBe(AttendanceStatus.PRESENT);
    expect(updated?.originalValues?.status).toBe(AttendanceStatus.LATE);
    expect(updated?.originalValues?.isLate).toBe(true);
    expect(updated?.originalValues?.lateMinutes).toBe(45);
    expect(updated?.correctionReason).toContain("Biometric display network delay");
  });

  it("enforces unique compound index (employee, dateKey) and minlength validation on WfhRequest", async () => {
    await WfhRequest.init();

    const emp = await Employee.create({
      employeeId: "VX-401",
      name: "Sneha Reddy",
      email: "sneha.reddy@vorldx.demo",
      department: "Marketing",
      designation: "Content Lead",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-03-01",
    });

    // Reason too short (< 5 chars) must fail validation
    await expect(
      WfhRequest.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: "2026-10-25",
        reason: "Sick", // Only 4 characters
      })
    ).rejects.toThrow();

    // Valid request succeeds
    const wfh1 = await WfhRequest.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      department: emp.department,
      dateKey: "2026-10-25",
      reason: "Medical appointment and home rest",
      status: WfhStatus.PENDING,
    });
    expect(wfh1._id).toBeDefined();

    // Duplicate request for the same employee and same dateKey must fail
    await expect(
      WfhRequest.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        department: emp.department,
        dateKey: "2026-10-25",
        reason: "Family event and remote working",
      })
    ).rejects.toThrow();
  });

  it("enforces unique compound index on QrChallenge (employee, qrNonce) for replay protection", async () => {
    await QrChallenge.init();

    const emp = await Employee.create({
      employeeId: "VX-501",
      name: "Vikram Das",
      email: "vikram.das@vorldx.demo",
      department: "Security",
      designation: "Security Officer",
      workType: WorkType.FULL_TIME,
      joiningDate: "2026-01-01",
    });

    const challenge = await QrChallenge.create({
      employee: emp._id,
      employeeId: emp.employeeId,
      qrNonce: "nonce_abc_12345",
      terminalId: "term_lko_01",
    });
    expect(challenge._id).toBeDefined();

    // Same employee scanning the exact same nonce must fail with duplicate key
    await expect(
      QrChallenge.create({
        employee: emp._id,
        employeeId: emp.employeeId,
        qrNonce: "nonce_abc_12345",
        terminalId: "term_lko_01",
      })
    ).rejects.toThrow();
  });

  it("creates and validates AttendancePolicy, Holiday, QrDisplay, and AuditEvent models", async () => {
    // Attendance Policy
    const policy = await AttendancePolicy.create({
      name: "VorldX Standard Policy",
      timezone: "Asia/Kolkata",
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      shifts: [
        {
          name: "General Day Shift",
          startTime: "09:00",
          endTime: "17:00",
          graceMinutes: 15,
          isOvernight: false,
          isActive: true,
        },
      ],
    });
    expect(policy.timezone).toBe("Asia/Kolkata");
    expect(policy.shifts.length).toBe(1);

    // Holiday
    const holiday = await Holiday.create({
      name: "Republic Day",
      dateKey: "2026-01-26",
      isRecurring: true,
    });
    expect(holiday.dateKey).toBe("2026-01-26");

    // QrDisplay
    const terminal = await QrDisplay.create({
      terminalId: "term_test_01",
      name: "Test Lobby Screen",
      location: "Main Entrance",
      pairingCode: "VX-9999",
      status: TerminalStatus.UNPAIRED,
    });
    expect(terminal.status).toBe(TerminalStatus.UNPAIRED);
    expect(terminal.isActive).toBe(true);

    // RegistrationOtp
    const otp = await RegistrationOtp.create({
      employeeId: "VX-999",
      email: "demo@vorldx.demo",
      hashedCode: "hashed_code_secret",
      expiresAt: new Date(Date.now() + 600000),
    });
    expect(otp.attempts).toBe(0);
    expect(otp.isUsed).toBe(false);

    // AuditEvent
    const audit = await AuditEvent.create({
      entityType: "ATTENDANCE_RECORD",
      entityId: "rec_12345",
      action: "MANUAL_CORRECTION",
      reason: "Admin time adjustment",
      timestamp: new Date(),
    });
    expect(audit.action).toBe("MANUAL_CORRECTION");
  });
});
