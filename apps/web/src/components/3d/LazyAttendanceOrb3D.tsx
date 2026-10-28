import React, { Suspense, lazy } from "react";
import { useFeatureFlags } from "../../api/queries";
import { useShouldRender3D } from "../../utils/webglSupport";
import { AttendanceOrbFallback } from "./AttendanceOrbFallback";

// Dynamic lazy import: Three.js and @react-three/fiber chunk is ONLY loaded if 3D is active
const LazyOrb = lazy(() => import("./AttendanceOrb3D"));

interface LazyAttendanceOrb3DProps {
  attendanceRate: number;
  size?: number;
  className?: string;
}

/**
 * Lazy-loaded wrapper for Dashboard Attendance Orb 3D.
 * Automatically falls back to 2D SVG indicator if:
 * 1. threeD flag is disabled
 * 2. WebGL is unavailable
 * 3. Low-end device detected
 * 4. User prefers reduced motion
 */
export const LazyAttendanceOrb3D: React.FC<LazyAttendanceOrb3DProps> = ({
  attendanceRate,
  size = 56,
  className = "",
}) => {
  const { data: flagData } = useFeatureFlags();
  const threeDEnabled = flagData?.data?.threeD ?? false;

  const { shouldRender3D } = useShouldRender3D(threeDEnabled);

  if (!shouldRender3D) {
    return (
      <AttendanceOrbFallback
        attendanceRate={attendanceRate}
        size={size}
        className={className}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <AttendanceOrbFallback
          attendanceRate={attendanceRate}
          size={size}
          className={className}
        />
      }
    >
      <LazyOrb
        attendanceRate={attendanceRate}
        size={size}
        className={className}
      />
    </Suspense>
  );
};
