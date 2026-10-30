import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "badge" | "card" | "table-row";
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "rectangular",
  width,
  height,
  className,
  style,
  ...props
}) => {
  const { prefersReducedMotion } = useTheme();

  const variantStyles = {
    text: "h-4 rounded-md w-full",
    circular: "rounded-full aspect-square",
    rectangular: "rounded-lg",
    badge: "h-5 w-16 rounded-full",
    card: "h-28 w-full rounded-xl",
    "table-row": "h-12 w-full rounded-lg",
  }[variant];

  const animationClass = prefersReducedMotion ? "" : "animate-shimmer";

  return (
    <div
      role="status"
      aria-label="Loading content..."
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      className={twMerge(
        clsx(
          "bg-slate-200 dark:bg-slate-800 transition-colors",
          animationClass,
          variantStyles,
          className
        )
      )}
      {...props}
    />
  );
};

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-24 h-4" />
        <Skeleton variant="circular" className="h-8 w-8" />
      </div>
      <Skeleton variant="text" className="h-8 w-20" />
      <Skeleton variant="text" className="h-3 w-32" />
    </div>
  );
};

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-800">
      <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <Skeleton key={i} variant="text" className={`h-4 ${i === 0 ? "w-40" : "w-24"}`} />
      ))}
    </div>
  );
};
