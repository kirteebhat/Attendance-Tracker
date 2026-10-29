import sharp from "sharp";
import fs from "fs";
import path from "path";

const assetsDir = path.resolve("apps/mobile/assets");
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

function getSvg(isTransparentBg = false) {
  const bgRect = isTransparentBg
    ? ""
    : `<rect width="1024" height="1024" fill="#07080E" />`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <!-- Background glow filter -->
    <filter id="ambientBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="70" result="blur" />
    </filter>

    <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <filter id="coreGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="24" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Gradients -->
    <!-- Ambient radial glow -->
    <radialGradient id="ambientGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#5965F2" stop-opacity="0.45" />
      <stop offset="45%" stop-color="#76B8FF" stop-opacity="0.25" />
      <stop offset="75%" stop-color="#C4A7FF" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#07080E" stop-opacity="0" />
    </radialGradient>

    <!-- Sphere liquid glass fill -->
    <radialGradient id="sphereGrad" cx="42%" cy="35%" r="68%">
      <stop offset="0%" stop-color="#1B1F3B" />
      <stop offset="40%" stop-color="#121528" />
      <stop offset="78%" stop-color="#0A0C18" />
      <stop offset="100%" stop-color="#06070D" />
    </radialGradient>

    <!-- Outer rim metallic/neon ring gradient -->
    <linearGradient id="ringBorderGrad" x1="15%" y1="10%" x2="85%" y2="90%">
      <stop offset="0%" stop-color="#76B8FF" />
      <stop offset="35%" stop-color="#8C95FF" />
      <stop offset="68%" stop-color="#5965F2" />
      <stop offset="100%" stop-color="#C4A7FF" />
    </linearGradient>

    <!-- Left Wing of V (Electric Cyan into Deep Indigo) -->
    <linearGradient id="leftWingGrad" x1="0%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#9EE4FF" />
      <stop offset="25%" stop-color="#76B8FF" />
      <stop offset="65%" stop-color="#5965F2" />
      <stop offset="100%" stop-color="#3A46C8" />
    </linearGradient>

    <!-- Right Wing of V (Luminous Lavender into Electric Indigo) -->
    <linearGradient id="rightWingGrad" x1="100%" y1="0%" x2="10%" y2="100%">
      <stop offset="0%" stop-color="#E2D4FF" />
      <stop offset="28%" stop-color="#C4A7FF" />
      <stop offset="65%" stop-color="#6F7BFF" />
      <stop offset="100%" stop-color="#4F5BE0" />
    </linearGradient>

    <!-- Inner 3D Facet Gradient -->
    <linearGradient id="facetGrad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.30" />
      <stop offset="50%" stop-color="#8C95FF" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#1D2158" stop-opacity="0.45" />
    </linearGradient>

    <!-- Diamond Core Gradient -->
    <radialGradient id="diamondGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="40%" stop-color="#9EE4FF" />
      <stop offset="80%" stop-color="#76B8FF" />
      <stop offset="100%" stop-color="#5965F2" />
    </radialGradient>

    <!-- Inner sphere clip path -->
    <clipPath id="circleClip">
      <circle cx="512" cy="512" r="350" />
    </clipPath>
  </defs>

  ${bgRect}

  <!-- Layer 1: Ambient Backdrop Aura -->
  <circle cx="512" cy="512" r="440" fill="url(#ambientGrad)" filter="url(#ambientBlur)" />

  <!-- Layer 2: High-Tech Orbital Track -->
  <!-- Outer subtle guides -->
  <circle cx="512" cy="512" r="405" fill="none" stroke="#8C95FF" stroke-opacity="0.12" stroke-width="1.5" />
  <circle cx="512" cy="512" r="378" fill="none" stroke="#76B8FF" stroke-opacity="0.08" stroke-width="1" />

  <!-- Segmented Neon Orbital Arcs -->
  <circle
    cx="512" cy="512" r="405"
    fill="none"
    stroke="url(#ringBorderGrad)"
    stroke-width="3.5"
    stroke-linecap="round"
    stroke-dasharray="160 50 80 40 280 600"
    filter="url(#glowEffect)"
  />

  <!-- Orbital Micro-Beacon Accents -->
  <circle cx="896" cy="385" r="5" fill="#76B8FF" filter="url(#glowEffect)" />
  <circle cx="128" cy="640" r="4" fill="#C4A7FF" filter="url(#glowEffect)" />
  <circle cx="680" cy="895" r="4" fill="#8C95FF" filter="url(#glowEffect)" />

  <!-- Layer 3: Main Circular Badge -->
  <!-- Outer Glow Shadow -->
  <circle cx="512" cy="512" r="352" fill="none" stroke="#5965F2" stroke-opacity="0.45" stroke-width="8" filter="url(#glowEffect)" />

  <!-- Glass Body (Clipped Content) -->
  <circle cx="512" cy="512" r="350" fill="url(#sphereGrad)" />

  <!-- Internal Graphic Elements Clipped Inside Main Circle -->
  <g clip-path="url(#circleClip)">
    <!-- Radial Radar Reticles -->
    <circle cx="512" cy="512" r="160" fill="none" stroke="#8C95FF" stroke-opacity="0.06" stroke-width="1.5" stroke-dasharray="6 6" />
    <circle cx="512" cy="512" r="255" fill="none" stroke="#76B8FF" stroke-opacity="0.05" stroke-width="1.5" />

    <!-- Soft Energy Pillar behind V -->
    <path d="M480 180h64l24 660h-112z" fill="url(#ambientGrad)" filter="url(#ambientBlur)" opacity="0.6" />

    <!-- Top Specular Glass Reflection (Curved Sheen) -->
    <path
      d="M200 360 C 320 220, 704 220, 824 360 C 680 320, 340 320, 200 360 Z"
      fill="#FFFFFF"
      opacity="0.07"
    />
  </g>

  <!-- Dual Ring Metallic Border -->
  <circle cx="512" cy="512" r="350" fill="none" stroke="url(#ringBorderGrad)" stroke-width="4.5" />
  <circle cx="512" cy="512" r="344" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="1.2" />

  <!-- ======================================================== -->
  <!-- Layer 4: The Out-of-the-Box 'V' Emblem                    -->
  <!-- ======================================================== -->

  <!-- Drop Shadow behind V -->
  <g filter="url(#glowEffect)" opacity="0.5">
    <path
      d="M304 316 L432 316 L512 650 L592 316 L720 316 L552 756 C536 788, 488 788, 472 756 Z"
      fill="#07080E"
    />
  </g>

  <!-- Left Aerodynamic Wing -->
  <!-- Path: Outer Top (304, 316) -> Inner Top (428, 316) -> Inner Apex (512, 650) -> Outer Apex (472, 756) -->
  <path
    d="M304 316 
       C316 316, 420 316, 428 316 
       L512 650 
       L480 740 
       C470 730, 460 706, 452 686 
       Z"
    fill="url(#leftWingGrad)"
  />

  <!-- Right Aerodynamic Wing -->
  <!-- Path: Inner Top (596, 316) -> Outer Top (720, 316) -> Outer Apex (544, 740) -> Inner Apex (512, 650) -->
  <path
    d="M596 316 
       C604 316, 708 316, 720 316 
       L572 686 
       C564 706, 554 730, 544 740 
       L512 650 
       Z"
    fill="url(#rightWingGrad)"
  />

  <!-- Apex Sculpted Keel (Bottom Chevron Join) -->
  <path
    d="M480 740 
       L512 650 
       L544 740 
       C532 766, 492 766, 480 740 Z"
    fill="#5965F2"
  />

  <!-- Left Wing 3D Bevel Highlight (Gleam Edge) -->
  <path
    d="M304 316 L428 316 L396 328 L320 328 Z"
    fill="#FFFFFF"
    opacity="0.65"
  />

  <!-- Right Wing 3D Bevel Highlight (Gleam Edge) -->
  <path
    d="M596 316 L720 316 L704 328 L628 328 Z"
    fill="#FFFFFF"
    opacity="0.55"
  />

  <!-- Left Inner Ridge (Reflected Light) -->
  <path
    d="M428 316 L512 650 L502 650 L420 324 Z"
    fill="#FFFFFF"
    opacity="0.4"
  />

  <!-- Right Inner Ridge (Shadow Line) -->
  <path
    d="M512 650 L596 316 L604 324 L522 650 Z"
    fill="#1D2158"
    opacity="0.6"
  />

  <!-- Outer Glass Overlay on V -->
  <path
    d="M304 316 L428 316 L512 650 L596 316 L720 316 L544 740 C532 766, 492 766, 480 740 Z"
    fill="url(#facetGrad)"
    opacity="0.35"
  />

  <!-- ======================================================== -->
  <!-- Layer 5: Dynamic Core Crystal Node (Center Beacon)       -->
  <!-- ======================================================== -->

  <!-- Ambient Beacon Bloom Glow -->
  <circle cx="512" cy="420" r="48" fill="#76B8FF" opacity="0.35" filter="url(#glowEffect)" />
  <circle cx="512" cy="420" r="24" fill="#C4A7FF" opacity="0.5" filter="url(#glowEffect)" />

  <!-- Precision Floating Rhombus / Diamond Core -->
  <polygon
    points="512,382 542,420 512,458 482,420"
    fill="url(#diamondGrad)"
    filter="url(#coreGlow)"
  />

  <!-- Center Pure White Spark -->
  <polygon
    points="512,398 528,420 512,442 496,420"
    fill="#FFFFFF"
  />

  <!-- Tiny Horizontal Optical Flare -->
  <ellipse cx="512" cy="420" rx="90" ry="3.5" fill="#9EE4FF" opacity="0.8" filter="url(#glowEffect)" />
  <ellipse cx="512" cy="420" rx="40" ry="2" fill="#FFFFFF" opacity="0.95" />
</svg>
`;
}

async function renderAssets() {
  console.log("Rendering out-of-the-box VorldX splash and icon assets with Sharp...");

  const svgFull = Buffer.from(getSvg(false)); // with #07080E bg
  const svgTransparent = Buffer.from(getSvg(true)); // transparent bg

  // 1. apps/mobile/assets/splash-icon.png (512x512 transparent)
  await sharp(svgTransparent)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(assetsDir, "splash-icon.png"));
  console.log(" Created splash-icon.png (512x512)");

  // 2. apps/mobile/assets/icon.png (1024x1024 with dark bg)
  await sharp(svgFull)
    .resize(1024, 1024)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(assetsDir, "icon.png"));
  console.log(" Created icon.png (1024x1024)");

  // 3. apps/mobile/assets/adaptive-icon.png (1024x1024 transparent foreground)
  await sharp(svgTransparent)
    .resize(1024, 1024)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(assetsDir, "adaptive-icon.png"));
  console.log(" Created adaptive-icon.png (1024x1024)");

  // 4. apps/mobile/assets/favicon.png (48x48)
  await sharp(svgFull)
    .resize(48, 48)
    .png({ quality: 100 })
    .toFile(path.join(assetsDir, "favicon.png"));
  console.log(" Created favicon.png (48x48)");

  console.log(" All out-of-the-box mobile assets rendered successfully!");
}

renderAssets().catch(console.error);

