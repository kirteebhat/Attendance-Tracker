import { Employee, AttendanceRecord, WfhRequest, AuditEvent } from "../models";
import { policyService } from "./policy.service";
import { AttendanceStatus, WfhStatus, getDateKey, addDaysToDateKey } from "@vorldx/shared";

export interface DashboardDayTrend {
  dateKey: string;
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  wfhCount: number;
  absentCount: number;
  attendanceRate: number;
}

export interface DashboardSummaryResult {
  success: boolean;
  dateKey: string;
  summary: {
    totalActiveEmployees: number;
    presentToday: number;
    lateToday: number;
    wfhToday: number;
    notYetCheckedInToday: number;
    pendingWfhRequests: number;
    attendanceRate: number;
  };
  trends: {
    last7Days: DashboardDayTrend[];
    last30Days: DashboardDayTrend[];
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    performedByEmployeeId?: string;
    reason?: string;
    timestamp: Date;
    details?: unknown;
  }>;
}

/**
 * Computes executive dashboard metrics, daily breakdown, 7/30-day trends,
 * and recent audit activity directly from the database using state machine definitions.
 */
export async function getDashboardSummary(options?: {
  dateKey?: string;
  simulatedNow?: string;
}): Promise<DashboardSummaryResult> {
  const policy = await policyService.getActivePolicy();
  const timezone = policy.timezone || "Asia/Kolkata";
  const now = options?.simulatedNow ? new Date(options.simulatedNow) : new Date();
  const todayDateKey = options?.dateKey || getDateKey(now, timezone);

  // 1. Active employee headcount
  const activeEmployees = await Employee.find({ isActive: true }).select("_id employeeId");
  const totalActiveEmployees = activeEmployees.length;
  const activeEmpIdSet = new Set(activeEmployees.map((e) => e._id.toString()));

  // 2. Today's attendance records
  const todayRecords = await AttendanceRecord.find({
    dateKey: todayDateKey,
    employee: { $in: Array.from(activeEmpIdSet) },
  });

  let presentToday = 0;
  let lateToday = 0;
  let wfhToday = 0;
  const punchedOrWfhEmpIds = new Set<string>();

  for (const record of todayRecords) {
    punchedOrWfhEmpIds.add(record.employee.toString());

    if (record.isWfh || record.status === AttendanceStatus.WFH_APPROVED) {
      wfhToday++;
    } else if (
      record.checkInTime !== null ||
      [
        AttendanceStatus.PRESENT,
        AttendanceStatus.LATE,
        AttendanceStatus.HALF_DAY,
        AttendanceStatus.CHECKED_OUT,
      ].includes(record.status)
    ) {
      presentToday++;
    }

    if (record.isLate || record.status === AttendanceStatus.LATE) {
      lateToday++;
    }
  }

  // Active employees who have not punched or had WFH approved today
  const notYetCheckedInToday = Math.max(0, totalActiveEmployees - punchedOrWfhEmpIds.size);

  // 3. Pending WFH requests awaiting HR decision
  const pendingWfhRequests = await WfhRequest.countDocuments({
    status: WfhStatus.PENDING,
  });

  // Overall attendance rate for today
  const attendanceRate =
    totalActiveEmployees > 0
      ? Math.round(((presentToday + wfhToday) / totalActiveEmployees) * 100)
      : 0;

  // 4. Compute 7-day and 30-day trend series
  const last7DaysDateKeys = generatePastDateKeys(todayDateKey, 7);
  const last30DaysDateKeys = generatePastDateKeys(todayDateKey, 30);

  // Retrieve past records in bulk for the 30-day window
  const earliestDateKey = last30DaysDateKeys[0];
  const historicalRecords = await AttendanceRecord.find({
    dateKey: { $gte: earliestDateKey, $lte: todayDateKey },
    employee: { $in: Array.from(activeEmpIdSet) },
  });

  // Group historical records by dateKey
  const recordsByDateKey = new Map<string, typeof historicalRecords>();
  for (const r of historicalRecords) {
    if (!recordsByDateKey.has(r.dateKey)) {
      recordsByDateKey.set(r.dateKey, []);
    }
    recordsByDateKey.get(r.dateKey)!.push(r);
  }

  const computeDayTrend = (dateKey: string): DashboardDayTrend => {
    const records = recordsByDateKey.get(dateKey) || [];
    let presentCount = 0;
    let lateCount = 0;
    let wfhCount = 0;
    let absentCount = 0;

    for (const r of records) {
      if (r.isWfh || r.status === AttendanceStatus.WFH_APPROVED) {
        wfhCount++;
      } else if (
        r.checkInTime !== null ||
        [
          AttendanceStatus.PRESENT,
          AttendanceStatus.LATE,
          AttendanceStatus.HALF_DAY,
          AttendanceStatus.CHECKED_OUT,
        ].includes(r.status)
      ) {
        presentCount++;
      }

      if (r.isLate || r.status === AttendanceStatus.LATE) {
        lateCount++;
      }

      if (r.status === AttendanceStatus.ABSENT) {
        absentCount++;
      }
    }

    const rate =
      totalActiveEmployees > 0
        ? Math.round(((presentCount + wfhCount) / totalActiveEmployees) * 100)
        : 0;

    return {
      dateKey,
      totalEmployees: totalActiveEmployees,
      presentCount,
      lateCount,
      wfhCount,
      absentCount,
      attendanceRate: rate,
    };
  };

  const last7Days = last7DaysDateKeys.map(computeDayTrend);
  const last30Days = last30DaysDateKeys.map(computeDayTrend);

  // 5. Recent audit log activity
  const recentEvents = await AuditEvent.find({}).sort({ timestamp: -1 }).limit(15);

  const recentActivity = recentEvents.map((evt) => ({
    id: evt._id.toString(),
    action: evt.action,
    entityType: evt.entityType,
    entityId: evt.entityId,
    performedByEmployeeId: evt.performedByEmployeeId || undefined,
    reason: evt.reason || undefined,
    timestamp: evt.timestamp,
    details: evt.newValue || evt.metadata || undefined,
  }));

  return {
    success: true,
    dateKey: todayDateKey,
    summary: {
      totalActiveEmployees,
      presentToday,
      lateToday,
      wfhToday,
      notYetCheckedInToday,
      pendingWfhRequests,
      attendanceRate,
    },
    trends: {
      last7Days,
      last30Days,
    },
    recentActivity,
  };
}

/**
 * Generates an array of dateKey strings spanning back `count` days ending at `endDateKey`
 */
function generatePastDateKeys(endDateKey: string, count: number): string[] {
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(addDaysToDateKey(endDateKey, -i));
  }
  return result;
}

export const dashboardService = {
  getDashboardSummary,
};
