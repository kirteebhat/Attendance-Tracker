import React from "react";

interface LoginSceneFallbackProps {
  className?: string;
  size?: number;
}

/**
 * High-performance 2D static SVG fallback for the Login Page 3D scene.
 * Rendered when WebGL is unavailable, on low-end devices, when prefers-reduced-motion is active,
 * or while the dynamic Three.js chunk is loading.
 */
export const LoginSceneFallback: React.FC<LoginSceneFallbackProps> = ({
  className = "",
  size = 180,
}) => {
  return (
    <div
      role="img"
      aria-label="VorldX Enterprise biometric security shield"
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">
        VorldX Enterprise biometric security badge: 3D interactive floating crystal
      </span>

      {/* Ambient background glow */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-600/25 to-indigo-500/20 blur-xl animate-pulse"
        style={{ animationDuration: "4s" }}
      />

      {/* Stylized Faceted Geometric Crystal & Orbital Rings */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_10px_25px_rgba(6,182,212,0.35)]"
      >
        <defs>
          <linearGradient id="orbGrad1" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06b6d4" />
            <stop offset="0.5" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="orbGrad2" x1="180" y1="20" x2="20" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#1e1b4b" />
          </linearGradient>
          <linearGradient id="facetHighlight" x1="100" y1="40" x2="100" y2="160" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer Orbit Track */}
        <ellipse
          cx="100"
          cy="100"
          rx="82"
          ry="32"
          stroke="url(#orbGrad1)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeOpacity="0.6"
          transform="rotate(-25 100 100)"
        />

        {/* Counter Orbit Track */}
        <ellipse
          cx="100"
          cy="100"
          rx="74"
          ry="28"
          stroke="url(#orbGrad2)"
          strokeWidth="1"
          strokeOpacity="0.4"
          transform="rotate(35 100 100)"
        />

        {/* Central Faceted Icosahedron / Crystal Silhouette */}
        <polygon
          points="100,45 145,72 145,128 100,155 55,128 55,72"
          fill="url(#orbGrad2)"
          fillOpacity="0.35"
          stroke="url(#orbGrad1)"
          strokeWidth="2"
        />

        {/* Internal Facet Lines */}
        <line x1="100" y1="45" x2="100" y2="155" stroke="url(#orbGrad1)" strokeWidth="1.5" strokeOpacity="0.8" />
        <line x1="55" y1="72" x2="145" y2="128" stroke="url(#orbGrad1)" strokeWidth="1" strokeOpacity="0.5" />
        <line x1="55" y1="128" x2="145" y2="72" stroke="url(#orbGrad1)" strokeWidth="1" strokeOpacity="0.5" />

        {/* Core Glowing Diamond */}
        <polygon
          points="100,68 126,100 100,132 74,100"
          fill="url(#orbGrad1)"
          fillOpacity="0.75"
          stroke="#ffffff"
          strokeWidth="1"
          strokeOpacity="0.6"
        />

        {/* Top Glint Reflection */}
        <circle cx="100" cy="72" r="3.5" fill="#ffffff" fillOpacity="0.9" />
        <circle cx="138" cy="85" r="2" fill="#38bdf8" fillOpacity="0.8" />
        <circle cx="62" cy="115" r="2" fill="#818cf8" fillOpacity="0.8" />

        {/* Orbital Node Beacons */}
        <circle cx="168" cy="82" r="4" fill="#06b6d4">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="32" cy="118" r="3.5" fill="#6366f1">
          <animate attributeName="opacity" values="1;0.4;1" dur="2.5s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
};

