import React, { useMemo, useState } from "react";
import { Clock, TrendingUp, AlertCircle, CheckCircle2, Grid, BarChart3 } from "lucide-react";
import { HourlyCheckInItem, HeatmapCell } from "@vorldx/shared";
import { Tooltip } from "../ui/Tooltip";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface TodayTimelineChartProps {
  hourlyData?: HourlyCheckInItem[];
  heatmapData?: {
    cells: HeatmapCell[];
    maxCount: number;
    totalCheckIns: number;
    peakCell?: { weekdayName: string; hour: number; count: number };
  };
  timezone?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TodayTimelineChart: React.FC<TodayTimelineChartProps> = ({
  hourlyData = [],
  heatmapData,
  timezone = "Asia/Kolkata",
}) => {
  const [activeTab, setActiveTab] = useState<"hourly" | "heatmap">("hourly");

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

  // Heatmap matrix grouped by weekday (0..6) and hour (0..23)
  const heatmapMatrix = useMemo(() => {
    if (!heatmapData?.cells || heatmapData.cells.length === 0) return null;

    const rows: { weekday: number; name: string; hours: HeatmapCell[] }[] = [];
    for (let w = 1; w <= 6; w++) {
      // Mon to Sat first, then Sun
      const dayCells = heatmapData.cells
        .filter((c) => c.weekday === w)
        .sort((a, b) => a.hour - b.hour);
      rows.push({
        weekday: w,
        name: WEEKDAYS[w],
        hours: dayCells,
      });
    }
    // Sunday at bottom
    const sunCells = heatmapData.cells
      .filter((c) => c.weekday === 0)
      .sort((a, b) => a.hour - b.hour);
    rows.push({
      weekday: 0,
      name: "Sun",
      hours: sunCells,
    });

    return rows;
  }, [heatmapData]);

  const getHeatmapColor = (intensity: number, count: number) => {
    if (count === 0) return "bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-700/60";
    if (intensity === 1) return "bg-emerald-200 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300";
    if (intensity === 2) return "bg-emerald-300 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-200";
    if (intensity === 3) return "bg-emerald-500 dark:bg-emerald-600 text-white";
    return "bg-emerald-600 dark:bg-emerald-500 text-white font-bold";
  };

  return (
    <Card className="p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {activeTab === "hourly"
                    ? "Today's Check-In Velocity"
                    : "30-Day Check-In Heatmap"}
                </h3>
                {activeTab === "hourly" && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeTab === "hourly"
                  ? `Hourly arrival timeline and punctuality distribution (${timezone})`
                  : `Weekday by hour historical density matrix (${timezone})`}
              </p>
            </div>
          </div>

          {/* Quick Metrics & View Toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            {heatmapData && heatmapData.cells?.length > 0 && (
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("hourly")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "hourly"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
                  aria-pressed={activeTab === "hourly"}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Today</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("heatmap")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "heatmap"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
                  aria-pressed={activeTab === "heatmap"}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>30D Heatmap</span>
                </button>
              </div>
            )}

            {activeTab === "hourly" ? (
              <>
                {peakHourItem && peakHourItem.checkIns > 0 && (
                  <Badge variant="info" size="sm" className="gap-1">
                    <TrendingUp className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>Peak: {peakHourItem.label} ({peakHourItem.checkIns})</span>
                  </Badge>
                )}
                <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {totalOnTime} On-Time
                  </span>
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {totalLate} Late
                  </span>
                </div>
              </>
            ) : (
              heatmapData?.peakCell && (
                <Badge variant="info" size="sm" className="gap-1">
                  <TrendingUp className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  <span>
                    Peak: {heatmapData.peakCell.weekdayName} {String(heatmapData.peakCell.hour).padStart(2, "0")}:00 ({heatmapData.peakCell.count} scans)
                  </span>
                </Badge>
              )
            )}
          </div>
        </div>

        {/* TAB 1: Hourly Distribution Timeline */}
        {activeTab === "hourly" && (
          <div className="mt-4 pt-2">
            {totalToday === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Clock className="w-8 h-8 opacity-50 mb-1" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No check-in scans recorded yet for today
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Arrival velocity and peak times will populate live as employees scan at office terminals.
                </p>
              </div>
            ) : (
              <div
                className="h-44 flex items-end gap-1 sm:gap-1.5 w-full pt-6 pb-1 px-1 border-b border-slate-200 dark:border-slate-700"
                role="img"
                aria-label={`Hourly check-in timeline for today. Total check-ins: ${totalToday}. Peak hour: ${
                  peakHourItem ? `${peakHourItem.label} with ${peakHourItem.checkIns} check-ins` : "None"
                }.`}
              >
                {hourlyData.map((item) => {
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
                        {/* Floating count on hover */}
                        {item.checkIns > 0 && (
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.checkIns}
                          </span>
                        )}

                        {/* Bar */}
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
                              <div
                                className="w-full bg-emerald-500 group-hover:bg-emerald-400 transition-colors"
                                style={{ height: `${onTimePercent}%` }}
                              />
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
            )}

            {/* Legend */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                  <span>On-Time Arrival</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>Late (&gt;15 min grace)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Total Scans: {totalToday}
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: 30-Day Heatmap Matrix */}
        {activeTab === "heatmap" && heatmapMatrix && (
          <div className="mt-3 pt-1 overflow-x-auto">
            <div className="min-w-[500px]">
              {/* Hour Header */}
              <div className="flex items-center mb-1 text-[10px] font-mono text-slate-400">
                <span className="w-8 shrink-0" />
                <div className="flex-1 grid grid-cols-24 gap-0.5 text-center">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <span key={h} className={h % 4 === 0 ? "font-bold text-slate-600 dark:text-slate-300" : "opacity-40"}>
                      {h % 4 === 0 ? String(h).padStart(2, "0") : ""}
                    </span>
                  ))}
                </div>
              </div>

              {/* Day Rows */}
              <div className="space-y-1">
                {heatmapMatrix.map((row) => (
                  <div key={row.weekday} className="flex items-center gap-2">
                    <span className="w-8 text-[11px] font-semibold text-slate-600 dark:text-slate-400 font-mono shrink-0">
                      {row.name}
                    </span>
                    <div className="flex-1 grid grid-cols-24 gap-1">
                      {row.hours.map((cell) => (
                        <Tooltip
                          key={cell.hour}
                          content={
                            <div className="text-left text-xs">
                              <span className="font-bold">
                                {cell.weekdayName} {String(cell.hour).padStart(2, "0")}:00
                              </span>
                              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                                {cell.count} check-in{cell.count === 1 ? "" : "s"}
                              </div>
                            </div>
                          }
                          position="top"
                        >
                          <div
                            className={`h-4 sm:h-5 rounded-xs cursor-pointer transition-transform hover:scale-125 ${getHeatmapColor(
                              cell.intensity,
                              cell.count
                            )}`}
                            role="gridcell"
                            aria-label={`${cell.weekdayName} ${cell.hour}:00 - ${cell.count} scans`}
                          />
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">Less</span>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800/40" />
                    <span className="w-3 h-3 rounded-xs bg-emerald-200 dark:bg-emerald-950/80" />
                    <span className="w-3 h-3 rounded-xs bg-emerald-300 dark:bg-emerald-800" />
                    <span className="w-3 h-3 rounded-xs bg-emerald-500 dark:bg-emerald-600" />
                    <span className="w-3 h-3 rounded-xs bg-emerald-600 dark:bg-emerald-500" />
                  </div>
                  <span className="text-[11px]">More</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  30-Day Scans: {heatmapData?.totalCheckIns || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Screen-reader Alternative */}
      <div className="sr-only">
        <table>
          <caption>Hourly Check-In Velocity for Today</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              <th scope="col">Total Check-Ins</th>
              <th scope="col">On-Time</th>
              <th scope="col">Late</th>
            </tr>
          </thead>
          <tbody>
            {hourlyData.map((item) => (
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
