import React, { useState, useId } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  if (!content) return <>{children}</>;

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[position];

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 pointer-events-none px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900/95 dark:bg-slate-800/95 rounded-md shadow-lg backdrop-blur-xs whitespace-nowrap transition-opacity duration-150 ${positionClasses}`}
        >
          {content}
          <div
            className={`absolute w-1.5 h-1.5 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 ${
              position === "top"
                ? "top-full left-1/2 -translate-x-1/2 -mt-0.75"
                : position === "bottom"
                ? "bottom-full left-1/2 -translate-x-1/2 -mb-0.75"
                : position === "left"
                ? "left-full top-1/2 -translate-y-1/2 -ml-0.75"
                : "right-full top-1/2 -translate-y-1/2 -mr-0.75"
            }`}
          />
        </div>
      )}
    </div>
  );
};

