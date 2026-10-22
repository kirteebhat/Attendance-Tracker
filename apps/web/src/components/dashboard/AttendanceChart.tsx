import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { DashboardDayTrend } from "../../api/queries";

interface AttendanceChartProps {
  last7Days: DashboardDayTrend[];
  last30Days: DashboardDayTrend[];
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({ last7Days, last30Days }) => {
  const [period, setPeriod] = useState<"7d" | "30d">("7d");

  const data = period === "7d" ? last7Days : last30Days;

  // Format date labels for chart axis
  const formattedData = data.map((item) => {
    const parts = item.dateKey.split("-");
    const label = parts.length === 3 ? `${parts[1]}/${parts[2]}` : item.dateKey;
    return {
      ...item,
      label,
    };
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle>Attendance Trends & Workforce Distribution</CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily historical volume of present, late arrivals, and approved remote work
          </p>
        </div>

        {/* 7-day vs 30-day Toggle */}
        <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => setPeriod("7d")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              period === "7d"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod("30d")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              period === "30d"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Last 30 Days
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-2 flex-1">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorWfh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F172A",
                  borderColor: "#334155",
                  borderRadius: "0.5rem",
                  color: "#F8FAFC",
                  fontSize: "12px",
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area
                type="monotone"
                dataKey="presentCount"
                name="Present (Office)"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorPresent)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="lateCount"
                name="Late Punch"
                stroke="#F59E0B"
                fillOpacity={1}
                fill="url(#colorLate)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="wfhCount"
                name="Remote (WFH)"
                stroke="#6366F1"
                fillOpacity={1}
                fill="url(#colorWfh)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

