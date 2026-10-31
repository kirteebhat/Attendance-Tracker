import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { clsx } from "clsx";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl" | "2xl";
}

const widthMap = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  width = "lg",
}) => {
  const { prefersReducedMotion } = useTheme();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      setTimeout(() => closeBtnRef.current?.focus(), 50);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity",
          prefersReducedMotion ? "" : "animate-in fade-in duration-200"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        className={clsx(
          "relative w-full h-full bg-white dark:bg-slate-900 shadow-2xl z-10 flex flex-col border-l border-slate-200 dark:border-slate-800 transition-colors",
          prefersReducedMotion ? "" : "animate-in slide-in-from-right duration-250",
          widthMap[width]
        )}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div>
            {title && (
              <h3 id="drawer-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
            )}
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 text-slate-700 dark:text-slate-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0 flex items-center justify-end gap-2.5 sm:gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
