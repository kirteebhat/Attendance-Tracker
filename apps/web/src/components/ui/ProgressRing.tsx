import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { clsx } from "clsx";

export interface ProgressRingProps {
  value: number; // 0 to 100
  size?: "sm" | "md" | "lg" | "xl" | number;
  strokeWidth?: number;
  variant?: "primary" | "success" | "warning" | "danger" | "indigo" | "teal";
  showValue?: boolean;
  children?: React.ReactNode;
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
};

const strokeMap = {
  sm: 3,
  md: 4,
  lg: 5,
  xl: 7,
};

const variantColorMap = {
  primary: "text-blue-600 dark:text-blue-400 stroke-blue-600 dark:stroke-blue-400",
  success: "text-emerald-600 dark:text-emerald-400 stroke-emerald-600 dark:stroke-emerald-400",
  warning: "text-amber-500 dark:text-amber-400 stroke-amber-500 dark:stroke-amber-400",
  danger: "text-rose-600 dark:text-rose-400 stroke-rose-600 dark:stroke-rose-400",
  indigo: "text-indigo-600 dark:text-indigo-400 stroke-indigo-600 dark:stroke-indigo-400",
  teal: "text-teal-600 dark:text-teal-400 stroke-teal-600 dark:stroke-teal-400",
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = "md",
  strokeWidth: customStrokeWidth,
  variant = "primary",
  showValue = false,
  children,
  label = "Progress",
  className = "",
}) => {
  const { prefersReducedMotion } = useTheme();
  const dimension = typeof size === "number" ? size : sizeMap[size] || 48;
  const stroke =
    customStrokeWidth || (typeof size === "string" ? strokeMap[size] : 4);

  const normalizedRadius = (dimension - stroke) / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  const clampedValue = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clampedValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={clsx(
        "relative inline-flex items-center justify-center shrink-0 select-none",
        className
      )}
      style={{ width: dimension, height: dimension }}
    >
      <svg
        height={dimension}
        width={dimension}
        className="-rotate-90 transform"
        aria-hidden="true"
      >
        {/* Background Track */}
        <circle
          stroke="currentColor"
          className="text-slate-100 dark:text-slate-800"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={dimension / 2}
          cy={dimension / 2}
        />
        {/* Animated Progress Indicator */}
        <circle
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={dimension / 2}
          cy={dimension / 2}
          className={clsx(
            variantColorMap[variant],
            prefersReducedMotion
              ? "transition-none"
              : "transition-[stroke-dashoffset] duration-700 ease-out"
          )}
        />
      </svg>

      {/* Center Label / Children */}
      <div className="absolute inset-0 flex items-center justify-center text-center">
        {children ? (
          children
        ) : showValue ? (
          <span
            className={clsx(
              "font-bold tabular-nums text-slate-800 dark:text-slate-100",
              dimension <= 40 ? "text-[10px]" : dimension <= 60 ? "text-xs" : "text-sm"
            )}
          >
            {Math.round(clampedValue)}%
          </span>
        ) : null}
      </div>
    </div>
  );
};
