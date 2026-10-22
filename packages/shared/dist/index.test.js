"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_1 = require("./index");
(0, node_test_1.describe)("@vorldx/shared package exports", () => {
    (0, node_test_1.test)("enums have expected values", () => {
        node_assert_1.default.strictEqual(index_1.UserRole.EMPLOYEE, "EMPLOYEE");
        node_assert_1.default.strictEqual(index_1.UserRole.HR_ADMIN, "HR_ADMIN");
        node_assert_1.default.strictEqual(index_1.AttendanceStatus.PRESENT, "PRESENT");
        node_assert_1.default.strictEqual(index_1.AttendanceStatus.LATE, "LATE");
        node_assert_1.default.strictEqual(index_1.PunchType.CHECK_IN, "CHECK_IN");
        node_assert_1.default.strictEqual(index_1.WfhStatus.APPROVED, "APPROVED");
        node_assert_1.default.strictEqual(index_1.TerminalStatus.ACTIVE, "ACTIVE");
    });
    (0, node_test_1.test)("socket events and rooms generate valid strings", () => {
        node_assert_1.default.strictEqual(index_1.SocketEvent.QR_TOKEN_ROTATE, "qr:token_rotate");
        node_assert_1.default.strictEqual(index_1.SocketEvent.ATTENDANCE_PUNCHED, "attendance:punched");
        node_assert_1.default.strictEqual(index_1.SocketRoom.employee("emp_123"), "employee:emp_123");
        node_assert_1.default.strictEqual(index_1.SocketRoom.display("term_01"), "display:term_01");
        node_assert_1.default.strictEqual(index_1.SocketRoom.hrDashboard(), "hr:dashboard");
    });
    (0, node_test_1.test)("error codes are defined correctly", () => {
        node_assert_1.default.strictEqual(index_1.ApiErrorCode.ERR_QR_EXPIRED, "ERR_QR_EXPIRED");
        node_assert_1.default.strictEqual(index_1.ApiErrorCode.ERR_ALREADY_CHECKED_IN, "ERR_ALREADY_CHECKED_IN");
    });
    (0, node_test_1.test)("Zod validation schemas work as expected", () => {
        const validRegister = index_1.RegisterRequestSchema.safeParse({
            employeeId: "VX-1001",
            password: "StrongPassword123!",
        });
        node_assert_1.default.strictEqual(validRegister.success, true);
        const invalidRegister = index_1.RegisterRequestSchema.safeParse({
            employeeId: "",
            password: "123",
        });
        node_assert_1.default.strictEqual(invalidRegister.success, false);
        const validQr = index_1.QrPayloadSchema.safeParse({
            v: 1,
            tid: "term_01",
            ts: 1774092000,
            exp: 1774092030,
            n: "a9f8b2c4e1",
            sig: "9f83ab2c4e1075f82d1b",
        });
        node_assert_1.default.strictEqual(validQr.success, true);
        const validPunch = index_1.PunchRequestSchema.safeParse({
            qrPayload: "dummy_payload_string",
        });
        node_assert_1.default.strictEqual(validPunch.success, true);
    });
    (0, node_test_1.test)("getDateKey accurately derives YYYY-MM-DD in Asia/Kolkata timezone", () => {
        // 21:00 UTC on 2026-10-20 is 02:30 AM on 2026-10-21 in Asia/Kolkata (+05:30)
        const lateUtc = new Date("2026-10-20T21:00:00.000Z");
        node_assert_1.default.strictEqual((0, index_1.getDateKey)(lateUtc, "Asia/Kolkata"), "2026-10-21");
        // 17:00 UTC on 2026-10-20 is 22:30 PM on 2026-10-20 in Asia/Kolkata (+05:30)
        const eveningUtc = new Date("2026-10-20T17:00:00.000Z");
        node_assert_1.default.strictEqual((0, index_1.getDateKey)(eveningUtc, "Asia/Kolkata"), "2026-10-20");
    });
    (0, node_test_1.test)("localTimeToUtc converts wall-clock time in Asia/Kolkata to exact UTC Date", () => {
        // 09:30 AM IST on 2026-10-20 is 04:00 AM UTC
        const utcDate = (0, index_1.localTimeToUtc)("2026-10-20", "09:30", "Asia/Kolkata");
        node_assert_1.default.strictEqual(utcDate.toISOString(), "2026-10-20T04:00:00.000Z");
        // 21:00 PM IST on 2026-10-20 is 15:30 PM UTC
        const nightUtc = (0, index_1.localTimeToUtc)("2026-10-20", "21:00", "Asia/Kolkata");
        node_assert_1.default.strictEqual(nightUtc.toISOString(), "2026-10-20T15:30:00.000Z");
    });
    (0, node_test_1.test)("isWorkday accurately determines working days", () => {
        // 2026-10-20 is a Tuesday (Day 2)
        node_assert_1.default.strictEqual((0, index_1.isWorkday)("2026-10-20", [1, 2, 3, 4, 5]), true);
        // 2026-10-24 is Saturday (Day 6)
        node_assert_1.default.strictEqual((0, index_1.isWorkday)("2026-10-24", [1, 2, 3, 4, 5]), false);
        // 2026-10-25 is Sunday (Day 0)
        node_assert_1.default.strictEqual((0, index_1.isWorkday)("2026-10-25", [1, 2, 3, 4, 5]), false);
    });
    (0, node_test_1.test)("isHoliday matches specific and recurring annual holidays", () => {
        const holidays = [
            { dateKey: "2026-10-02", isRecurring: true }, // Gandhi Jayanti (recurring)
            { dateKey: "2026-11-12", isRecurring: false }, // Specific company holiday
        ];
        // Same year exact match
        node_assert_1.default.strictEqual((0, index_1.isHoliday)("2026-10-02", holidays), true);
        node_assert_1.default.strictEqual((0, index_1.isHoliday)("2026-11-12", holidays), true);
        // Future year recurring match (2027-10-02 matches 10-02)
        node_assert_1.default.strictEqual((0, index_1.isHoliday)("2027-10-02", holidays), true);
        // Non-recurring future year does NOT match
        node_assert_1.default.strictEqual((0, index_1.isHoliday)("2027-11-12", holidays), false);
        // Non-holiday date
        node_assert_1.default.strictEqual((0, index_1.isHoliday)("2026-10-20", holidays), false);
    });
    (0, node_test_1.test)("getShiftWindow calculates daytime and overnight shift UTC boundaries", () => {
        // 1. Daytime Shift: 09:30 to 18:30 IST
        const dayShift = {
            name: "General Day Shift",
            startTime: "09:30",
            endTime: "18:30",
            graceMinutes: 15,
            isOvernight: false,
        };
        const dayWindow = (0, index_1.getShiftWindow)(dayShift, "2026-10-20", "Asia/Kolkata");
        node_assert_1.default.strictEqual(dayWindow.shiftStartUtc.toISOString(), "2026-10-20T04:00:00.000Z");
        node_assert_1.default.strictEqual(dayWindow.shiftEndUtc.toISOString(), "2026-10-20T13:00:00.000Z");
        node_assert_1.default.strictEqual(dayWindow.graceEndUtc.toISOString(), "2026-10-20T04:15:00.000Z");
        node_assert_1.default.strictEqual(dayWindow.isOvernight, false);
        // 2. Overnight Shift: 21:00 to 06:00 IST (crosses midnight into Oct 21 IST)
        const nightShift = {
            name: "Overnight Operations Shift",
            startTime: "21:00",
            endTime: "06:00",
            graceMinutes: 15,
            isOvernight: true,
        };
        const nightWindow = (0, index_1.getShiftWindow)(nightShift, "2026-10-20", "Asia/Kolkata");
        node_assert_1.default.strictEqual(nightWindow.shiftStartUtc.toISOString(), "2026-10-20T15:30:00.000Z");
        node_assert_1.default.strictEqual(nightWindow.shiftEndUtc.toISOString(), "2026-10-21T00:30:00.000Z"); // Oct 21 06:00 IST is Oct 21 00:30 UTC
        node_assert_1.default.strictEqual(nightWindow.graceEndUtc.toISOString(), "2026-10-20T15:45:00.000Z");
        node_assert_1.default.strictEqual(nightWindow.isOvernight, true);
    });
    (0, node_test_1.test)("isLate detects on-time vs late punch accurately", () => {
        const shift = {
            name: "General Day Shift",
            startTime: "09:30",
            endTime: "18:30",
            graceMinutes: 15,
        };
        // On-time: 09:40 IST (04:10 UTC) is within 15-min grace (09:45 IST)
        const onTimePunch = new Date("2026-10-20T04:10:00.000Z");
        const onTimeResult = (0, index_1.isLate)(onTimePunch, shift, "2026-10-20", "Asia/Kolkata");
        node_assert_1.default.strictEqual(onTimeResult.isLate, false);
        node_assert_1.default.strictEqual(onTimeResult.lateMinutes, 0);
        // Exactly at grace limit: 09:45 IST (04:15 UTC) -> on-time
        const boundaryPunch = new Date("2026-10-20T04:15:00.000Z");
        const boundaryResult = (0, index_1.isLate)(boundaryPunch, shift, "2026-10-20", "Asia/Kolkata");
        node_assert_1.default.strictEqual(boundaryResult.isLate, false);
        // Late: 09:50 IST (04:20 UTC) is 20 minutes past shift start (09:30)
        const latePunch = new Date("2026-10-20T04:20:00.000Z");
        const lateResult = (0, index_1.isLate)(latePunch, shift, "2026-10-20", "Asia/Kolkata");
        node_assert_1.default.strictEqual(lateResult.isLate, true);
        node_assert_1.default.strictEqual(lateResult.lateMinutes, 20);
    });
    (0, node_test_1.test)("validateShift and validatePolicyShifts enforce timing and uniqueness rules", () => {
        // End before start without overnight flag -> invalid
        const invalidDay = (0, index_1.validateShift)({
            name: "Broken Shift",
            startTime: "18:00",
            endTime: "09:00",
            isOvernight: false,
        });
        node_assert_1.default.strictEqual(invalidDay.valid, false);
        node_assert_1.default.ok(invalidDay.error?.includes("must be after start time"));
        // Overnight with end before start -> valid
        const validNight = (0, index_1.validateShift)({
            name: "Valid Night",
            startTime: "21:00",
            endTime: "06:00",
            isOvernight: true,
        });
        node_assert_1.default.strictEqual(validNight.valid, true);
        // Grace > 60 min -> invalid
        const invalidGrace = (0, index_1.validateShift)({
            name: "Big Grace",
            startTime: "09:00",
            endTime: "17:00",
            graceMinutes: 90,
        });
        node_assert_1.default.strictEqual(invalidGrace.valid, false);
        // Policy with duplicate shift names -> invalid
        const duplicateShifts = (0, index_1.validatePolicyShifts)([
            { name: "Day Shift", startTime: "09:00", endTime: "17:00" },
            { name: "Day Shift", startTime: "10:00", endTime: "18:00" },
        ]);
        node_assert_1.default.strictEqual(duplicateShifts.valid, false);
        node_assert_1.default.ok(duplicateShifts.error?.includes("Duplicate shift name"));
    });
});
