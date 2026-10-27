import React, { useEffect, useRef } from "react";
import { AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "./Button";
import { useTheme } from "../../context/ThemeContext";
import { clsx } from "clsx";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}) => {
  const { prefersReducedMotion } = useTheme();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const iconConfig = {
    danger: {
      Icon: AlertCircle,
      bg: "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400",
      buttonVariant: "danger" as const,
    },
    warning: {
      Icon: AlertTriangle,
      bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400",
      buttonVariant: "primary" as const,
    },
    primary: {
      Icon: HelpCircle,
      bg: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
      buttonVariant: "primary" as const,
    },
  }[variant];

  const { Icon, bg, buttonVariant } = iconConfig;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity",
          prefersReducedMotion ? "" : "animate-in fade-in duration-200"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className={clsx(
          "relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10 transition-colors",
          prefersReducedMotion ? "" : "animate-in zoom-in-95 duration-200"
        )}
      >
        <div className="flex items-start gap-4">
          <div className={clsx("rounded-xl p-3 shrink-0 shadow-sm", bg)}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-message"
              className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            variant={buttonVariant}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
