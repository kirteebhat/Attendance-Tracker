import React from "react";

interface AttendanceOrbFallbackProps {
  attendanceRate: number;
  size?: number;
  className?: string;
}

/**
 * High-performance 2D static SVG fallback for the Dashboard Attendance Orb.
 * Reflects real attendance percentage using SVG circular progress stroke and theme-aligned colors.
 */
export const AttendanceOrbFallback: React.FC<AttendanceOrbFallbackProps> = ({
  attendanceRate,
  size = 56,
  className = "",
}) => {
  const normalizedRate = Math.max(0, Math.min(100, attendanceRate));

  // Determine theme color based on attendance rate
  const colorScheme =
    normalizedRate >= 80
      ? {
          stroke: "#10b981", // emerald
          glow: "rgba(16, 185, 129, 0.4)",
          bgGlow: "from-emerald-500/20 to-teal-500/10",
        }
      : normalizedRate >= 60
      ? {
          stroke: "#f59e0b", // amber
          glow: "rgba(245, 158, 11, 0.4)",
          bgGlow: "from-amber-500/20 to-orange-500/10",
        }
      : {
          stroke: "#f43f5e", // rose
          glow: "rgba(244, 63, 94, 0.4)",
          bgGlow: "from-rose-500/20 to-red-500/10",
        };

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedRate / 100) * circumference;

  return (
    <div
      role="img"
      aria-label={`Workforce attendance rate: ${normalizedRate}%`}
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">
        2D visual attendance indicator showing {normalizedRate}% workforce presence today
      </span>

      {/* Subtle background glow */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${colorScheme.bgGlow} blur-md`}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Background Track Ring */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-slate-200 dark:text-slate-800"
          fill="none"
        />

        {/* Outer Secondary Orbit Track */}
        <circle
          cx="30"
          cy="30"
          r="27"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 4"
          className="text-slate-300 dark:text-slate-700"
          fill="none"
        />

        {/* Dynamic Progress Ring */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          stroke={colorScheme.stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 30 30)"
          style={{
            transition: "stroke-dashoffset 0.8s ease-in-out, stroke 0.4s ease",
            filter: `drop-shadow(0 0 3px ${colorScheme.glow})`,
          }}
          fill="none"
        />

        {/* Center Glowing Core Orb */}
        <circle
          cx="30"
          cy="30"
          r="9"
          fill={colorScheme.stroke}
          fillOpacity="0.25"
        />
        <circle
          cx="30"
          cy="30"
          r="6"
          fill={colorScheme.stroke}
        />
        <circle
          cx="28"
          cy="28"
          r="2"
          fill="#ffffff"
          fillOpacity="0.75"
        />
      </svg>
    </div>
  );
};

