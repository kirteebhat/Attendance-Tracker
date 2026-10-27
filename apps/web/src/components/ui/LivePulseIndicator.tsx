import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type LivePulseVariant = "live" | "syncing" | "offline" | "warning";

export interface LivePulseIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: LivePulseVariant;
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export const LivePulseIndicator: React.FC<LivePulseIndicatorProps> = ({
  variant = "live",
  label,
  showLabel = true,
  size = "md",
  className,
  ...props
}) => {
  const { prefersReducedMotion } = useTheme();

  const config = {
    live: {
      color: "bg-emerald-500",
      pingColor: "bg-emerald-400",
      textColor: "text-emerald-700 dark:text-emerald-400",
      defaultLabel: "Live",
    },
    syncing: {
      color: "bg-blue-500",
      pingColor: "bg-blue-400",
      textColor: "text-blue-700 dark:text-blue-400",
      defaultLabel: "Syncing",
    },
    offline: {
      color: "bg-slate-400",
      pingColor: "bg-slate-300",
      textColor: "text-slate-600 dark:text-slate-400",
      defaultLabel: "Offline",
    },
    warning: {
      color: "bg-amber-500",
      pingColor: "bg-amber-400",
      textColor: "text-amber-700 dark:text-amber-400",
      defaultLabel: "Degraded",
    },
  }[variant];

  const dotSizes = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const displayLabel = label || config.defaultLabel;

  return (
    <div
      role="status"
      aria-live="polite"
      className={twMerge(clsx("inline-flex items-center gap-2", className))}
      {...props}
    >
      <span className="relative flex items-center justify-center">
        {!prefersReducedMotion && variant !== "offline" && (
          <span
            className={twMerge(
              clsx(
                "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                config.pingColor
              )
            )}
            aria-hidden="true"
          />
        )}
        <span
          className={twMerge(
            clsx("relative inline-flex rounded-full shadow-sm", dotSizes[size], config.color)
          )}
          aria-hidden="true"
        />
      </span>
      {showLabel && (
        <span
          className={twMerge(
            clsx("font-medium select-none tracking-tight", textSizes[size], config.textColor)
          )}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
};
