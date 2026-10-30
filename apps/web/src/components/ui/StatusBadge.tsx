import React from "react";
import { getStatusDescriptor, StatusCategory } from "@vorldx/shared";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Home,
  Calendar,
  Sparkles,
  Coffee,
  Hourglass,
  Check,
  Ban,
  Slash,
  HelpCircle,
  LucideIcon,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

const ICON_MAP: Record<string, LucideIcon> = {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Home,
  Calendar,
  Sparkles,
  Coffee,
  Hourglass,
  Check,
  Ban,
  Slash,
  HelpCircle,
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string | StatusCategory;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  customLabel?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  size = "md",
  customLabel,
  className,
  ...props
}) => {
  const descriptor = getStatusDescriptor(status);
  const IconComponent = ICON_MAP[descriptor.icon] || HelpCircle;

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1 font-medium",
    md: "text-xs px-2.5 py-1 gap-1.5 font-medium",
    lg: "text-sm px-3 py-1.5 gap-2 font-semibold",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  // Color classes mapping for Tailwind (WCAG AA Compliant in light and dark mode)
  const colorClasses: Record<StatusCategory, string> = {
    PRESENT: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    LATE: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    ABSENT: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50",
    INCOMPLETE: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50",
    WFH: "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50",
    LEAVE: "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/50",
    HOLIDAY: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
    OFF_DAY: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
    PENDING: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    REJECTED: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  };

  const statusColor = colorClasses[descriptor.key] || colorClasses.OFF_DAY;

  return (
    <span
      role="status"
      aria-label={descriptor.ariaLabel}
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-full border transition-colors select-none shadow-xs font-medium",
          sizeClasses[size],
          statusColor,
          className
        )
      )}
      {...props}
    >
      {showIcon && (
        <IconComponent
          className={twMerge(clsx("shrink-0", iconSizes[size]))}
          aria-hidden="true"
        />
      )}
      <span>{customLabel || descriptor.label}</span>
    </span>
  );
};

