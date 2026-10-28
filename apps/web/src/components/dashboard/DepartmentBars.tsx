import React, { useState } from "react";
import { Building2, ArrowUpDown, Check, Users } from "lucide-react";
import { DepartmentAttendanceBreakdown } from "@vorldx/shared";
import { Tooltip } from "../ui/Tooltip";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface DepartmentBarsProps {
  departments: DepartmentAttendanceBreakdown[];
}

export const DepartmentBars: React.FC<DepartmentBarsProps> = ({ departments = [] }) => {
  const [sortBy, setSortBy] = useState<"rate" | "headcount" | "name">("rate");

  const sortedDepts = [...departments].sort((a, b) => {
    if (sortBy === "rate") return b.attendanceRate - a.attendanceRate;
    if (sortBy === "headcount") return b.totalEmployees - a.totalEmployees;
    return a.department.localeCompare(b.department);
  });

  return (
    <Card className="p-5 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Department Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Attendance compliance and punctuality breakdown by business unit
              </p>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 flex items-center gap-1 mr-1">
              <ArrowUpDown className="w-3 h-3" />
              Sort:
            </span>
            <button
              onClick={() => setSortBy("rate")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                sortBy === "rate"
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Attendance %
            </button>
            <button
              onClick={() => setSortBy("headcount")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                sortBy === "headcount"
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Staff Count
            </button>
            <button
              onClick={() => setSortBy("name")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                sortBy === "name"
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Name
            </button>
          </div>
        </div>

        {/* Department List */}
        <div className="space-y-4 mt-2">
          {sortedDepts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No department data available for today.
            </div>
          ) : (
            sortedDepts.map((dept) => {
              const presentPercent =
                dept.totalEmployees > 0 ? (dept.present / dept.totalEmployees) * 100 : 0;
              const wfhPercent =
                dept.totalEmployees > 0 ? (dept.wfh / dept.totalEmployees) * 100 : 0;
              const leavePercent =
                dept.totalEmployees > 0 ? (dept.leave / dept.totalEmployees) * 100 : 0;
              const absentPercent =
                dept.totalEmployees > 0 ? (dept.absent / dept.totalEmployees) * 100 : 0;

              return (
                <div key={dept.department} className="space-y-1.5">
                  {/* Row Header */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {dept.department}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {dept.totalEmployees} staff
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Punctuality:{" "}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {dept.punctualityRate}%
                        </strong>
                      </span>
                      <Badge
                        variant={
                          dept.attendanceRate >= 80
                            ? "success"
                            : dept.attendanceRate >= 60
                            ? "warning"
                            : "danger"
                        }
                        size="sm"
                      >
                        {dept.attendanceRate}% Attendance
                      </Badge>
                    </div>
                  </div>

                  {/* Multi-segment Progress Bar with Tooltip */}
                  <Tooltip
                    content={
                      <div className="text-left space-y-1">
                        <div className="font-bold border-b border-slate-700 pb-0.5">
                          {dept.department} ({dept.totalEmployees} total)
                        </div>
                        <div className="text-[11px] space-y-0.5">
                          <div className="flex justify-between gap-4 text-emerald-400">
                            <span>Present:</span>
                            <span className="font-semibold">{dept.present}</span>
                          </div>
                          {dept.late > 0 && (
                            <div className="flex justify-between gap-4 text-amber-400 pl-2">
                              <span>↳ Late Arrivals:</span>
                              <span className="font-semibold">{dept.late}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4 text-indigo-400">
                            <span>Approved WFH:</span>
                            <span className="font-semibold">{dept.wfh}</span>
                          </div>
                          <div className="flex justify-between gap-4 text-purple-400">
                            <span>On Leave:</span>
                            <span className="font-semibold">{dept.leave}</span>
                          </div>
                          <div className="flex justify-between gap-4 text-rose-400">
                            <span>Absent:</span>
                            <span className="font-semibold">{dept.absent}</span>
                          </div>
                          <div className="flex justify-between gap-4 text-slate-400">
                            <span>Awaiting Scan:</span>
                            <span className="font-semibold">{dept.notYetIn}</span>
                          </div>
                        </div>
                      </div>
                    }
                    position="top"
                    className="w-full block"
                  >
                    <div
                      className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex cursor-pointer transition-all hover:ring-2 hover:ring-blue-400/50"
                      role="progressbar"
                      aria-valuenow={dept.attendanceRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${dept.department}: ${dept.attendanceRate}% attendance rate`}
                    >
                      {/* Present (Emerald) */}
                      <div
                        className="bg-emerald-500 h-full transition-all duration-700 ease-out"
                        style={{ width: `${presentPercent}%` }}
                      />
                      {/* WFH (Indigo) */}
                      <div
                        className="bg-indigo-500 h-full transition-all duration-700 ease-out"
                        style={{ width: `${wfhPercent}%` }}
                      />
                      {/* Leave (Purple) */}
                      <div
                        className="bg-purple-500 h-full transition-all duration-700 ease-out"
                        style={{ width: `${leavePercent}%` }}
                      />
                      {/* Absent (Rose) */}
                      <div
                        className="bg-rose-500 h-full transition-all duration-700 ease-out"
                        style={{ width: `${absentPercent}%` }}
                      />
                    </div>
                  </Tooltip>
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Present</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>WFH</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Leave</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Absent</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Total Units: {sortedDepts.length}</span>
        </div>
      </div>

      {/* Screen Reader Alternative */}
      <div className="sr-only">
        <table>
          <caption>Department Attendance Compliance Summary</caption>
          <thead>
            <tr>
              <th scope="col">Department</th>
              <th scope="col">Staff</th>
              <th scope="col">Present</th>
              <th scope="col">WFH</th>
              <th scope="col">Leave</th>
              <th scope="col">Absent</th>
              <th scope="col">Attendance Rate</th>
              <th scope="col">Punctuality Rate</th>
            </tr>
          </thead>
          <tbody>
            {sortedDepts.map((d) => (
              <tr key={d.department}>
                <td>{d.department}</td>
                <td>{d.totalEmployees}</td>
                <td>{d.present}</td>
                <td>{d.wfh}</td>
                <td>{d.leave}</td>
                <td>{d.absent}</td>
                <td>{d.attendanceRate}%</td>
                <td>{d.punctualityRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
