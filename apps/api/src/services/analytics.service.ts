import { Types } from "mongoose";
import { Employee, AttendanceRecord, WfhRequest, LeaveRequest } from "../models";
import { policyService } from "./policy.service";
import {
  AttendanceStatus,
  WfhStatus,
  getDateKey,
  addDaysToDateKey,
  LiveAnalyticsQuery,
  LiveAttendanceAnalyticsResponse,
  HourlyCheckInItem,
  HeatmapCell,
  LiveScanFeedItem,
  AttendanceStatusSplit,
  DepartmentAttendanceBreakdown,
} from "@vorldx/shared";

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Pure helper to extract local hour (0-23) and weekday (0-6) in given timezone
 */
export function getHourAndWeekdayInTimezone(
  date: Date,
  timezone = "Asia/Kolkata"
): { hour: number; weekday: number } {
  if (timezone === "Asia/Kolkata") {
    const ist = new Date(date.getTime() + 330 * 60 * 1000);
    return {
      hour: ist.getUTCHours(),
      weekday: ist.getUTCDay(),
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(date);

    let hour = 0;
    let weekdayStr = "Sun";
    for (const part of parts) {
      if (part.type === "hour") hour = parseInt(part.value, 10);
      if (part.type === "weekday") weekdayStr = part.value;
    }
    const weekdayIdx = WEEKDAY_NAMES.indexOf(weekdayStr);
    return { hour, weekday: weekdayIdx >= 0 ? weekdayIdx : date.getUTCDay() };
  } catch {
    return {
      hour: date.getUTCHours(),
      weekday: date.getUTCDay(),
    };
  }
}

export class AnalyticsService {
  /**
   * Computes comprehensive live attendance analytics from the database.
   * Includes:
   * 1. Hourly check-in distribution for today (0-23)
   * 2. 30-day heatmap matrix by weekday and hour
   * 3. Live feed of recent scans with employee details
   * 4. Present / Late / Absent / Leave / WFH split
   * 5. Department breakdown with attendance and punctuality rates
   */
  public async getLiveAnalytics(
    query?: LiveAnalyticsQuery
  ): Promise<LiveAttendanceAnalyticsResponse> {
    const policy = await policyService.getActivePolicy();
    const timezone = policy.timezone || "Asia/Kolkata";
    const now = query?.simulatedNow ? new Date(query.simulatedNow) : new Date();
    const todayDateKey = query?.dateKey || getDateKey(now, timezone);

    // 1. Fetch active employees
    const employeeFilter: Record<string, unknown> = { isActive: true };
    if (query?.department) {
      employeeFilter.department = query.department;
    }

    const activeEmployees = await Employee.find(employeeFilter)
      .select("_id employeeId name department designation workType")
      .lean();

    const totalActive = activeEmployees.length;
    const activeEmpIdSet = new Set(activeEmployees.map((e) => e._id.toString()));
    const empByIdMap = new Map(activeEmployees.map((e) => [e._id.toString(), e]));
    const empByEmployeeIdMap = new Map(activeEmployees.map((e) => [e.employeeId, e]));

    // Unique departments
    const allDepartments = Array.from(
      new Set(activeEmployees.map((e) => e.department || "General"))
    ).sort();

    // 2. Fetch today's attendance records for active employees
    const todayRecords = await AttendanceRecord.find({
      dateKey: todayDateKey,
      employee: { $in: Array.from(activeEmpIdSet).map((id) => new Types.ObjectId(id)) },
    }).lean();

    // Map records by employee ID
    const todayRecordByEmpId = new Map(
      todayRecords.map((r) => [r.employee.toString(), r])
    );

    // 3. Query approved WFH and Leaves for today to ensure complete status coverage
    const [approvedWfhToday, approvedLeavesToday] = await Promise.all([
      WfhRequest.find({
        dateKey: todayDateKey,
        status: WfhStatus.APPROVED,
        employee: { $in: Array.from(activeEmpIdSet).map((id) => new Types.ObjectId(id)) },
      })
        .select("employee")
        .lean(),
      LeaveRequest.find({
        status: "APPROVED",
        startDate: { $lte: new Date(`${todayDateKey}T23:59:59.999Z`) },
        endDate: { $gte: new Date(`${todayDateKey}T00:00:00.000Z`) },
        employee: { $in: Array.from(activeEmpIdSet).map((id) => new Types.ObjectId(id)) },
      })
        .select("employee")
        .lean(),
    ]);

    const approvedWfhEmpIds = new Set(approvedWfhToday.map((w) => w.employee.toString()));
    const approvedLeaveEmpIds = new Set(approvedLeavesToday.map((l) => l.employee.toString()));

    // 4. Compute Status Split & Department Breakdown
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let wfhCount = 0;

    // Department accumulator map
    const deptStatsMap = new Map<
      string,
      {
        totalEmployees: number;
        present: number;
        late: number;
        absent: number;
        leave: number;
        wfh: number;
        notYetIn: number;
      }
    >();

    for (const dept of allDepartments) {
      deptStatsMap.set(dept, {
        totalEmployees: 0,
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        wfh: 0,
        notYetIn: 0,
      });
    }

    for (const emp of activeEmployees) {
      const empIdStr = emp._id.toString();
      const dept = emp.department || "General";
      const stats = deptStatsMap.get(dept);
      if (stats) stats.totalEmployees++;

      const rec = todayRecordByEmpId.get(empIdStr);

      if (rec) {
        if (rec.isWfh || rec.status === AttendanceStatus.WFH_APPROVED || approvedWfhEmpIds.has(empIdStr)) {
          wfhCount++;
          if (stats) stats.wfh++;
        } else if (rec.status === AttendanceStatus.ON_LEAVE || approvedLeaveEmpIds.has(empIdStr)) {
          leaveCount++;
          if (stats) stats.leave++;
        } else if (rec.status === AttendanceStatus.ABSENT) {
          absentCount++;
          if (stats) stats.absent++;
        } else if (
          rec.checkInTime !== null ||
          [
            AttendanceStatus.PRESENT,
            AttendanceStatus.LATE,
            AttendanceStatus.HALF_DAY,
            AttendanceStatus.CHECKED_OUT,
          ].includes(rec.status)
        ) {
          presentCount++;
          if (stats) stats.present++;

          if (rec.isLate || rec.status === AttendanceStatus.LATE) {
            lateCount++;
            if (stats) stats.late++;
          }
        } else {
          if (stats) stats.notYetIn++;
        }
      } else {
        // No attendance record created yet for today
        if (approvedWfhEmpIds.has(empIdStr)) {
          wfhCount++;
          if (stats) stats.wfh++;
        } else if (approvedLeaveEmpIds.has(empIdStr)) {
          leaveCount++;
          if (stats) stats.leave++;
        } else {
          if (stats) stats.notYetIn++;
        }
      }
    }

    const notYetCheckedIn = Math.max(0, totalActive - (presentCount + wfhCount + leaveCount + absentCount));

    const statusSplit: AttendanceStatusSplit = {
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      leave: leaveCount,
      wfh: wfhCount,
      notYetCheckedIn,
      totalActive,
      percentages: {
        present: totalActive > 0 ? Number(((presentCount / totalActive) * 100).toFixed(1)) : 0,
        late: totalActive > 0 ? Number(((lateCount / totalActive) * 100).toFixed(1)) : 0,
        absent: totalActive > 0 ? Number(((absentCount / totalActive) * 100).toFixed(1)) : 0,
        leave: totalActive > 0 ? Number(((leaveCount / totalActive) * 100).toFixed(1)) : 0,
        wfh: totalActive > 0 ? Number(((wfhCount / totalActive) * 100).toFixed(1)) : 0,
        notYetCheckedIn: totalActive > 0 ? Number(((notYetCheckedIn / totalActive) * 100).toFixed(1)) : 0,
      },
    };

    // Format department breakdown
    const departmentBreakdown: DepartmentAttendanceBreakdown[] = Array.from(deptStatsMap.entries()).map(
      ([deptName, s]) => {
        const attendanceRate =
          s.totalEmployees > 0
            ? Math.round(((s.present + s.wfh) / s.totalEmployees) * 100)
            : 0;
        const punctualityRate =
          s.present > 0 ? Math.round(((s.present - s.late) / s.present) * 100) : 100;

        return {
          department: deptName,
          totalEmployees: s.totalEmployees,
          present: s.present,
          late: s.late,
          absent: s.absent,
          leave: s.leave,
          wfh: s.wfh,
          notYetIn: s.notYetIn,
          attendanceRate,
          punctualityRate,
        };
      }
    );

    // 5. Hourly Check-In Distribution for Today (0-23 hours)
    const hourlyTodayMap = new Map<number, { checkIns: number; onTime: number; late: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyTodayMap.set(h, { checkIns: 0, onTime: 0, late: 0 });
    }

    for (const rec of todayRecords) {
      if (!rec.checkInTime) continue;
      const { hour } = getHourAndWeekdayInTimezone(new Date(rec.checkInTime), timezone);
      const entry = hourlyTodayMap.get(hour);
      if (entry) {
        entry.checkIns++;
        if (rec.isLate || rec.status === AttendanceStatus.LATE) {
          entry.late++;
        } else {
          entry.onTime++;
        }
      }
    }

    const hourlyToday: HourlyCheckInItem[] = Array.from(hourlyTodayMap.entries()).map(
      ([hour, data]) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        checkIns: data.checkIns,
        onTime: data.onTime,
        late: data.late,
      })
    );

    // 6. Last 30 Days Heatmap (by Weekday 0-6 and Hour 0-23)
    const earliestDateKey = addDaysToDateKey(todayDateKey, -29);
    const historicalScans = await AttendanceRecord.find({
      dateKey: { $gte: earliestDateKey, $lte: todayDateKey },
      checkInTime: { $ne: null },
      ...(query?.department ? { department: query.department } : {}),
    })
      .select("checkInTime")
      .lean();

    // 7 weekdays x 24 hours grid
    const heatmapGrid = new Map<string, number>();
    for (let w = 0; w < 7; w++) {
      for (let h = 0; h < 24; h++) {
        heatmapGrid.set(`${w}_${h}`, 0);
      }
    }

    let maxCellCount = 0;
    let peakCell: { weekdayName: string; hour: number; count: number } | undefined;

    for (const scan of historicalScans) {
      if (!scan.checkInTime) continue;
      const { hour, weekday } = getHourAndWeekdayInTimezone(new Date(scan.checkInTime), timezone);
      const key = `${weekday}_${hour}`;
      const current = (heatmapGrid.get(key) || 0) + 1;
      heatmapGrid.set(key, current);

      if (current > maxCellCount) {
        maxCellCount = current;
        peakCell = {
          weekdayName: WEEKDAY_NAMES[weekday],
          hour,
          count: current,
        };
      }
    }

    const heatmapCells: HeatmapCell[] = [];
    for (let w = 0; w < 7; w++) {
      for (let h = 0; h < 24; h++) {
        const count = heatmapGrid.get(`${w}_${h}`) || 0;
        let intensity = 0;
        if (maxCellCount > 0 && count > 0) {
          const ratio = count / maxCellCount;
          if (ratio <= 0.25) intensity = 1;
          else if (ratio <= 0.5) intensity = 2;
          else if (ratio <= 0.75) intensity = 3;
          else intensity = 4;
        }

        heatmapCells.push({
          weekday: w,
          weekdayName: WEEKDAY_NAMES[w],
          hour: h,
          count,
          intensity,
        });
      }
    }

    // 7. Live Feed of Recent Scans (Latest 20)
    const recentScanRecords = await AttendanceRecord.find({
      $or: [{ checkInTime: { $ne: null } }, { checkOutTime: { $ne: null } }],
      ...(query?.department ? { department: query.department } : {}),
    })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(20)
      .lean();

    const recentScans: LiveScanFeedItem[] = recentScanRecords.map((r) => {
      const emp =
        empByIdMap.get(r.employee.toString()) ||
        empByEmployeeIdMap.get(r.employeeId);

      const scanTime = r.checkOutTime || r.checkInTime || r.updatedAt || new Date();
      const punchType =
        r.checkOutTime && r.checkInTime && new Date(r.checkOutTime) >= new Date(r.checkInTime)
          ? "CHECK_OUT"
          : "CHECK_IN";

      return {
        id: r._id.toString(),
        employeeId: r.employeeId || emp?.employeeId || "UNKNOWN",
        employeeName: emp?.name || r.employeeId || "Employee",
        department: r.department || emp?.department || "General",
        designation: emp?.designation,
        scanTime: new Date(scanTime).toISOString(),
        punchType,
        status: r.status,
        isLate: !!r.isLate,
        lateMinutes: r.lateMinutes || 0,
        terminalId: r.terminalId || undefined,
      };
    });

    return {
      success: true,
      dateKey: todayDateKey,
      timezone,
      generatedAt: new Date().toISOString(),
      hourlyToday,
      heatmap30Days: {
        cells: heatmapCells,
        maxCount: maxCellCount,
        totalCheckIns: historicalScans.length,
        peakCell,
      },
      recentScans,
      statusSplit,
      departmentBreakdown,
    };
  }
}

export const analyticsService = new AnalyticsService();
