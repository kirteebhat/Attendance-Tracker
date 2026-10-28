import { useState, useEffect } from "react";

let cachedWebGLSupport: boolean | null = null;

/**
 * Checks whether WebGL 1.0 or 2.0 is supported and available in the browser.
 * Safe to call multiple times (cached).
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  if (cachedWebGLSupport !== null) {
    return cachedWebGLSupport;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    const hasContext = !!(gl && gl instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext));
    cachedWebGLSupport = hasContext;

    // Clean up WebGL context immediately
    if (gl) {
      const loseContext = gl.getExtension("WEBGL_lose_context");
      if (loseContext) {
        loseContext.loseContext();
      }
    }

    return hasContext;
  } catch {
    cachedWebGLSupport = false;
    return false;
  }
}

/**
 * Detects low-end devices based on CPU cores, RAM, and Save-Data header.
 * Devices with <= 2 CPU cores or < 4GB RAM are treated as low-end to preserve battery and UI responsiveness.
 */
export function isLowEndDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // 1. Hardware Concurrency (CPU Cores)
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) {
    return true;
  }

  // 2. Device Memory (in GB, Chromium/Edge/Android supported)
  const navAny = navigator as unknown as { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (typeof navAny.deviceMemory === "number" && navAny.deviceMemory < 4) {
    return true;
  }

  // 3. User requested reduced data / save-data
  if (navAny.connection?.saveData === true) {
    return true;
  }

  return false;
}

/**
 * Checks if the user's OS has "prefers-reduced-motion" enabled for accessibility.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook to monitor document tab visibility.
 * Used to pause Three.js render loops (frameloop="never") when the tab is hidden.
 */
export function useDocumentVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return !document.hidden;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Composite hook that determines whether to dynamically load and render 3D scenes.
 *
 * Rules:
 * - Feature flag `threeD` must be enabled.
 * - WebGL must be available and operational.
 * - Hardware must not be classified as low-end (CPU >= 4 cores, RAM >= 4GB).
 * - User must not prefer reduced motion.
 */
export function useShouldRender3D(flagEnabled?: boolean): {
  shouldRender3D: boolean;
  reason: "supported" | "flag_disabled" | "webgl_unavailable" | "low_end_device" | "reduced_motion";
} {
  const [reducedMotion, setReducedMotion] = useState<boolean>(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else if ("addListener" in mediaQuery) {
      (mediaQuery as unknown as { addListener: (cb: typeof handleChange) => void }).addListener(handleChange);
      return () =>
        (mediaQuery as unknown as { removeListener: (cb: typeof handleChange) => void }).removeListener(handleChange);
    }
    return undefined;
  }, []);

  if (flagEnabled === false) {
    return { shouldRender3D: false, reason: "flag_disabled" };
  }

  if (reducedMotion) {
    return { shouldRender3D: false, reason: "reduced_motion" };
  }

  if (!isWebGLAvailable()) {
    return { shouldRender3D: false, reason: "webgl_unavailable" };
  }

  if (isLowEndDevice()) {
    return { shouldRender3D: false, reason: "low_end_device" };
  }

  return { shouldRender3D: true, reason: "supported" };
}
