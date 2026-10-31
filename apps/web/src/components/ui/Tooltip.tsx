import React, { useState, useId } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  align?: "center" | "start" | "end" | "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  align = "center",
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  if (!content) return <>{children}</>;

  const isAlignEnd = align === "end" || align === "right";
  const isAlignStart = align === "start" || align === "left";

  const getPositionClasses = () => {
    if (position === "top") {
      if (isAlignEnd) return "bottom-full right-0 mb-2";
      if (isAlignStart) return "bottom-full left-0 mb-2";
      return "bottom-full left-1/2 -translate-x-1/2 mb-2";
    }
    if (position === "bottom") {
      if (isAlignEnd) return "top-full right-0 mt-2";
      if (isAlignStart) return "top-full left-0 mt-2";
      return "top-full left-1/2 -translate-x-1/2 mt-2";
    }
    if (position === "left") {
      return "right-full top-1/2 -translate-y-1/2 mr-2";
    }
    return "left-full top-1/2 -translate-y-1/2 ml-2";
  };

  const getArrowClasses = () => {
    if (position === "top") {
      if (isAlignEnd) return "top-full right-3 -mt-0.75";
      if (isAlignStart) return "top-full left-3 -mt-0.75";
      return "top-full left-1/2 -translate-x-1/2 -mt-0.75";
    }
    if (position === "bottom") {
      if (isAlignEnd) return "bottom-full right-3 -mb-0.75";
      if (isAlignStart) return "bottom-full left-3 -mb-0.75";
      return "bottom-full left-1/2 -translate-x-1/2 -mb-0.75";
    }
    if (position === "left") {
      return "left-full top-1/2 -translate-y-1/2 -ml-0.75";
    }
    return "right-full top-1/2 -translate-y-1/2 -mr-0.75";
  };

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
          className={`absolute z-50 pointer-events-none px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900/95 dark:bg-slate-800/95 rounded-md shadow-lg backdrop-blur-xs w-max max-w-[calc(100vw-2rem)] sm:max-w-xs break-words leading-relaxed transition-opacity duration-150 ${getPositionClasses()}`}
        >
          {content}
          <div
            className={`absolute w-1.5 h-1.5 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 ${getArrowClasses()}`}
          />
        </div>
      )}
    </div>
  );
};

