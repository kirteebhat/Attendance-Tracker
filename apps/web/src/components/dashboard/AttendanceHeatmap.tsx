import React, { useMemo, useState } from "react";
import { Flame, Calendar } from "lucide-react";
import { HeatmapCell } from "@vorldx/shared";
import { Tooltip } from "../ui/Tooltip";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface AttendanceHeatmapProps {
  cells: HeatmapCell[];
  maxCount: number;
  totalCheckIns: number;
  peakCell?: { weekdayName: string; hour: number; count: number };
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  0: "Sun",
};

// Major hours to display in columns
const DISPLAY_HOURS = Array.from({ length: 24 }, (_, i) => i);

export const AttendanceHeatmap: React.FC<AttendanceHeatmapProps> = ({
  cells = [],
  maxCount = 0,
  totalCheckIns = 0,
  peakCell,
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  // Map cells into a fast-lookup key: `${weekday}_${hour}`
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of cells) {
      map.set(`${cell.weekday}_${cell.hour}`, cell);
    }
    return map;
  }, [cells]);

  // Color generator based on intensity (0 to 4)
  const getCellBg = (intensity: number, count: number) => {
    if (count === 0 || intensity === 0) {
      return "bg-slate-100 dark:bg-slate-800/50 hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600";
    }
    switch (intensity) {
      case 1:
        return "bg-emerald-200 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 hover:ring-1 hover:ring-emerald-400";
      case 2:
        return "bg-emerald-400 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100 hover:ring-1 hover:ring-emerald-500";
      case 3:
        return "bg-emerald-500 dark:bg-emerald-600 text-white hover:ring-1 hover:ring-emerald-400";
      case 4:
      default:
        return "bg-emerald-700 dark:bg-emerald-500 text-white hover:ring-2 hover:ring-emerald-300 shadow-xs";
    }
  };

  return (
    <Card className="p-5 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                30-Day Check-In Heatmap
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Arrival patterns aggregated across all weekdays and hours
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {peakCell && (
              <Badge variant="warning" size="sm" className="gap-1">
                <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>
                  Peak: {peakCell.weekdayName} @ {String(peakCell.hour).padStart(2, "0")}:00 (
                  {peakCell.count})
                </span>
              </Badge>
            )}
            <Badge variant="neutral" size="sm" className="gap-1">
              <Calendar className="w-3 h-3" />
              <span>{totalCheckIns} Total 30-Day Scans</span>
            </Badge>
          </div>
        </div>

        {/* Heatmap Grid Container */}
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[620px]">
            {/* Hour Header Row */}
            <div className="flex items-center mb-1 text-[10px] font-mono text-slate-400 dark:text-slate-500">
              <div className="w-10 shrink-0"></div>
              <div className="flex-1 grid grid-cols-24 gap-1">
                {DISPLAY_HOURS.map((h) => (
                  <div key={h} className="text-center">
                    {h % 3 === 0 ? String(h).padStart(2, "0") : "·"}
                  </div>
                ))}
              </div>
            </div>

            {/* Weekday Rows */}
            <div className="space-y-1">
              {WEEKDAY_ORDER.map((weekdayNum) => {
                const label = WEEKDAY_LABELS[weekdayNum];
                const isWeekend = weekdayNum === 0 || weekdayNum === 6;

                return (
                  <div key={weekdayNum} className="flex items-center">
                    {/* Weekday Label */}
                    <div
                      className={`w-10 shrink-0 text-xs font-semibold ${
                        isWeekend
                          ? "text-slate-400 dark:text-slate-600"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {label}
                    </div>

                    {/* 24 Hour Cells */}
                    <div className="flex-1 grid grid-cols-24 gap-1">
                      {DISPLAY_HOURS.map((h) => {
                        const cell = cellMap.get(`${weekdayNum}_${h}`) || {
                          weekday: weekdayNum,
                          weekdayName: label,
                          hour: h,
                          count: 0,
                          intensity: 0,
                        };

                        const ratio = maxCount > 0 ? ((cell.count / maxCount) * 100).toFixed(0) : "0";

                        return (
                          <Tooltip
                            key={h}
                            content={
                              <div className="text-left space-y-1">
                                <div className="font-bold border-b border-slate-700 pb-0.5">
                                  {label}, {String(h).padStart(2, "0")}:00 -{" "}
                                  {String((h + 1) % 24).padStart(2, "0")}:00
                                </div>
                                <div className="text-[11px] space-y-0.5">
                                  <div className="flex justify-between gap-3">
                                    <span className="text-slate-400">Check-Ins:</span>
                                    <span className="font-semibold text-white">{cell.count}</span>
                                  </div>
                                  <div className="flex justify-between gap-3 text-emerald-400">
                                    <span>Peak Ratio:</span>
                                    <span>{ratio}%</span>
                                  </div>
                                </div>
                              </div>
                            }
                            position="top"
                            className="w-full"
                          >
                            <div
                              className={`h-5 w-full rounded-xs transition-all duration-200 cursor-pointer ${getCellBg(
                                cell.intensity,
                                cell.count
                              )}`}
                              onMouseEnter={() => setHoveredCell(cell)}
                              onMouseLeave={() => setHoveredCell(null)}
                            />
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Activity Density:</span>
            <span className="text-[10px]">Less</span>
            <div className="flex items-center gap-1 mx-1">
              <span className="w-3.5 h-3.5 rounded-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-200 dark:bg-emerald-950/80" />
              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-400 dark:bg-emerald-800" />
              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500 dark:bg-emerald-600" />
              <span className="w-3.5 h-3.5 rounded-xs bg-emerald-700 dark:bg-emerald-500" />
            </div>
            <span className="text-[10px]">Peak</span>
          </div>

          <div className="text-[11px] text-slate-400">
            {hoveredCell
              ? `${hoveredCell.weekdayName} @ ${String(hoveredCell.hour).padStart(2, "0")}:00 → ${
                  hoveredCell.count
                } check-ins`
              : "Hover any tile for hourly check-in volume"}
          </div>
        </div>
      </div>

      {/* Screen Reader Accessible Text Grid */}
      <div className="sr-only">
        <table>
          <caption>30-Day Check-In Distribution by Weekday and Hour</caption>
          <thead>
            <tr>
              <th scope="col">Weekday</th>
              {DISPLAY_HOURS.map((h) => (
                <th key={h} scope="col">
                  {h}:00
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAY_ORDER.map((w) => (
              <tr key={w}>
                <th scope="row">{WEEKDAY_LABELS[w]}</th>
                {DISPLAY_HOURS.map((h) => {
                  const cell = cellMap.get(`${w}_${h}`);
                  return <td key={h}>{cell?.count || 0}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

