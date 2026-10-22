import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "present"
    | "late"
    | "absent"
    | "wfh"
    | "incomplete"
    | "neutral"
    | "info"
    | "warning"
    | "success"
    | "danger"
    | "primary";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}) => {
  const baseStyles = "inline-flex items-center font-medium rounded-full border";

  const variants = {
    present: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    late: "bg-amber-50 text-amber-700 border-amber-200/80",
    absent: "bg-rose-50 text-rose-700 border-rose-200/80",
    danger: "bg-rose-50 text-rose-700 border-rose-200/80",
    wfh: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    primary: "bg-blue-50 text-blue-700 border-blue-200/80",
    incomplete: "bg-purple-50 text-purple-700 border-purple-200/80",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    info: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  };

  const sizes = {
    sm: "text-[11px] px-2 py-0.5 gap-1 leading-normal",
    md: "text-xs px-2.5 py-1 gap-1.5 leading-normal",
  };

  return (
    <span
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      {...props}
    >
      {children}
    </span>
  );
};
