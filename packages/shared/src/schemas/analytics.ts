import { z } from "zod";
import { AttendanceStatus } from "../constants/enums";

export const LiveAnalyticsQuerySchema = z.object({
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateKey must be YYYY-MM-DD")
    .optional(),
  simulatedNow: z.string().optional(),
  department: z.string().trim().optional(),
});

export type LiveAnalyticsQuery = z.infer<typeof LiveAnalyticsQuerySchema>;

export interface HourlyCheckInItem {
  hour: number; // 0..23
  label: string; // "00:00", "01:00", ... "23:00"
  checkIns: number;
  onTime: number;
  late: number;
}

export interface HeatmapCell {
  weekday: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  weekdayName: string; // "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
  hour: number; // 0..23
  count: number;
  intensity: number; // 0..4
}

export interface LiveScanFeedItem {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation?: string;
  photoUrl?: string;
  scanTime: string; // ISO string
  punchType: "CHECK_IN" | "CHECK_OUT" | "PUNCH" | "CORRECTION" | "WFH_AUTO_CREDIT" | "ABSENT" | "INCOMPLETE";
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  terminalId?: string;
}

export interface AttendanceStatusSplit {
  present: number;
  late: number;
  absent: number;
  leave: number;
  wfh: number;
  notYetCheckedIn: number;
  totalActive: number;
  percentages: {
    present: number;
    late: number;
    absent: number;
    leave: number;
    wfh: number;
    notYetCheckedIn: number;
  };
}

export interface DepartmentAttendanceBreakdown {
  department: string;
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  wfh: number;
  notYetIn: number;
  attendanceRate: number; // 0..100
  punctualityRate: number; // 0..100
}

export interface LiveAttendanceAnalyticsResponse {
  success: boolean;
  dateKey: string;
  timezone: string;
  generatedAt: string;
  hourlyToday: HourlyCheckInItem[];
  heatmap30Days: {
    cells: HeatmapCell[];
    maxCount: number;
    totalCheckIns: number;
    peakCell?: { weekdayName: string; hour: number; count: number };
  };
  recentScans: LiveScanFeedItem[];
  statusSplit: AttendanceStatusSplit;
  departmentBreakdown: DepartmentAttendanceBreakdown[];
}
