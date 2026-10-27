import { test, describe } from "node:test";
import assert from "node:assert";
import {
  UserRole,
  AttendanceStatus,
  PunchType,
  WfhStatus,
  TerminalStatus,
  ApiErrorCode,
  SocketEvent,
  SocketRoom,
  RegisterRequestSchema,
  PunchRequestSchema,
  QrPayloadSchema,
  getDateKey,
  localTimeToUtc,
  isWorkday,
  isHoliday,
  getShiftWindow,
  isLate,
  validateShift,
  validatePolicyShifts,
  FeatureFlagsSchema,
  DEFAULT_FEATURE_FLAGS,
  UpdateFeatureFlagPayloadSchema,
  STATUS_REGISTRY,
  getStatusDescriptor,
  LeaveTypeSchema,
  LeaveBalanceSchema,
  LeaveRequestSchema,
  CalendarEventSchema,
  AnnouncementSchema,
  EnquirySchema,
  StaffOtpChallengeSchema,
  TrustedDeviceSchema,
  StaffSessionSchema,
  AppReleaseSchema,
  SavedViewSchema,
  NotificationSchema,
} from "./index";

describe("@vorldx/shared package exports", () => {
  test("enums have expected values", () => {
    assert.strictEqual(UserRole.EMPLOYEE, "EMPLOYEE");
    assert.strictEqual(UserRole.HR_ADMIN, "HR_ADMIN");
    assert.strictEqual(AttendanceStatus.PRESENT, "PRESENT");
    assert.strictEqual(AttendanceStatus.LATE, "LATE");
    assert.strictEqual(PunchType.CHECK_IN, "CHECK_IN");
    assert.strictEqual(WfhStatus.APPROVED, "APPROVED");
    assert.strictEqual(TerminalStatus.ACTIVE, "ACTIVE");
  });

  test("socket events and rooms generate valid strings", () => {
    assert.strictEqual(SocketEvent.QR_TOKEN_ROTATE, "qr:token_rotate");
    assert.strictEqual(SocketEvent.ATTENDANCE_PUNCHED, "attendance:punched");
    assert.strictEqual(SocketRoom.employee("emp_123"), "employee:emp_123");
    assert.strictEqual(SocketRoom.display("term_01"), "display:term_01");
    assert.strictEqual(SocketRoom.hrDashboard(), "hr:dashboard");
  });

  test("error codes are defined correctly", () => {
    assert.strictEqual(ApiErrorCode.ERR_QR_EXPIRED, "ERR_QR_EXPIRED");
    assert.strictEqual(ApiErrorCode.ERR_ALREADY_CHECKED_IN, "ERR_ALREADY_CHECKED_IN");
  });

  test("Zod validation schemas work as expected", () => {
    const validRegister = RegisterRequestSchema.safeParse({
      employeeId: "VX-1001",
      password: "StrongPassword123!",
    });
    assert.strictEqual(validRegister.success, true);

    const invalidRegister = RegisterRequestSchema.safeParse({
      employeeId: "",
      password: "123",
    });
    assert.strictEqual(invalidRegister.success, false);

    const validQr = QrPayloadSchema.safeParse({
      v: 1,
      tid: "term_01",
      ts: 1774092000,
      exp: 1774092030,
      n: "a9f8b2c4e1",
      sig: "9f83ab2c4e1075f82d1b",
    });
    assert.strictEqual(validQr.success, true);

    const validPunch = PunchRequestSchema.safeParse({
      qrPayload: "dummy_payload_string",
    });
    assert.strictEqual(validPunch.success, true);
  });

  test("getDateKey accurately derives YYYY-MM-DD in Asia/Kolkata timezone", () => {
    // 21:00 UTC on 2026-10-20 is 02:30 AM on 2026-10-21 in Asia/Kolkata (+05:30)
    const lateUtc = new Date("2026-10-20T21:00:00.000Z");
    assert.strictEqual(getDateKey(lateUtc, "Asia/Kolkata"), "2026-10-21");

    // 17:00 UTC on 2026-10-20 is 22:30 PM on 2026-10-20 in Asia/Kolkata (+05:30)
    const eveningUtc = new Date("2026-10-20T17:00:00.000Z");
    assert.strictEqual(getDateKey(eveningUtc, "Asia/Kolkata"), "2026-10-20");
  });

  test("localTimeToUtc converts wall-clock time in Asia/Kolkata to exact UTC Date", () => {
    // 09:30 AM IST on 2026-10-20 is 04:00 AM UTC
    const utcDate = localTimeToUtc("2026-10-20", "09:30", "Asia/Kolkata");
    assert.strictEqual(utcDate.toISOString(), "2026-10-20T04:00:00.000Z");

    // 21:00 PM IST on 2026-10-20 is 15:30 PM UTC
    const nightUtc = localTimeToUtc("2026-10-20", "21:00", "Asia/Kolkata");
    assert.strictEqual(nightUtc.toISOString(), "2026-10-20T15:30:00.000Z");
  });

  test("isWorkday accurately determines working days", () => {
    // 2026-10-20 is a Tuesday (Day 2)
    assert.strictEqual(isWorkday("2026-10-20", [1, 2, 3, 4, 5]), true);

    // 2026-10-24 is Saturday (Day 6)
    assert.strictEqual(isWorkday("2026-10-24", [1, 2, 3, 4, 5]), false);

    // 2026-10-25 is Sunday (Day 0)
    assert.strictEqual(isWorkday("2026-10-25", [1, 2, 3, 4, 5]), false);
  });

  test("isHoliday matches specific and recurring annual holidays", () => {
    const holidays = [
      { dateKey: "2026-10-02", isRecurring: true }, // Gandhi Jayanti (recurring)
      { dateKey: "2026-11-12", isRecurring: false }, // Specific company holiday
    ];

    // Same year exact match
    assert.strictEqual(isHoliday("2026-10-02", holidays), true);
    assert.strictEqual(isHoliday("2026-11-12", holidays), true);

    // Future year recurring match (2027-10-02 matches 10-02)
    assert.strictEqual(isHoliday("2027-10-02", holidays), true);

    // Non-recurring future year does NOT match
    assert.strictEqual(isHoliday("2027-11-12", holidays), false);

    // Non-holiday date
    assert.strictEqual(isHoliday("2026-10-20", holidays), false);
  });

  test("getShiftWindow calculates daytime and overnight shift UTC boundaries", () => {
    // 1. Daytime Shift: 09:30 to 18:30 IST
    const dayShift = {
      name: "General Day Shift",
      startTime: "09:30",
      endTime: "18:30",
      graceMinutes: 15,
      isOvernight: false,
    };
    const dayWindow = getShiftWindow(dayShift, "2026-10-20", "Asia/Kolkata");
    assert.strictEqual(dayWindow.shiftStartUtc.toISOString(), "2026-10-20T04:00:00.000Z");
    assert.strictEqual(dayWindow.shiftEndUtc.toISOString(), "2026-10-20T13:00:00.000Z");
    assert.strictEqual(dayWindow.graceEndUtc.toISOString(), "2026-10-20T04:15:00.000Z");
    assert.strictEqual(dayWindow.isOvernight, false);

    // 2. Overnight Shift: 21:00 to 06:00 IST (crosses midnight into Oct 21 IST)
    const nightShift = {
      name: "Overnight Operations Shift",
      startTime: "21:00",
      endTime: "06:00",
      graceMinutes: 15,
      isOvernight: true,
    };
    const nightWindow = getShiftWindow(nightShift, "2026-10-20", "Asia/Kolkata");
    assert.strictEqual(nightWindow.shiftStartUtc.toISOString(), "2026-10-20T15:30:00.000Z");
    assert.strictEqual(nightWindow.shiftEndUtc.toISOString(), "2026-10-21T00:30:00.000Z"); // Oct 21 06:00 IST is Oct 21 00:30 UTC
    assert.strictEqual(nightWindow.graceEndUtc.toISOString(), "2026-10-20T15:45:00.000Z");
    assert.strictEqual(nightWindow.isOvernight, true);
  });

  test("isLate detects on-time vs late punch accurately", () => {
    const shift = {
      name: "General Day Shift",
      startTime: "09:30",
      endTime: "18:30",
      graceMinutes: 15,
    };

    // On-time: 09:40 IST (04:10 UTC) is within 15-min grace (09:45 IST)
    const onTimePunch = new Date("2026-10-20T04:10:00.000Z");
    const onTimeResult = isLate(onTimePunch, shift, "2026-10-20", "Asia/Kolkata");
    assert.strictEqual(onTimeResult.isLate, false);
    assert.strictEqual(onTimeResult.lateMinutes, 0);

    // Exactly at grace limit: 09:45 IST (04:15 UTC) -> on-time
    const boundaryPunch = new Date("2026-10-20T04:15:00.000Z");
    const boundaryResult = isLate(boundaryPunch, shift, "2026-10-20", "Asia/Kolkata");
    assert.strictEqual(boundaryResult.isLate, false);

    // Late: 09:50 IST (04:20 UTC) is 20 minutes past shift start (09:30)
    const latePunch = new Date("2026-10-20T04:20:00.000Z");
    const lateResult = isLate(latePunch, shift, "2026-10-20", "Asia/Kolkata");
    assert.strictEqual(lateResult.isLate, true);
    assert.strictEqual(lateResult.lateMinutes, 20);
  });

  test("validateShift and validatePolicyShifts enforce timing and uniqueness rules", () => {
    // End before start without overnight flag -> invalid
    const invalidDay = validateShift({
      name: "Broken Shift",
      startTime: "18:00",
      endTime: "09:00",
      isOvernight: false,
    });
    assert.strictEqual(invalidDay.valid, false);
    assert.ok(invalidDay.error?.includes("must be after start time"));

    // Overnight with end before start -> valid
    const validNight = validateShift({
      name: "Valid Night",
      startTime: "21:00",
      endTime: "06:00",
      isOvernight: true,
    });
    assert.strictEqual(validNight.valid, true);

    // Grace > 60 min -> invalid
    const invalidGrace = validateShift({
      name: "Big Grace",
      startTime: "09:00",
      endTime: "17:00",
      graceMinutes: 90,
    });
    assert.strictEqual(invalidGrace.valid, false);

    // Policy with duplicate shift names -> invalid
    const duplicateShifts = validatePolicyShifts([
      { name: "Day Shift", startTime: "09:00", endTime: "17:00" },
      { name: "Day Shift", startTime: "10:00", endTime: "18:00" },
    ]);
    assert.strictEqual(duplicateShifts.valid, false);
    assert.ok(duplicateShifts.error?.includes("Duplicate shift name"));
  });

  test("feature flag schemas validate properly", () => {
    assert.strictEqual(DEFAULT_FEATURE_FLAGS.leave, false);
    assert.strictEqual(DEFAULT_FEATURE_FLAGS.announcements, false);
    assert.strictEqual(DEFAULT_FEATURE_FLAGS.enquiries, false);
    assert.strictEqual(DEFAULT_FEATURE_FLAGS.calendarImport, false);
    assert.strictEqual(DEFAULT_FEATURE_FLAGS.threeD, false);
    assert.strictEqual(DEFAULT_FEATURE_FLAGS.otaUpdates, false);

    const parsed = FeatureFlagsSchema.parse({});
    assert.deepStrictEqual(parsed, DEFAULT_FEATURE_FLAGS);

    const validPayload = UpdateFeatureFlagPayloadSchema.safeParse({
      key: "leave",
      enabled: true,
      reason: "Rolling out leave module for beta",
    });
    assert.strictEqual(validPayload.success, true);

    const invalidPayload = UpdateFeatureFlagPayloadSchema.safeParse({
      key: "unsupportedFeature",
      enabled: true,
    });
    assert.strictEqual(invalidPayload.success, false);
  });

  test("shared status system enforces color, icon, and label for all statuses", () => {
    const requiredStatuses = [
      "PRESENT",
      "LATE",
      "ABSENT",
      "INCOMPLETE",
      "WFH",
      "LEAVE",
      "HOLIDAY",
      "OFF_DAY",
      "PENDING",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
    ] as const;

    for (const status of requiredStatuses) {
      const descriptor = STATUS_REGISTRY[status];
      assert.ok(descriptor, `Status descriptor missing for ${status}`);
      assert.ok(descriptor.label && descriptor.label.length > 0, `Missing label for ${status}`);
      assert.ok(descriptor.icon && descriptor.icon.length > 0, `Missing icon for ${status}`);
      assert.ok(descriptor.solidColor.startsWith("#"), `Invalid solidColor for ${status}`);
      assert.ok(descriptor.light.text && descriptor.light.bg, `Missing light colors for ${status}`);
      assert.ok(descriptor.dark.text && descriptor.dark.bg, `Missing dark colors for ${status}`);
      assert.ok(descriptor.ariaLabel && descriptor.ariaLabel.startsWith("Status:"), `Missing accessible ariaLabel for ${status}`);
    }

    // Test normalization helper
    assert.strictEqual(getStatusDescriptor("present").key, "PRESENT");
    assert.strictEqual(getStatusDescriptor("WFH_APPROVED").key, "WFH");
    assert.strictEqual(getStatusDescriptor("half_day").key, "INCOMPLETE");
    assert.strictEqual(getStatusDescriptor("WEEKEND").key, "OFF_DAY");
    assert.strictEqual(getStatusDescriptor("unknown_status").icon, "HelpCircle");
  });

  test("enterprise extension schemas validate accurately", () => {
    // 1. LeaveTypeSchema
    const validLeaveType = LeaveTypeSchema.safeParse({
      name: "Earned Leave",
      code: "EL",
      paid: true,
      annualQuota: 18,
      carryForwardRule: { allowed: true, maxDays: 10, expiryMonths: 6 },
      halfDayAllowed: true,
    });
    assert.strictEqual(validLeaveType.success, true);

    // 2. LeaveBalanceSchema
    const validBalance = LeaveBalanceSchema.safeParse({
      employee: "emp_123",
      type: "lt_456",
      year: 2026,
      allotted: 18,
      used: 3,
      pending: 1,
      carriedOver: 2,
    });
    assert.strictEqual(validBalance.success, true);

    // 3. LeaveRequestSchema
    const validLeaveReq = LeaveRequestSchema.safeParse({
      employee: "emp_123",
      type: "lt_456",
      startDate: "2026-04-01",
      endDate: "2026-04-03",
      isHalfDay: false,
      workingDays: 3,
      reason: "Annual family retreat",
      status: "PENDING",
    });
    assert.strictEqual(validLeaveReq.success, true);

    // 4. CalendarEventSchema
    const validCalEvent = CalendarEventSchema.safeParse({
      type: "holiday",
      title: "Diwali Celebration",
      startDate: new Date("2026-11-08"),
      endDate: new Date("2026-11-09"),
      isFullDay: true,
      source: "manual",
    });
    assert.strictEqual(validCalEvent.success, true);

    // 5. AnnouncementSchema
    const validAnnouncement = AnnouncementSchema.safeParse({
      title: "Policy Update Notice",
      body: "Updated WFH policy effective immediately.",
      priority: "HIGH",
      pinned: true,
      startsAt: new Date(),
    });
    assert.strictEqual(validAnnouncement.success, true);

    // 6. EnquirySchema
    const validEnquiry = EnquirySchema.safeParse({
      employee: "emp_123",
      category: "IT",
      subject: "VPN access issue on mobile network",
      status: "OPEN",
      priority: "HIGH",
    });
    assert.strictEqual(validEnquiry.success, true);

    // 7. StaffOtpChallengeSchema & TrustedDeviceSchema & StaffSessionSchema
    const validOtp = StaffOtpChallengeSchema.safeParse({
      mobileNumber: "+919876543210",
      user: "user_123",
      otpHash: "hashed_code",
      purpose: "LOGIN",
      attempts: 0,
      isConsumed: false,
      expiresAt: new Date(Date.now() + 300000),
    });
    assert.strictEqual(validOtp.success, true);

    const validDevice = TrustedDeviceSchema.safeParse({
      user: "user_123",
      deviceFingerprint: "fingerprint_12345678",
      deviceName: "Work iPhone 15",
      platform: "iOS",
      lastUsedAt: new Date(),
      trustedUntil: new Date(Date.now() + 86400000),
      isRevoked: false,
    });
    assert.strictEqual(validDevice.success, true);

    const validSession = StaffSessionSchema.safeParse({
      user: "user_123",
      tokenHash: "token_hash_123",
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent",
      isActive: true,
      expiresAt: new Date(Date.now() + 86400000),
      lastActivityAt: new Date(),
    });
    assert.strictEqual(validSession.success, true);

    // 8. AppReleaseSchema
    const validRelease = AppReleaseSchema.safeParse({
      platform: "ANDROID",
      version: "1.5.0",
      versionCode: 10500,
      minSupportedVersion: "1.0.0",
      minSupportedVersionCode: 10000,
      notes: "Performance optimizations and new scanner engine",
      forceUpdate: false,
      isPublished: true,
      publishedAt: new Date(),
    });
    assert.strictEqual(validRelease.success, true);

    // 9. SavedViewSchema
    const validSavedView = SavedViewSchema.safeParse({
      user: "user_123",
      page: "attendance",
      name: "Late Employees Today",
      filters: { status: "LATE" },
      isDefault: false,
    });
    assert.strictEqual(validSavedView.success, true);

    // 10. NotificationSchema
    const validNotification = NotificationSchema.safeParse({
      user: "user_123",
      type: "LEAVE_STATUS",
      title: "Leave Approved",
      message: "Your leave has been approved.",
      payload: { leaveId: "leave_999" },
    });
    assert.strictEqual(validNotification.success, true);

    // Socket events check
    assert.strictEqual(SocketEvent.LEAVE_REQUESTED, "leave.requested");
    assert.strictEqual(SocketEvent.CALENDAR_EVENT_CREATED, "calendar.event_created");
    assert.strictEqual(SocketEvent.ANNOUNCEMENT_PUBLISHED, "announcement.published");
    assert.strictEqual(SocketEvent.ENQUIRY_CREATED, "enquiry.created");
    assert.strictEqual(SocketEvent.APP_RELEASE_PUBLISHED, "app_release.published");
    assert.strictEqual(SocketEvent.NOTIFICATION_NEW, "notification.new");
  });
});
