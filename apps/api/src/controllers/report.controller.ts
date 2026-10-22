import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as reportService from "../services/report.service";
import { sendCsvResponse } from "../utils/csv";
import { AttendanceStatus, ReportFilterQuery, WfhReportFilterQuery } from "@vorldx/shared";

function parseReportQuery(req: Request): ReportFilterQuery {
  return {
    startDate: (req.query.startDate || req.query.from) as string | undefined,
    endDate: (req.query.endDate || req.query.to) as string | undefined,
    dateKey: req.query.dateKey as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    department: req.query.department as string | undefined,
    employeeId: req.query.employeeId as string | undefined,
    employee: req.query.employee as string | undefined,
    status: req.query.status as AttendanceStatus | undefined,
    workType: req.query.workType as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    sortBy: req.query.sortBy as string | undefined,
    sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
    format: (req.query.format as "json" | "csv") || "json",
  };
}

/**
 * 1. Attendance Summary Report (JSON or CSV)
 */
export const getAttendanceSummaryReport = asyncHandler(async (req: Request, res: Response) => {
  const query = parseReportQuery(req);
  const isCsv = query.format === "csv" || req.path.endsWith("/export");

  if (isCsv) {
    // For CSV export, increase page limit to retrieve full dataset
    query.limit = 5000;
    const result = await reportService.getAttendanceSummaryReport(query);

    const headers = [
      "Date",
      "Employee ID",
      "Employee Name",
      "Department",
      "Check In",
      "Check Out",
      "Duration (Mins)",
      "Status",
      "Late",
      "WFH",
    ];

    const rows = result.data.map((r) => {
      const emp = r.employee as { name?: string } | null;
      return [
        r.dateKey,
        r.employeeId,
        emp?.name || "",
        r.department,
        r.checkInTime ? new Date(r.checkInTime).toISOString() : "",
        r.checkOutTime ? new Date(r.checkOutTime).toISOString() : "",
        r.durationMinutes || 0,
        r.status,
        r.isLate ? "YES" : "NO",
        r.isWfh ? "YES" : "NO",
      ];
    });

    await sendCsvResponse(
      res,
      `attendance_summary_${query.startDate || "all"}_${query.endDate || "all"}.csv`,
      headers,
      rows
    );
    return;
  }

  const result = await reportService.getAttendanceSummaryReport(query);
  res.status(200).json(result);
});

/**
 * 2. Employee-wise Attendance Report (JSON or CSV)
 */
export const getEmployeeWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const query = parseReportQuery(req);
  const isCsv = query.format === "csv" || req.path.endsWith("/export");

  if (isCsv) {
    query.limit = 5000;
    const result = await reportService.getEmployeeWiseReport(query);

    const headers = [
      "Employee ID",
      "Name",
      "Department",
      "Designation",
      "Work Type",
      "Total Days",
      "Present Days",
      "Late Days",
      "Half Days",
      "WFH Days",
      "Absent Days",
      "Total Work (Hours)",
      "Attendance Rate (%)",
    ];

    const rows = result.data.map((e) => [
      e.employeeId,
      e.name,
      e.department,
      e.designation || "",
      e.workType || "",
      e.totalDays,
      e.presentDays,
      e.lateDays,
      e.halfDays,
      e.wfhDays,
      e.absentDays,
      e.totalWorkHours,
      `${e.attendanceRate}%`,
    ]);

    await sendCsvResponse(
      res,
      `employee_wise_attendance_${query.startDate || "all"}_${query.endDate || "all"}.csv`,
      headers,
      rows
    );
    return;
  }

  const result = await reportService.getEmployeeWiseReport(query);
  res.status(200).json(result);
});

/**
 * 3. Department-wise Attendance Report (JSON or CSV)
 */
export const getDepartmentWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const query = parseReportQuery(req);
  const isCsv = query.format === "csv" || req.path.endsWith("/export");

  if (isCsv) {
    const result = await reportService.getDepartmentWiseReport(query);

    const headers = [
      "Department",
      "Headcount",
      "Total Records",
      "Present",
      "Late",
      "WFH",
      "Absent",
      "Total Work (Hours)",
      "Attendance Rate (%)",
    ];

    const rows = result.data.map((d) => [
      d.department,
      d.headcount,
      d.totalRecords,
      d.presentCount,
      d.lateCount,
      d.wfhCount,
      d.absentCount,
      d.totalWorkHours,
      `${d.attendanceRate}%`,
    ]);

    await sendCsvResponse(
      res,
      `department_wise_attendance_${query.startDate || "all"}_${query.endDate || "all"}.csv`,
      headers,
      rows
    );
    return;
  }

  const result = await reportService.getDepartmentWiseReport(query);
  res.status(200).json(result);
});

/**
 * 4. Late Arrivals Report (JSON or CSV)
 */
export const getLateReport = asyncHandler(async (req: Request, res: Response) => {
  const query = parseReportQuery(req);
  const isCsv = query.format === "csv" || req.path.endsWith("/export");

  if (isCsv) {
    query.limit = 5000;
    const result = await reportService.getLateReport(query);

    const headers = [
      "Date",
      "Employee ID",
      "Name",
      "Department",
      "Check In Time",
      "Late Minutes",
      "Status",
    ];

    const rows = result.data.map((l) => [
      l.dateKey,
      l.employeeId,
      l.name,
      l.department,
      l.checkInTime ? new Date(l.checkInTime).toISOString() : "",
      l.lateMinutes,
      l.status,
    ]);

    await sendCsvResponse(
      res,
      `late_arrivals_report_${query.startDate || "all"}_${query.endDate || "all"}.csv`,
      headers,
      rows
    );
    return;
  }

  const result = await reportService.getLateReport(query);
  res.status(200).json(result);
});

/**
 * 5. WFH Utilization Report (JSON or CSV)
 */
export const getWfhReport = asyncHandler(async (req: Request, res: Response) => {
  const query: WfhReportFilterQuery = {
    startDate: (req.query.startDate || req.query.from) as string | undefined,
    endDate: (req.query.endDate || req.query.to) as string | undefined,
    department: req.query.department as string | undefined,
    status: req.query.status as WfhReportFilterQuery["status"],
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    format: (req.query.format as "json" | "csv") || "json",
  };

  const isCsv = query.format === "csv" || req.path.endsWith("/export");

  if (isCsv) {
    query.limit = 5000;
    const result = await reportService.getWfhReport(query);

    const headers = [
      "Date",
      "Employee ID",
      "Name",
      "Department",
      "Status",
      "Reason",
      "Reviewed By",
      "Reviewer Remarks",
      "Reviewed At",
    ];

    const rows = result.data.map((w) => [
      w.dateKey,
      w.employeeId,
      w.name,
      w.department,
      w.status,
      w.reason,
      w.reviewedBy || "",
      w.reviewerRemarks || "",
      w.reviewedAt ? new Date(w.reviewedAt).toISOString() : "",
    ]);

    await sendCsvResponse(
      res,
      `wfh_utilization_report_${query.startDate || "all"}_${query.endDate || "all"}.csv`,
      headers,
      rows
    );
    return;
  }

  const result = await reportService.getWfhReport(query);
  res.status(200).json(result);
});
