import { Types } from "mongoose";
import { AttendanceRecord, IAttendanceRecord, Employee, WfhRequest } from "../models";
import { AttendanceStatus, ReportFilterQuery, WfhReportFilterQuery } from "@vorldx/shared";

export interface PaginatedResult<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 1. Attendance Summary Report by Date Range
 */
export async function getAttendanceSummaryReport(
  query: ReportFilterQuery
): Promise<PaginatedResult<IAttendanceRecord> & { summary: Record<string, number> }> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(500, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  const startDate = query.startDate || query.from;
  const endDate = query.endDate || query.to;

  if (startDate && endDate) {
    filter.dateKey = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.dateKey = { $gte: startDate };
  } else if (endDate) {
    filter.dateKey = { $lte: endDate };
  } else if (query.dateKey) {
    filter.dateKey = query.dateKey;
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.status) {
    filter.status = query.status;
  }

  const empTarget = query.employeeId || query.employee;
  if (empTarget) {
    if (Types.ObjectId.isValid(empTarget)) {
      filter.$or = [{ employee: new Types.ObjectId(empTarget) }, { employeeId: empTarget }];
    } else {
      filter.employeeId = empTarget.trim().toUpperCase();
    }
  }

  if (query.search && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    const matchingEmployees = await Employee.find({
      $or: [{ name: searchRegex }, { employeeId: searchRegex }, { department: searchRegex }],
    }).select("_id");
    const empIds = matchingEmployees.map((e) => e._id);

    filter.$or = [
      { employee: { $in: empIds } },
      { employeeId: searchRegex },
      { department: searchRegex },
    ];
  }

  const [records, total, allFiltered] = await Promise.all([
    AttendanceRecord.find(filter)
      .populate("employee", "name email department designation workType")
      .sort({ dateKey: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AttendanceRecord.countDocuments(filter),
    AttendanceRecord.find(filter).select("status isLate isWfh durationMinutes"),
  ]);

  let presentCount = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let wfhCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let totalMinutes = 0;

  for (const r of allFiltered) {
    if (r.isLate || r.status === AttendanceStatus.LATE) lateCount++;
    if (r.status === AttendanceStatus.HALF_DAY) halfDayCount++;
    if (r.isWfh || r.status === AttendanceStatus.WFH_APPROVED) wfhCount++;
    if (r.status === AttendanceStatus.ABSENT) absentCount++;
    if (r.status === AttendanceStatus.ON_LEAVE) leaveCount++;
    if (
      [
        AttendanceStatus.PRESENT,
        AttendanceStatus.LATE,
        AttendanceStatus.HALF_DAY,
        AttendanceStatus.CHECKED_OUT,
      ].includes(r.status)
    ) {
      presentCount++;
    }
    totalMinutes += r.durationMinutes || 0;
  }

  return {
    success: true,
    data: records,
    summary: {
      totalRecords: total,
      presentCount,
      lateCount,
      halfDayCount,
      wfhCount,
      absentCount,
      leaveCount,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * 2. Employee-wise Attendance Aggregation Report
 */
export async function getEmployeeWiseReport(query: ReportFilterQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(500, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  // Build employee filter
  const empFilter: Record<string, unknown> = { isActive: true };
  if (query.department) {
    empFilter.department = query.department;
  }
  if (query.workType) {
    empFilter.workType = query.workType;
  }
  if (query.search && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    empFilter.$or = [
      { name: searchRegex },
      { employeeId: searchRegex },
      { department: searchRegex },
    ];
  }

  const [employees, totalEmployees] = await Promise.all([
    Employee.find(empFilter).sort({ employeeId: 1 }).skip(skip).limit(limit),
    Employee.countDocuments(empFilter),
  ]);

  const empIds = employees.map((e) => e._id);

  // Build attendance filter for date range
  const recordFilter: Record<string, unknown> = { employee: { $in: empIds } };
  const startDate = query.startDate || query.from;
  const endDate = query.endDate || query.to;

  if (startDate && endDate) {
    recordFilter.dateKey = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    recordFilter.dateKey = { $gte: startDate };
  } else if (endDate) {
    recordFilter.dateKey = { $lte: endDate };
  }

  const records = await AttendanceRecord.find(recordFilter);

  // Group records by employeeId
  const recordsByEmpId = new Map<string, typeof records>();
  for (const r of records) {
    const k = r.employee.toString();
    if (!recordsByEmpId.has(k)) recordsByEmpId.set(k, []);
    recordsByEmpId.get(k)!.push(r);
  }

  const data = employees.map((emp) => {
    const empRecords = recordsByEmpId.get(emp._id.toString()) || [];
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let wfhDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let totalWorkMinutes = 0;

    for (const r of empRecords) {
      if (r.isLate || r.status === AttendanceStatus.LATE) lateDays++;
      if (r.status === AttendanceStatus.HALF_DAY) halfDays++;
      if (r.isWfh || r.status === AttendanceStatus.WFH_APPROVED) wfhDays++;
      if (r.status === AttendanceStatus.ABSENT) absentDays++;
      if (r.status === AttendanceStatus.ON_LEAVE) leaveDays++;
      if (
        [
          AttendanceStatus.PRESENT,
          AttendanceStatus.LATE,
          AttendanceStatus.HALF_DAY,
          AttendanceStatus.CHECKED_OUT,
        ].includes(r.status)
      ) {
        presentDays++;
      }
      totalWorkMinutes += r.durationMinutes || 0;
    }

    const totalDays = empRecords.length;
    const attendanceRate =
      totalDays > 0 ? Math.round(((presentDays + wfhDays) / totalDays) * 100) : 0;

    return {
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department,
      designation: emp.designation,
      workType: emp.workType,
      totalDays,
      presentDays,
      lateDays,
      halfDays,
      wfhDays,
      absentDays,
      leaveDays,
      totalWorkMinutes,
      totalWorkHours: Math.round((totalWorkMinutes / 60) * 10) / 10,
      attendanceRate,
    };
  });

  return {
    success: true,
    data,
    pagination: {
      total: totalEmployees,
      page,
      limit,
      totalPages: Math.ceil(totalEmployees / limit) || 1,
    },
  };
}

/**
 * 3. Department-wise Attendance Aggregation Report
 */
export async function getDepartmentWiseReport(query: ReportFilterQuery) {
  // Aggregate departments from Employee roster
  const allEmployees = await Employee.find({ isActive: true }).select("department");
  const deptHeadcounts = new Map<string, number>();

  for (const emp of allEmployees) {
    const d = emp.department || "General";
    deptHeadcounts.set(d, (deptHeadcounts.get(d) || 0) + 1);
  }

  // Filter attendance records by date range
  const recordFilter: Record<string, unknown> = {};
  const startDate = query.startDate || query.from;
  const endDate = query.endDate || query.to;

  if (startDate && endDate) {
    recordFilter.dateKey = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    recordFilter.dateKey = { $gte: startDate };
  } else if (endDate) {
    recordFilter.dateKey = { $lte: endDate };
  }

  if (query.department) {
    recordFilter.department = query.department;
  }

  const records = await AttendanceRecord.find(recordFilter);

  // Group records by department
  const recordsByDept = new Map<string, typeof records>();
  for (const r of records) {
    const d = r.department || "General";
    if (!recordsByDept.has(d)) recordsByDept.set(d, []);
    recordsByDept.get(d)!.push(r);
  }

  const departments = query.department
    ? [query.department]
    : Array.from(deptHeadcounts.keys()).sort();

  const data = departments.map((dept) => {
    const deptRecords = recordsByDept.get(dept) || [];
    const headcount = deptHeadcounts.get(dept) || 0;

    let presentCount = 0;
    let lateCount = 0;
    let wfhCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let totalWorkMinutes = 0;

    for (const r of deptRecords) {
      if (r.isLate || r.status === AttendanceStatus.LATE) lateCount++;
      if (r.isWfh || r.status === AttendanceStatus.WFH_APPROVED) wfhCount++;
      if (r.status === AttendanceStatus.ABSENT) absentCount++;
      if (r.status === AttendanceStatus.ON_LEAVE) leaveCount++;
      if (
        [
          AttendanceStatus.PRESENT,
          AttendanceStatus.LATE,
          AttendanceStatus.HALF_DAY,
          AttendanceStatus.CHECKED_OUT,
        ].includes(r.status)
      ) {
        presentCount++;
      }
      totalWorkMinutes += r.durationMinutes || 0;
    }

    const totalRecords = deptRecords.length;
    const attendanceRate =
      totalRecords > 0 ? Math.round(((presentCount + wfhCount) / totalRecords) * 100) : 0;

    return {
      department: dept,
      headcount,
      totalRecords,
      presentCount,
      lateCount,
      wfhCount,
      absentCount,
      leaveCount,
      totalWorkMinutes,
      totalWorkHours: Math.round((totalWorkMinutes / 60) * 10) / 10,
      attendanceRate,
    };
  });

  return {
    success: true,
    data,
    pagination: {
      total: departments.length,
      page: 1,
      limit: departments.length,
      totalPages: 1,
    },
  };
}

/**
 * 4. Late Arrivals Breakdown Report
 */
export async function getLateReport(query: ReportFilterQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(500, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    $or: [{ isLate: true }, { status: AttendanceStatus.LATE }],
  };

  const startDate = query.startDate || query.from;
  const endDate = query.endDate || query.to;

  if (startDate && endDate) {
    filter.dateKey = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    filter.dateKey = { $gte: startDate };
  } else if (endDate) {
    filter.dateKey = { $lte: endDate };
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.employeeId) {
    filter.employeeId = query.employeeId.trim().toUpperCase();
  }

  const [records, total] = await Promise.all([
    AttendanceRecord.find(filter)
      .populate("employee", "name email department designation")
      .sort({ dateKey: -1, checkInTime: -1 })
      .skip(skip)
      .limit(limit),
    AttendanceRecord.countDocuments(filter),
  ]);

  const data = records.map((r) => {
    const emp = r.employee as { name?: string; designation?: string } | null;
    return {
      _id: r._id,
      dateKey: r.dateKey,
      employeeId: r.employeeId,
      name: emp?.name || "Unknown",
      department: r.department,
      designation: emp?.designation,
      checkInTime: r.checkInTime,
      lateMinutes: r.lateMinutes || 0,
      status: r.status,
    };
  });

  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * 5. Work From Home (WFH) Utilization Report
 */
export async function getWfhReport(query: WfhReportFilterQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(500, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (query.startDate && query.endDate) {
    filter.dateKey = { $gte: query.startDate, $lte: query.endDate };
  } else if (query.startDate) {
    filter.dateKey = { $gte: query.startDate };
  } else if (query.endDate) {
    filter.dateKey = { $lte: query.endDate };
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.status && query.status !== "ALL") {
    filter.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { employeeId: searchRegex },
      { department: searchRegex },
      { reason: searchRegex },
    ];
  }

  const [requests, total] = await Promise.all([
    WfhRequest.find(filter)
      .populate("employee", "name email department designation")
      .populate("reviewedBy", "email employeeId")
      .sort({ dateKey: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WfhRequest.countDocuments(filter),
  ]);

  const data = requests.map((req) => {
    const emp = req.employee as { name?: string } | null;
    const reviewer = req.reviewedBy as { email?: string; employeeId?: string } | null;
    return {
      _id: req._id,
      dateKey: req.dateKey,
      employeeId: req.employeeId,
      name: emp?.name || "Unknown",
      department: req.department,
      status: req.status,
      reason: req.reason,
      reviewerRemarks: req.reviewerRemarks || null,
      reviewedBy: reviewer?.email || reviewer?.employeeId || null,
      reviewedAt: req.reviewedAt || null,
      createdAt: req.createdAt,
    };
  });

  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
