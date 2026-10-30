import React, { useState } from "react";
import {
  useAttendanceSummaryReport,
  useEmployeeWiseReport,
  useDepartmentWiseReport,
  useLateReport,
  useWfhReport,
  downloadReportCsv,
  ReportFilterParams,
} from "../api/queries";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Printer,
  Download,
  Calendar,
  Users,
  Building,
  Clock,
  Home,
  Search,
  BarChart3,
  TrendingUp,
} from "lucide-react";

const DEPARTMENT_OPTIONS = [
  { value: "", label: "All Departments" },
  { value: "Engineering", label: "Engineering" },
  { value: "Product", label: "Product" },
  { value: "Operations", label: "Operations" },
  { value: "Marketing", label: "Marketing" },
  { value: "HR", label: "HR" },
];

type ReportTab = "summary" | "employee" | "department" | "late" | "wfh";

export const ReportsPage: React.FC = () => {
  const { toast } = useToast();

  // Date range defaults: current month
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const filterParams: ReportFilterParams = {
    startDate,
    endDate,
    department: department || undefined,
    search: search || undefined,
    page,
    limit: 15,
  };

  // Queries for each tab
  const { data: summaryData, isLoading: isSummaryLoading } = useAttendanceSummaryReport(
    activeTab === "summary" ? filterParams : { page: 1, limit: 1 }
  );

  const { data: employeeData, isLoading: isEmployeeLoading } = useEmployeeWiseReport(
    activeTab === "employee" ? filterParams : { page: 1, limit: 1 }
  );

  const { data: departmentData, isLoading: isDeptLoading } = useDepartmentWiseReport(
    activeTab === "department" ? filterParams : { page: 1, limit: 1 }
  );

  const { data: lateData, isLoading: isLateLoading } = useLateReport(
    activeTab === "late" ? filterParams : { page: 1, limit: 1 }
  );

  const { data: wfhData, isLoading: isWfhLoading } = useWfhReport(
    activeTab === "wfh" ? filterParams : { page: 1, limit: 1 }
  );

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const q = new URLSearchParams();
      if (startDate) q.set("startDate", startDate);
      if (endDate) q.set("endDate", endDate);
      if (department) q.set("department", department);
      if (search) q.set("search", search);

      let endpoint = `/api/reports/attendance/export?${q.toString()}`;
      let filename = `attendance_summary_${startDate}_to_${endDate}.csv`;

      if (activeTab === "employee") {
        endpoint = `/api/reports/employee-wise/export?${q.toString()}`;
        filename = `employee_wise_report_${startDate}_to_${endDate}.csv`;
      } else if (activeTab === "department") {
        endpoint = `/api/reports/department-wise/export?${q.toString()}`;
        filename = `department_wise_report_${startDate}_to_${endDate}.csv`;
      } else if (activeTab === "late") {
        endpoint = `/api/reports/late/export?${q.toString()}`;
        filename = `late_arrivals_report_${startDate}_to_${endDate}.csv`;
      } else if (activeTab === "wfh") {
        endpoint = `/api/reports/wfh/export?${q.toString()}`;
        filename = `wfh_utilization_report_${startDate}_to_${endDate}.csv`;
      }

      await downloadReportCsv(endpoint, filename);
      toast({
        title: "Report Exported",
        description: `CSV file '${filename}' downloaded successfully.`,
        type: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CSV export failed";
      toast({ title: "Export Failed", description: message, type: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const summary = summaryData?.summary;
  const summaryChartData = summary
    ? [
        { name: "Present", count: summary.presentCount, fill: "#22c55e" },
        { name: "Late", count: summary.lateCount, fill: "#f59e0b" },
        { name: "WFH", count: summary.wfhCount, fill: "#3b82f6" },
        { name: "Half Day", count: summary.halfDayCount, fill: "#8b5cf6" },
        { name: "Absent", count: summary.absentCount, fill: "#ef4444" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header & Actions (hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Reports & Analytics
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs font-semibold"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            Print Report
          </Button>

          <Button
            type="button"
            id="export-csv-btn"
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            isLoading={isExporting}
            className="gap-1.5 text-xs font-semibold shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Printable Title Header (only visible on print) */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-4">
        <h2 className="text-xl font-bold text-slate-900">VorldX Workforce Management Suite</h2>
        <p className="text-sm text-slate-600">
          Attendance Report ({startDate} to {endDate}) • Tab: {activeTab.toUpperCase()}
        </p>
      </div>

      {/* Global Filter Toolbar (hidden on print) */}
      <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs print:hidden space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Start Date */}
          <div>
            <label htmlFor="report-start-date-input" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              id="report-start-date-input"
              aria-label="Start Date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="report-end-date-input" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">End Date</label>
            <Input
              type="date"
              id="report-end-date-input"
              aria-label="End Date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            />
          </div>

          {/* Department Filter */}
          <div>
            <label id="report-dept-label" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Department
            </label>
            <Select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              aria-label="Filter report by department"
              options={DEPARTMENT_OPTIONS}
              className="text-xs"
            />
          </div>

          {/* Search */}
          <div>
            <label htmlFor="report-search-input" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Search Employee
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                id="report-search-input"
                aria-label="Search Employee"
                placeholder="Name or ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 text-xs"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Toolbar (hidden on print) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold print:hidden">
        <button
          type="button"
          onClick={() => {
            setActiveTab("summary");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === "summary"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Attendance Summary</span>
        </button>

        <button
          type="button"
          id="tab-employee-wise"
          onClick={() => {
            setActiveTab("employee");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === "employee"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Employee-Wise</span>
        </button>

        <button
          type="button"
          id="tab-department-wise"
          onClick={() => {
            setActiveTab("department");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === "department"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Department-Wise</span>
        </button>

        <button
          type="button"
          id="tab-late-arrivals"
          onClick={() => {
            setActiveTab("late");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === "late"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Late Arrivals</span>
        </button>

        <button
          type="button"
          id="tab-wfh-utilization"
          onClick={() => {
            setActiveTab("wfh");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
            activeTab === "wfh"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>WFH Utilization</span>
        </button>
      </div>

      {/* TAB 1: ATTENDANCE SUMMARY */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="p-3 text-center border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Total Records
                </span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100 block mt-1 font-mono">
                  {summary.totalRecords}
                </span>
              </Card>

              <Card className="p-3 text-center border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Present
                </span>
                <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 block mt-1 font-mono">
                  {summary.presentCount}
                </span>
              </Card>

              <Card className="p-3 text-center border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Late
                </span>
                <span className="text-xl font-extrabold text-amber-700 dark:text-amber-400 block mt-1 font-mono">
                  {summary.lateCount}
                </span>
              </Card>

              <Card className="p-3 text-center border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                  WFH
                </span>
                <span className="text-xl font-extrabold text-blue-700 dark:text-blue-400 block mt-1 font-mono">
                  {summary.wfhCount}
                </span>
              </Card>

              <Card className="p-3 text-center border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                  Absent
                </span>
                <span className="text-xl font-extrabold text-red-700 dark:text-red-400 block mt-1 font-mono">
                  {summary.absentCount}
                </span>
              </Card>

              <Card className="p-3 text-center border-slate-200 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Total Hours
                </span>
                <span className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400 block mt-1 font-mono">
                  {summary.totalHours}h
                </span>
              </Card>
            </div>
          )}

          {/* Real Report Bar Chart */}
          <Card className="p-5 border-slate-200 dark:border-slate-800 shadow-sm space-y-3 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Attendance Status Distribution ({startDate} to {endDate})
              </h3>
            </div>

            <div className="h-64 w-full pt-2">
              {isSummaryLoading ? (
                <Skeleton className="h-full w-full" />
              ) : summaryChartData.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="w-6 h-6 text-slate-400" />}
                  title="No Chart Data"
                  description="No punches recorded for this date range."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        fontSize: "12px",
                        backgroundColor: "#0f172a",
                        borderColor: "#1e293b",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Breakdown Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200">
              Detailed Attendance Ledger ({summaryData?.data?.length || 0} Records)
            </div>

            {isSummaryLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (summaryData?.data || []).length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-6 h-6 text-slate-400" />}
                title="No Records Found"
                description="No attendance events match the date range and filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Check In</th>
                      <th className="py-2.5 px-3">Check Out</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(summaryData?.data || []).map((r) => {
                      const emp = typeof r.employee === "object" && r.employee !== null ? r.employee : null;
                      return (
                        <tr key={r._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 font-semibold">{r.dateKey}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">{emp?.name || r.employeeId}</span>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{r.employeeId}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{r.department}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {r.durationMinutes ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m` : "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={
                                r.status === "PRESENT"
                                  ? "success"
                                  : r.status === "LATE"
                                  ? "warning"
                                  : r.status === "WFH_APPROVED"
                                  ? "primary"
                                  : "danger"
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: EMPLOYEE-WISE REPORT */}
      {activeTab === "employee" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>Employee Attendance Aggregation</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
              {employeeData?.pagination.total || 0} active employees evaluated
            </span>
          </div>

          {isEmployeeLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (employeeData?.data || []).length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6 text-slate-400" />}
              title="No Employee Records Found"
              description="No active employees match the search and department filter."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Total Days</th>
                    <th className="py-2.5 px-3 text-center">Present</th>
                    <th className="py-2.5 px-3 text-center">Late</th>
                    <th className="py-2.5 px-3 text-center">WFH</th>
                    <th className="py-2.5 px-3 text-center">Absent</th>
                    <th className="py-2.5 px-3 text-center">Total Hours</th>
                    <th className="py-2.5 px-3 text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeeData!.data.map((row) => (
                    <tr key={row.employeeId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">{row.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{row.employeeId}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{row.department}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-800 dark:text-slate-200">{row.totalDays}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{row.presentDays}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">{row.lateDays}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-blue-600 dark:text-blue-400">{row.wfhDays}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-red-600 dark:text-red-400">{row.absentDays}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{row.totalWorkHours}h</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge
                          variant={
                            row.attendanceRate >= 85
                              ? "success"
                              : row.attendanceRate >= 65
                              ? "warning"
                              : "danger"
                          }
                        >
                          {row.attendanceRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: DEPARTMENT-WISE REPORT */}
      {activeTab === "department" && (
        <div className="space-y-6">
          {/* Department Performance Bar Chart */}
          <Card className="p-5 border-slate-200 dark:border-slate-800 shadow-sm space-y-3 bg-white dark:bg-slate-900">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Building className="w-4 h-4 text-blue-600" />
              Department Attendance Rate (%)
            </h3>

            <div className="h-64 w-full pt-2">
              {isDeptLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (departmentData?.data || []).length === 0 ? (
                <EmptyState
                  icon={<Building className="w-6 h-6 text-slate-400" />}
                  title="No Department Data"
                  description="No departmental records found."
                />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData!.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="department" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        fontSize: "12px",
                        backgroundColor: "#0f172a",
                        borderColor: "#1e293b",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="attendanceRate" name="Attendance Rate %" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Department Breakdown Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Headcount</th>
                    <th className="py-2.5 px-3 text-center">Total Logs</th>
                    <th className="py-2.5 px-3 text-center">Present</th>
                    <th className="py-2.5 px-3 text-center">Late</th>
                    <th className="py-2.5 px-3 text-center">WFH</th>
                    <th className="py-2.5 px-3 text-center">Total Hours</th>
                    <th className="py-2.5 px-3 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(departmentData?.data || []).map((row) => (
                    <tr key={row.department} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{row.department}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-800 dark:text-slate-200">{row.headcount}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-800 dark:text-slate-200">{row.totalRecords}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{row.presentCount}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">{row.lateCount}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-blue-600 dark:text-blue-400">{row.wfhCount}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100">{row.totalWorkHours}h</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge
                          variant={
                            row.attendanceRate >= 80
                              ? "success"
                              : row.attendanceRate >= 60
                              ? "warning"
                              : "danger"
                          }
                        >
                          {row.attendanceRate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: LATE ARRIVALS BREAKDOWN */}
      {activeTab === "late" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200">
            Punctuality Violations & Late Arrivals Ledger
          </div>

          {isLateLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (lateData?.data || []).length === 0 ? (
            <EmptyState
              icon={<Clock className="w-6 h-6 text-slate-400" />}
              title="Zero Late Arrivals"
              description="No punctuality infractions recorded for this period."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Check In Time</th>
                    <th className="py-2.5 px-3">Delay (Minutes)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lateData!.data.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 font-semibold">{row.dateKey}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">{row.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{row.employeeId}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{row.department}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200">
                        {row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded text-[11px]">
                          +{row.lateMinutes} mins
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="warning">{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: WFH UTILIZATION REPORT */}
      {activeTab === "wfh" && (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200">
            Remote Work (WFH) Utilization & Decisions
          </div>

          {isWfhLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (wfhData?.data || []).length === 0 ? (
            <EmptyState
              icon={<Home className="w-6 h-6 text-slate-400" />}
              title="No Remote Work Requests"
              description="No WFH applications recorded in this date range."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                    <th className="py-2.5 px-3">Target Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Reviewer Remarks</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {wfhData!.data.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 font-semibold">{row.dateKey}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">{row.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{row.employeeId}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{row.department}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={row.reason}>
                        {row.reason}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 italic text-[11px]">
                        {row.reviewerRemarks || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={
                            row.status === "APPROVED"
                              ? "success"
                              : row.status === "REJECTED"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
