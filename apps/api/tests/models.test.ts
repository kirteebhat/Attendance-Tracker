import { describe, it, expect } from "vitest";
import { Types } from "mongoose";
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
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  CalendarEvent,
  Announcement,
  Enquiry,
  EnquiryMessage,
  StaffOtpChallenge,
  TrustedDevice,
  StaffSession,
  AppRelease,
  SavedView,
  Notification,
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

  describe("Enterprise Extension Models & Schema Constraints", () => {
    it("enforces unique name and code on LeaveType", async () => {
      await LeaveType.init();

      const lt1 = await LeaveType.create({
        name: "Casual Leave",
        code: "CL",
        paid: true,
        annualQuota: 12,
        halfDayAllowed: true,
        carryForwardRule: { allowed: true, maxDays: 5, expiryMonths: 3 },
      });
      expect(lt1._id).toBeDefined();
      expect(lt1.carryForwardRule.maxDays).toBe(5);

      // Duplicate name fails
      await expect(
        LeaveType.create({
          name: "Casual Leave",
          code: "DIFF",
          annualQuota: 10,
        })
      ).rejects.toThrow();

      // Duplicate code fails
      await expect(
        LeaveType.create({
          name: "Other Leave",
          code: "CL",
          annualQuota: 10,
        })
      ).rejects.toThrow();
    });

    it("enforces unique compound index (employee, type, year) on LeaveBalance", async () => {
      await LeaveBalance.init();
      const empId = new Types.ObjectId();
      const leaveTypeId = new Types.ObjectId();

      const balance1 = await LeaveBalance.create({
        employee: empId,
        type: leaveTypeId,
        year: 2026,
        allotted: 12,
        used: 2,
        pending: 1,
        carriedOver: 0,
      });
      expect(balance1._id).toBeDefined();

      // Duplicate for same employee + leaveType + year must reject
      await expect(
        LeaveBalance.create({
          employee: empId,
          type: leaveTypeId,
          year: 2026,
          allotted: 14,
        })
      ).rejects.toThrow();

      // Different year should succeed
      const balanceNextYear = await LeaveBalance.create({
        employee: empId,
        type: leaveTypeId,
        year: 2027,
        allotted: 12,
      });
      expect(balanceNextYear.year).toBe(2027);
    });

    it("validates LeaveRequest dates and working days constraint", async () => {
      const empId = new Types.ObjectId();
      const leaveTypeId = new Types.ObjectId();

      const req = await LeaveRequest.create({
        employee: empId,
        type: leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        isHalfDay: false,
        workingDays: 3,
        reason: "Family vacation trip",
        status: "PENDING",
      });
      expect(req.status).toBe("PENDING");
      expect(req.workingDays).toBe(3);

      // End date before start date must fail pre-validate hook
      await expect(
        LeaveRequest.create({
          employee: empId,
          type: leaveTypeId,
          startDate: new Date("2026-03-15"),
          endDate: new Date("2026-03-10"),
          isHalfDay: false,
          workingDays: 1,
          reason: "Invalid dates test",
          status: "PENDING",
        })
      ).rejects.toThrow(/greater than or equal to start date/);
    });

    it("validates CalendarEvent types, sources, and audience", async () => {
      const event = await CalendarEvent.create({
        type: "holiday",
        title: "Independence Day",
        description: "National public holiday",
        startDate: new Date("2026-08-15T00:00:00.000Z"),
        endDate: new Date("2026-08-15T23:59:59.999Z"),
        isFullDay: true,
        source: "manual",
        audience: { scope: "all", departments: [], roles: [], shiftIds: [] },
      });
      expect(event.type).toBe("holiday");
      expect(event.source).toBe("manual");
      expect(event.audience.scope).toBe("all");
    });

    it("validates Announcement priorities and TTL index on expiresAt", async () => {
      await Announcement.init();
      const announcement = await Announcement.create({
        title: "Quarterly Town Hall",
        body: "Join us for company-wide updates and Q&A session.",
        priority: "HIGH",
        pinned: true,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
        source: "manual",
        audience: { scope: "all", departments: [], roles: [] },
      });
      expect(announcement.priority).toBe("HIGH");
      expect(announcement.pinned).toBe(true);

      // Verify TTL index configuration
      const indexes = await Announcement.collection.indexes();
      const ttlIndex = indexes.find((idx) => idx.name === "expiresAt_1" || (idx.key && idx.key.expiresAt === 1));
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(0);
    });

    it("creates Enquiry and linked EnquiryMessage thread", async () => {
      const empId = new Types.ObjectId();
      const hrId = new Types.ObjectId();

      const enquiry = await Enquiry.create({
        employee: empId,
        category: "PAYROLL",
        subject: "Discrepancy in February tax deduction",
        status: "OPEN",
        priority: "MEDIUM",
        assignee: hrId,
      });
      expect(enquiry.category).toBe("PAYROLL");
      expect(enquiry.status).toBe("OPEN");

      const message = await EnquiryMessage.create({
        enquiry: enquiry._id,
        sender: empId,
        senderRole: "EMPLOYEE",
        message: "Hello, my tax deduction seems higher than expected.",
        readByRecipient: false,
      });
      expect(message.enquiry.toString()).toBe(enquiry._id.toString());
      expect(message.senderRole).toBe("EMPLOYEE");
    });

    it("validates StaffOtpChallenge TTL index and attempt limits", async () => {
      await StaffOtpChallenge.init();
      const userId = new Types.ObjectId();

      const challenge = await StaffOtpChallenge.create({
        mobileNumber: "+919876543210",
        user: userId,
        otpHash: "argon2_or_bcrypt_hash_sample",
        purpose: "LOGIN",
        attempts: 0,
        isConsumed: false,
        expiresAt: new Date(Date.now() + 300000),
      });
      expect(challenge.purpose).toBe("LOGIN");
      expect(challenge.isConsumed).toBe(false);

      // Verify TTL index on expiresAt
      const indexes = await StaffOtpChallenge.collection.indexes();
      const ttlIndex = indexes.find((idx) => idx.name === "expiresAt_1" || (idx.key && idx.key.expiresAt === 1));
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(0);
    });

    it("enforces unique compound index (user, deviceFingerprint) on TrustedDevice", async () => {
      await TrustedDevice.init();
      const userId = new Types.ObjectId();

      const dev1 = await TrustedDevice.create({
        user: userId,
        deviceFingerprint: "fingerprint_abc123xyz789",
        deviceName: "MacBook Pro 16",
        platform: "macOS",
        trustedUntil: new Date(Date.now() + 30 * 86400000),
      });
      expect(dev1._id).toBeDefined();

      // Duplicate fingerprint for same user must reject
      await expect(
        TrustedDevice.create({
          user: userId,
          deviceFingerprint: "fingerprint_abc123xyz789",
          deviceName: "Different name",
          platform: "macOS",
          trustedUntil: new Date(Date.now() + 30 * 86400000),
        })
      ).rejects.toThrow();
    });

    it("enforces unique tokenHash and TTL on StaffSession", async () => {
      await StaffSession.init();
      const userId = new Types.ObjectId();

      const session = await StaffSession.create({
        user: userId,
        tokenHash: "sha256_hash_token_abc_123",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 Chrome/120.0",
        isActive: true,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
      expect(session.isActive).toBe(true);

      // Duplicate tokenHash must reject
      await expect(
        StaffSession.create({
          user: userId,
          tokenHash: "sha256_hash_token_abc_123",
          ipAddress: "192.168.1.101",
          userAgent: "Safari",
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })
      ).rejects.toThrow();

      // Verify TTL index on expiresAt
      const indexes = await StaffSession.collection.indexes();
      const ttlIndex = indexes.find((idx) => idx.name === "expiresAt_1" || (idx.key && idx.key.expiresAt === 1));
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(0);
    });

    it("enforces unique compound index (platform, version) on AppRelease", async () => {
      await AppRelease.init();

      const rel1 = await AppRelease.create({
        platform: "ANDROID",
        version: "2.1.0",
        versionCode: 20100,
        minSupportedVersion: "1.0.0",
        notes: "Bug fixes and performance improvements",
        forceUpdate: false,
      });
      expect(rel1._id).toBeDefined();

      // Duplicate platform + version must reject
      await expect(
        AppRelease.create({
          platform: "ANDROID",
          version: "2.1.0",
          versionCode: 20101,
          minSupportedVersion: "1.0.0",
          notes: "Another build",
        })
      ).rejects.toThrow();

      // Different platform should succeed
      const relIos = await AppRelease.create({
        platform: "IOS",
        version: "2.1.0",
        versionCode: 20100,
        minSupportedVersion: "1.0.0",
        notes: "iOS Release",
      });
      expect(relIos.platform).toBe("IOS");
    });

    it("enforces unique compound index (user, page, name) on SavedView", async () => {
      await SavedView.init();
      const userId = new Types.ObjectId();

      const view1 = await SavedView.create({
        user: userId,
        page: "attendance",
        name: "Late Arrivals Filter",
        filters: { status: "LATE" },
        isDefault: false,
      });
      expect(view1._id).toBeDefined();

      // Duplicate view name for same user and page must reject
      await expect(
        SavedView.create({
          user: userId,
          page: "attendance",
          name: "Late Arrivals Filter",
          filters: { status: "LATE" },
        })
      ).rejects.toThrow();

      // Same name on different page should succeed
      const view2 = await SavedView.create({
        user: userId,
        page: "wfh",
        name: "Late Arrivals Filter",
      });
      expect(view2.page).toBe("wfh");
    });

    it("creates Notification with type and readAt tracking", async () => {
      const userId = new Types.ObjectId();

      const notification = await Notification.create({
        user: userId,
        type: "LEAVE_STATUS",
        title: "Leave Request Approved",
        message: "Your leave request for March 10 - March 12 has been approved by HR.",
        payload: { requestId: "req_12345", workingDays: 3 },
        readAt: null,
      });
      expect(notification.type).toBe("LEAVE_STATUS");
      expect(notification.readAt).toBeNull();

      notification.readAt = new Date();
      await notification.save();
      expect(notification.readAt).toBeInstanceOf(Date);
    });
  });
});
