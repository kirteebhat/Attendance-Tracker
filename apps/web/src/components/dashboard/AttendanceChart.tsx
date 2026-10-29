import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { DashboardDayTrend } from "../../api/queries";
import { Badge } from "../ui/Badge";

interface AttendanceChartProps {
  last7Days?: DashboardDayTrend[];
  last30Days?: DashboardDayTrend[];
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  dataMap?: Map<string, DashboardDayTrend>;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, dataMap }) => {
  if (!active || !payload || payload.length === 0) return null;

  const originalItem = label && dataMap ? dataMap.get(label) : null;
  const rate = originalItem?.attendanceRate ?? 0;
  const total = originalItem?.totalEmployees ?? 0;

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl text-xs space-y-2 min-w-[200px]">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {label}
        </span>
        <Badge
          variant={rate >= 80 ? "success" : rate >= 60 ? "warning" : "danger"}
          size="sm"
          className="font-mono"
        >
          {rate}%
        </Badge>
      </div>

      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
              {entry.value}
            </span>
          </div>
        ))}
      </div>

      {originalItem && originalItem.absentCount > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-rose-500">
          <span>Absent:</span>
          <span className="font-bold font-mono">{originalItem.absentCount}</span>
        </div>
      )}

      {total > 0 && (
        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80 flex justify-between">
          <span>Active Workforce:</span>
          <span className="font-mono">{total} staff</span>
        </div>
      )}
    </div>
  );
};

export const AttendanceChart: React.FC<AttendanceChartProps> = ({
  last7Days = [],
  last30Days = [],
  isLoading = false,
}) => {
  const [period, setPeriod] = useState<"7d" | "30d">("7d");

  const isReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rawData = period === "7d" ? last7Days : last30Days;

  // Format date labels for chart axis and build quick lookup map
  const { chartData, dataMap, hasData } = useMemo(() => {
    const map = new Map<string, DashboardDayTrend>();
    let totalScans = 0;

    const formatted = rawData.map((item) => {
      const parts = item.dateKey.split("-");
      const shortLabel = parts.length === 3 ? `${parts[1]}/${parts[2]}` : item.dateKey;
      map.set(shortLabel, item);
      totalScans += item.presentCount + item.wfhCount;

      return {
        ...item,
        label: shortLabel,
      };
    });

    return {
      chartData: formatted,
      dataMap: map,
      hasData: formatted.length > 0 && (totalScans > 0 || formatted.some((d) => d.totalEmployees > 0)),
    };
  }, [rawData]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Workforce Attendance Trends</CardTitle>
            <Badge variant="neutral" size="sm" className="hidden sm:inline-flex">
              {period === "7d" ? "7 Days" : "30 Days"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daily historical volume of office arrivals, late arrivals, and approved remote work
          </p>
        </div>

        {/* 7-day vs 30-day Toggle Buttons */}
        <div
          role="group"
          aria-label="Select trend timeline period"
          className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 self-start sm:self-auto"
        >
          <button
            type="button"
            onClick={() => setPeriod("7d")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              period === "7d"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
            aria-pressed={period === "7d"}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setPeriod("30d")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              period === "30d"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
            aria-pressed={period === "30d"}
          >
            Last 30 Days
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 pb-2 flex-1 flex flex-col justify-between">
        {!hasData && !isLoading ? (
          <div className="h-72 w-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 mb-2">
              <TrendingUp className="w-8 h-8 opacity-60 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No historical trend records found
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Workforce trends will populate automatically as employees check in over consecutive days.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorWfh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-slate-200/80 dark:stroke-slate-800/80"
                />

                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#CBD5E1", strokeOpacity: 0.4 }}
                />

                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />

                <RechartsTooltip
                  content={<CustomChartTooltip dataMap={dataMap} />}
                />

                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: "12px",
                    paddingBottom: "8px",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="presentCount"
                  name="Present (Office)"
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorPresent)"
                  strokeWidth={2.5}
                  isAnimationActive={!isReducedMotion}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="lateCount"
                  name="Late Arrivals"
                  stroke="#F59E0B"
                  fillOpacity={1}
                  fill="url(#colorLate)"
                  strokeWidth={2}
                  isAnimationActive={!isReducedMotion}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="wfhCount"
                  name="Approved WFH"
                  stroke="#6366F1"
                  fillOpacity={1}
                  fill="url(#colorWfh)"
                  strokeWidth={2}
                  isAnimationActive={!isReducedMotion}
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
