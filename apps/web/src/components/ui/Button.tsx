import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading, children, disabled, ...props },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none";

    const variants = {
      primary:
        "bg-blue-600 hover:bg-blue-700 text-white shadow-sm focus-visible:ring-blue-600 focus-visible:ring-offset-white active:bg-blue-800",
      secondary:
        "bg-slate-100 hover:bg-slate-200 text-slate-800 focus-visible:ring-slate-400 active:bg-slate-300",
      outline:
        "border border-slate-300 hover:bg-slate-50 text-slate-700 focus-visible:ring-blue-500",
      danger:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus-visible:ring-rose-500 active:bg-rose-800",
      ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus-visible:ring-slate-400",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 gap-1.5",
      md: "text-sm px-4 py-2 gap-2",
      lg: "text-base px-5 py-2.5 gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
