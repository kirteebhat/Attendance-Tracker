import React from "react";

interface CountdownRingProps {
  ttlSeconds: number;
  remainingSeconds: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  ttlSeconds,
  remainingSeconds,
  size = 120,
  strokeWidth = 8,
  className = "",
}) => {
  const safeTtl = ttlSeconds > 0 ? ttlSeconds : 30;
  const safeRemaining = Math.max(0, remainingSeconds);
  const progress = Math.min(1, safeRemaining / safeTtl);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // Dynamic status color based on remaining time
  let strokeColor = "#06b6d4"; // Cyan
  let textColor = "text-cyan-400";
  let pulseClass = "";

  if (safeRemaining <= 5) {
    strokeColor = "#ef4444"; // Rose
    textColor = "text-rose-400";
    pulseClass = "animate-pulse";
  } else if (safeRemaining <= 10) {
    strokeColor = "#f59e0b"; // Amber
    textColor = "text-amber-400";
  }

  const displaySeconds = Math.ceil(safeRemaining);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="polite"
      aria-label={`QR token rotates in ${displaySeconds} seconds`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 transform transition-all duration-300"
        aria-hidden="true"
      >
        {/* Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-[stroke-dashoffset,stroke] duration-200 ease-linear"
        />
      </svg>

      {/* Numerical Countdown Display in Center */}
      <div className={`absolute flex flex-col items-center justify-center text-center ${pulseClass}`}>
        <span className={`text-2xl sm:text-3xl font-black tracking-tight font-mono ${textColor}`}>
          {displaySeconds}
          <span className="text-xs font-semibold ml-0.5 opacity-80">s</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
          Rotate
        </span>
      </div>
    </div>
  );
};

