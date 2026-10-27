import React from "react";
import { FolderOpen, LucideIcon } from "lucide-react";
import { Button } from "./Button";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: LucideIcon | React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  action,
  className,
  ...props
}) => {
  const renderIcon = () => {
    if (!icon) {
      return <FolderOpen className="w-6 h-6 text-slate-400 dark:text-slate-500" />;
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as LucideIcon;
    return <IconComponent className="w-6 h-6 text-slate-400 dark:text-slate-500" />;
  };

  return (
    <div
      role="region"
      aria-label={title}
      className={twMerge(
        clsx(
          "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 transition-colors",
          className
        )
      )}
      {...props}
    >
      <div className="p-3 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 dark:text-slate-400 mb-3">
        {renderIcon()}
      </div>
      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
      {!action && actionText && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-4">
          {actionText}
        </Button>
      )}
    </div>
  );
};
