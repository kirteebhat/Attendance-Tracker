import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LivePulseIndicator } from "./LivePulseIndicator";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  durationMs?: number;
  icon?: LucideIcon;
  trend?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  live?: boolean;
  color?: "default" | "emerald" | "blue" | "amber" | "rose" | "purple";
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  durationMs = 900,
  icon: Icon,
  trend,
  live = false,
  color = "default",
  className,
  ...props
}) => {
  const { prefersReducedMotion } = useTheme();
  const [displayValue, setDisplayValue] = useState<number>(prefersReducedMotion ? value : 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startValue = displayValue;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (value - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, durationMs, prefersReducedMotion]);

  const colorStyles = {
    default: "text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
    emerald: "text-emerald-950 dark:text-emerald-100 bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/50",
    blue: "text-blue-950 dark:text-blue-100 bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50",
    amber: "text-amber-950 dark:text-amber-100 bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50",
    rose: "text-rose-950 dark:text-rose-100 bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900/50",
    purple: "text-purple-950 dark:text-purple-100 bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-900/50",
  }[color];

  const iconColorStyles = {
    default: "text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400",
    emerald: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400",
    rose: "text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400",
  }[color];

  const formattedNumber =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  return (
    <div
      className={twMerge(
        clsx(
          "relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md",
          colorStyles,
          className
        )
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {live && <LivePulseIndicator variant="live" size="sm" showLabel={false} />}
          {Icon && (
            <div className={twMerge(clsx("rounded-lg p-2 shrink-0", iconColorStyles))}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {prefix}
          {formattedNumber}
          {suffix}
        </span>
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          {trend.direction === "up" && (
            <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              {trend.value}
            </span>
          )}
          {trend.direction === "down" && (
            <span className="inline-flex items-center text-rose-600 dark:text-rose-400 gap-0.5">
              <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              {trend.value}
            </span>
          )}
          {trend.direction === "neutral" && (
            <span className="inline-flex items-center text-slate-500 dark:text-slate-400 gap-0.5">
              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
              {trend.value}
            </span>
          )}
          {trend.label && (
            <span className="text-slate-500 dark:text-slate-400 font-normal">
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
