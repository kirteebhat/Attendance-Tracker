import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
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
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-200 bg-rose-50/40">
      <div className="p-3 bg-rose-100 rounded-full text-rose-600 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-rose-950">{title}</h4>
      <p className="text-xs text-rose-700/90 max-w-sm mt-1">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          className="mt-4 border-rose-300 text-rose-800 hover:bg-rose-100/60"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Retry Connection
        </Button>
      )}
    </div>
  );
};

