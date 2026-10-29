import React, { useEffect, useState, useRef } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number; // milliseconds
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
  firstLoadOnly?: boolean;
}

/**
 * Animated counter with ease-out cubic transition.
 * Supports count-up on initial load only, with instant updates on subsequent live socket events.
 * Fully respects prefers-reduced-motion.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 750,
  prefix = "",
  suffix = "",
  className = "",
  decimals = 0,
  firstLoadOnly = true,
}) => {
  const isReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hasAnimatedRef = useRef<boolean>(false);
  const [displayValue, setDisplayValue] = useState<number>(() => {
    if (isReducedMotion) return value;
    return 0;
  });

  const startTimeRef = useRef<number | null>(null);
  const reqIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (isReducedMotion) {
      setDisplayValue(value);
      hasAnimatedRef.current = true;
      return;
    }

    // If firstLoadOnly is enabled and initial count-up already finished, update immediately
    if (firstLoadOnly && hasAnimatedRef.current) {
      setDisplayValue(value);
      return;
    }

    const startVal = displayValue;
    const endVal = value;
    startTimeRef.current = null;

    if (startVal === endVal) {
      hasAnimatedRef.current = true;
      return;
    }

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
        hasAnimatedRef.current = true;
      }
    };

    reqIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
      }
    };
  }, [value, duration, firstLoadOnly, isReducedMotion]);

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

