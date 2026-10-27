import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, RotateCcw, X } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export type ToastType = "success" | "error" | "info" | "undo";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
  onUndo?: () => void;
}

interface ToastContextType {
  toast: (options: {
    type?: ToastType;
    title: string;
    description?: string;
    durationMs?: number;
    onUndo?: () => void;
  }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  undo: (title: string, onUndo: () => void, description?: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastItem: React.FC<{
  item: ToastMessage;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const { prefersReducedMotion } = useTheme();
  const duration = item.durationMs || (item.type === "undo" ? 5000 : 4500);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (prefersReducedMotion) {
      const timeout = setTimeout(() => {
        onDismiss(item.id);
      }, duration);
      return () => clearTimeout(timeout);
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(item.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, item.id, onDismiss, prefersReducedMotion]);

  const handleUndo = () => {
    if (item.onUndo) {
      item.onUndo();
    }
    onDismiss(item.id);
  };

  const styleConfig = {
    success: "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100",
    error: "bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100",
    info: "bg-slate-900/95 dark:bg-slate-800/95 border-slate-700 text-white",
    undo: "bg-slate-900/95 dark:bg-slate-900/95 border-indigo-500/50 text-white shadow-xl",
  }[item.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden pointer-events-auto flex flex-col rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 ${styleConfig}`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="shrink-0 mt-0.5">
          {item.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          {item.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          {item.type === "info" && <Info className="w-5 h-5 text-cyan-400" />}
          {item.type === "undo" && <RotateCcw className="w-5 h-5 text-indigo-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{item.title}</p>
          {item.description && (
            <p className="text-xs mt-0.5 opacity-80">{item.description}</p>
          )}
        </div>
        {item.type === "undo" && item.onUndo && (
          <button
            onClick={handleUndo}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs"
          >
            Undo
          </button>
        )}
        <button
          onClick={() => onDismiss(item.id)}
          className="shrink-0 opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress countdown bar for undo toasts */}
      {item.type === "undo" && !prefersReducedMotion && (
        <div className="h-1 w-full bg-slate-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({
      type = "info",
      title,
      description,
      durationMs,
      onUndo,
    }: {
      type?: ToastType;
      title: string;
      description?: string;
      durationMs?: number;
      onUndo?: () => void;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, type, title, description, durationMs, onUndo };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  return (
    <ToastContext.Provider
      value={{
        toast: addToast,
        success: (title, description) => addToast({ type: "success", title, description }),
        error: (title, description) => addToast({ type: "error", title, description }),
        info: (title, description) => addToast({ type: "info", title, description }),
        undo: (title, onUndo, description, durationMs = 5000) =>
          addToast({ type: "undo", title, description, onUndo, durationMs }),
      }}
    >
      {children}
      {/* Toast Render Container */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
