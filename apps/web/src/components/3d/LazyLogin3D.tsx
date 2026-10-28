import React, { Suspense, lazy } from "react";
import { useFeatureFlags } from "../../api/queries";
import { useShouldRender3D } from "../../utils/webglSupport";
import { LoginSceneFallback } from "./LoginSceneFallback";

// Dynamic lazy import: Three.js and @react-three/fiber chunk is ONLY loaded if 3D is active
const LazyScene = lazy(() => import("./LoginScene3D"));

interface LazyLogin3DProps {
  className?: string;
  size?: number;
}

/**
 * Lazy-loaded wrapper for Login page 3D scene.
 * Enforces:
 * 1. threeD feature flag check
 * 2. WebGL availability check
 * 3. Low-end device filtering (CPU <= 2 cores or RAM < 4GB)
 * 4. Reduced-motion accessibility check
 * 5. Automatic 2D static SVG fallback
 */
export const LazyLogin3D: React.FC<LazyLogin3DProps> = ({
  className = "",
  size = 180,
}) => {
  const { data: flagData } = useFeatureFlags();
  const threeDEnabled = flagData?.data?.threeD ?? false;

  const { shouldRender3D } = useShouldRender3D(threeDEnabled);

  if (!shouldRender3D) {
    return <LoginSceneFallback className={className} size={size} />;
  }

  return (
    <Suspense fallback={<LoginSceneFallback className={className} size={size} />}>
      <LazyScene className={className} size={size} />
    </Suspense>
  );
};

