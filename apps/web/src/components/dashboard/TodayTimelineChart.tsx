import React, { useMemo } from "react";
import { Clock, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { HourlyCheckInItem } from "@vorldx/shared";
import { Tooltip } from "../ui/Tooltip";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface TodayTimelineChartProps {
  hourlyData: HourlyCheckInItem[];
  timezone?: string;
}

export const TodayTimelineChart: React.FC<TodayTimelineChartProps> = ({
  hourlyData = [],
  timezone = "Asia/Kolkata",
}) => {
  // Compute max check-ins across hours for scaling
  const { maxCheckIns, totalToday, totalOnTime, totalLate, peakHourItem } = useMemo(() => {
    let max = 1;
    let sum = 0;
    let onTimeSum = 0;
    let lateSum = 0;
    let peak: HourlyCheckInItem | null = null;

    for (const item of hourlyData) {
      sum += item.checkIns;
      onTimeSum += item.onTime;
      lateSum += item.late;
      if (item.checkIns > max) {
        max = item.checkIns;
        peak = item;
      } else if (!peak && item.checkIns > 0) {
        peak = item;
      }
    }

    return {
      maxCheckIns: max,
      totalToday: sum,
      totalOnTime: onTimeSum,
      totalLate: lateSum,
      peakHourItem: peak,
    };
  }, [hourlyData]);

  // Current local hour in target timezone
  const currentHour = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).formatToParts(new Date());
      return parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    } catch {
      return new Date().getHours();
    }
  }, [timezone]);

  // Focus view: Office hours 06:00 to 21:00 or all 24 hours if scans exist outside
  const displayHours = useMemo(() => {
    if (hourlyData.length === 0) return [];
    return hourlyData;
  }, [hourlyData]);

  return (
    <Card className="p-5 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Today's Check-In Distribution
                </h3>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hourly arrival velocity and punctuality gradient ({timezone})
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 flex-wrap">
            {peakHourItem && peakHourItem.checkIns > 0 && (
              <Badge variant="info" size="sm" className="gap-1">
                <TrendingUp className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>Peak: {peakHourItem.label} ({peakHourItem.checkIns})</span>
              </Badge>
            )}
            <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {totalOnTime} On-Time
              </span>
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                {totalLate} Late
              </span>
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="mt-4 pt-2">
          {/* Bar Chart Area */}
          <div
            className="h-44 flex items-end gap-1 sm:gap-1.5 w-full pt-6 pb-1 px-1 border-b border-slate-200 dark:border-slate-700"
            role="img"
            aria-label={`Hourly check-in timeline for today. Total check-ins: ${totalToday}. Peak hour: ${
              peakHourItem ? `${peakHourItem.label} with ${peakHourItem.checkIns} check-ins` : "None"
            }.`}
          >
            {displayHours.map((item) => {
              const isCurrent = item.hour === currentHour;
              const heightPercent = maxCheckIns > 0 ? (item.checkIns / maxCheckIns) * 100 : 0;
              const onTimePercent = item.checkIns > 0 ? (item.onTime / item.checkIns) * 100 : 100;
              const latePercent = item.checkIns > 0 ? (item.late / item.checkIns) * 100 : 0;

              return (
                <div
                  key={item.hour}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative"
                >
                  <Tooltip
                    content={
                      <div className="text-left space-y-1">
                        <div className="font-bold border-b border-slate-700 pb-1 flex items-center justify-between gap-3">
                          <span>
                            {item.label} - {String((item.hour + 1) % 24).padStart(2, "0")}:00
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                              CURRENT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] space-y-0.5">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Total Check-Ins:</span>
                            <span className="font-semibold text-white">{item.checkIns}</span>
                          </div>
                          <div className="flex justify-between gap-4 text-emerald-400">
                            <span>On Time:</span>
                            <span className="font-semibold">{item.onTime}</span>
                          </div>
                          {item.late > 0 && (
                            <div className="flex justify-between gap-4 text-amber-400">
                              <span>Late Arrivals:</span>
                              <span className="font-semibold">{item.late}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    }
                    position="top"
                    className="w-full flex flex-col items-center justify-end h-full"
                  >
                    {/* Floating Count on Top of Bar when count > 0 */}
                    {item.checkIns > 0 && (
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.checkIns}
                      </span>
                    )}

                    {/* Bar Pill */}
                    <div
                      className={`w-full max-w-[22px] rounded-t-sm overflow-hidden flex flex-col-reverse transition-all duration-500 ease-out cursor-pointer ${
                        isCurrent
                          ? "ring-2 ring-cyan-500 ring-offset-1 dark:ring-offset-slate-900"
                          : ""
                      } ${item.checkIns === 0 ? "bg-slate-100 dark:bg-slate-800/40 h-1.5" : ""}`}
                      style={{
                        height: item.checkIns > 0 ? `${Math.max(12, heightPercent)}%` : "6px",
                      }}
                    >
                      {item.checkIns > 0 && (
                        <>
                          {/* On-Time Segment (Emerald) */}
                          <div
                            className="w-full bg-emerald-500 group-hover:bg-emerald-400 transition-colors"
                            style={{ height: `${onTimePercent}%` }}
                          />
                          {/* Late Segment (Amber) */}
                          {item.late > 0 && (
                            <div
                              className="w-full bg-amber-500 group-hover:bg-amber-400 transition-colors"
                              style={{ height: `${latePercent}%` }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </Tooltip>

                  {/* Hour Label */}
                  <span
                    className={`text-[10px] mt-2 font-mono ${
                      isCurrent
                        ? "font-bold text-cyan-600 dark:text-cyan-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {item.hour % 3 === 0 ? item.label.slice(0, 2) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
              <span>On-Time Arrival</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
              <span>Late Arrival (&gt;15 min grace)</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Total Scans Today: {totalToday}</span>
        </div>
      </div>

      {/* Screen-reader Accessible Text Alternative */}
      <div className="sr-only">
        <table>
          <caption>Hourly Check-In Distribution for Today</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              <th scope="col">Total Check-Ins</th>
              <th scope="col">On-Time</th>
              <th scope="col">Late</th>
            </tr>
          </thead>
          <tbody>
            {displayHours.map((item) => (
              <tr key={item.hour}>
                <td>{item.label}</td>
                <td>{item.checkIns}</td>
                <td>{item.onTime}</td>
                <td>{item.late}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
