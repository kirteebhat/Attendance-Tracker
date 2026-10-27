import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./Button";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message = "Failed to load data from the server. Please try again.",
  onRetry,
  isRetrying = false,
  className,
  ...props
}) => {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={twMerge(
        clsx(
          "flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 transition-colors",
          className
        )
      )}
      {...props}
    >
      <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-full text-rose-600 dark:text-rose-400 mb-3 shadow-sm">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-semibold text-rose-950 dark:text-rose-100">{title}</h4>
      <p className="text-xs text-rose-700/90 dark:text-rose-300 max-w-sm mt-1">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          className="mt-4 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-900/40"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
          Retry Connection
        </Button>
      )}
    </div>
  );
};
