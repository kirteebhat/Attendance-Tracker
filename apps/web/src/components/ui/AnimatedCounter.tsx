import React, { useEffect, useState, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number; // milliseconds
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
}

/**
 * Animated counter with ease-out cubic transition.
 * Updates smoothly on value change without re-rendering parent components or triggering layouts.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 750,
  prefix = "",
  suffix = "",
  className = "",
  decimals = 0,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const startValueRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const reqIdRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = displayValue;
    const endVal = value;
    startValueRef.current = startVal;
    startTimeRef.current = null;

    if (startVal === endVal) return;

    const easeOutCubic = (t: number) => --t * t * t + 1;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const current = startVal + (endVal - startVal) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        reqIdRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    reqIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
      }
    };
  }, [value, duration]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  return (
    <span
      className={className}
      aria-label={`${prefix}${value}${suffix}`}
      aria-live="polite"
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
