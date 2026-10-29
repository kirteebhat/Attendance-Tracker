import React, { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "../../context/ThemeContext";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

const maxWidthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
}) => {
  const { prefersReducedMotion } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity",
          prefersReducedMotion ? "" : "animate-in fade-in duration-150"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={clsx(
          "relative w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 overflow-hidden max-h-[90vh] flex flex-col transition-colors",
          prefersReducedMotion ? "" : "animate-in zoom-in-95 duration-150",
          maxWidthMap[maxWidth]
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0 bg-slate-50/70 dark:bg-slate-800/60">
            <div>
              {title && (
                <h3 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto text-slate-900 dark:text-slate-100">{children}</div>
      </div>
    </div>
  );
};

