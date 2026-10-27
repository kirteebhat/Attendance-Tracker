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
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  size = "md",
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

  // Color classes mapping for Tailwind
  const colorClasses: Record<StatusCategory, string> = {
    PRESENT: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40",
    LATE: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/40",
    ABSENT: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/40",
    INCOMPLETE: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/40",
    WFH: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/40",
    LEAVE: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40",
    HOLIDAY: "bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-800/40",
    OFF_DAY: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
    PENDING: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800/40",
    APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40",
    REJECTED: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/40",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  };

  const statusColor = colorClasses[descriptor.key] || colorClasses.OFF_DAY;

  return (
    <span
      role="status"
      aria-label={descriptor.ariaLabel}
      className={twMerge(
        clsx(
          "inline-flex items-center rounded-full border transition-colors select-none shadow-sm",
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
      <span>{descriptor.label}</span>
    </span>
  );
};

