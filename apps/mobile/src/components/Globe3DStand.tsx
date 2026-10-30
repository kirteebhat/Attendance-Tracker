import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Ellipse,
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  G,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

interface Globe3DStandProps {
  size?: number;
}

export const Globe3DStand: React.FC<Globe3DStandProps> = ({ size = 260 }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bobAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Globe dimensions
  const scale = size / 260;
  const globeRadius = 56 * scale;
  const globeDiameter = globeRadius * 2;
  const worldMapWidth = 280 * scale; // Width of one full 360-deg projection

  useEffect(() => {
    // 1. Continuous Earth rotation
    const rotationLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 2. Gentle levitation / floating motion
    const bobbingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Subtle atmospheric beacon pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    rotationLoop.start();
    bobbingLoop.start();
    pulseLoop.start();

    return () => {
      rotationLoop.stop();
      bobbingLoop.stop();
      pulseLoop.stop();
    };
  }, [rotateAnim, bobAnim, pulseAnim]);

  const mapTranslateX = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -worldMapWidth],
  });

  const floatTranslateY = bobAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 4],
  });

  const haloOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.95],
  });

  return (
    <Animated.View
      style={[
        styles.rootContainer,
        {
          width: size,
          height: size * 1.05,
          transform: [{ translateY: floatTranslateY }],
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel="3D VorldX Rotating Earth Globe on Cursive X Stand"
    >
      {/* =================================================================== */}
      {/* LAYER 1: BACK STAND & AXIAL MERIDIAN (Passing Behind the Globe)     */}
      {/* =================================================================== */}
      <Svg
        width={size}
        height={size * 1.05}
        viewBox="0 0 260 274"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Luminous Vibrant Stand Gradient (App Theme: Indigo Soft to Cyber Lavender & Electric Cyan) */}
          <SvgLinearGradient id="standLuminous" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#E2D4FF" stopOpacity="1" />
            <Stop offset="30%" stopColor="#8C95FF" stopOpacity="1" />
            <Stop offset="65%" stopColor="#76B8FF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#C4A7FF" stopOpacity="1" />
          </SvgLinearGradient>

          {/* Back Curved Rod Gradient (Bright & High Contrast) */}
          <SvgLinearGradient id="backRodLuminous" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#C4A7FF" stopOpacity="1" />
            <Stop offset="45%" stopColor="#8C95FF" stopOpacity="1" />
            <Stop offset="80%" stopColor="#76B8FF" stopOpacity="1" />
            <Stop offset="100%" stopColor="#A5F3FC" stopOpacity="1" />
          </SvgLinearGradient>

          {/* Stand Highlight Gleam (Pure White & Ice Cyan) */}
          <SvgLinearGradient id="chromeGleam" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="50%" stopColor="#BAE6FD" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
          </SvgLinearGradient>

          {/* Pedestal Ambient Underglow */}
          <RadialGradient id="pedestalAura" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#7E8BFF" stopOpacity="0.65" />
            <Stop offset="45%" stopColor="#38BDF8" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#07080E" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient Pedestal Shadow & Underglow */}
        <Ellipse cx="130" cy="254" rx="64" ry="14" fill="url(#pedestalAura)" />

        {/* Axis Rod passing through globe poles (tilted 23.5 deg) */}
        {/* Glow behind axis rod */}
        <Path
          d="M 153 22 L 151 34 M 109 144 L 107 156"
          stroke="#7E8BFF"
          strokeWidth="7"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
        {/* Main axis rod */}
        <Path
          d="M 153 22 L 151 34 M 109 144 L 107 156"
          stroke="url(#standLuminous)"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Axis rod specular center */}
        <Path
          d="M 153 22 L 151 34 M 109 144 L 107 156"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeOpacity="0.9"
          strokeLinecap="round"
        />

        {/* ================================================================= */}
        {/* BACK HALF OF THE CURVED ROD (Meridian Arc Passing Behind Globe)   */}
        {/* Bright, luminous and 100% visible against the dark background     */}
        {/* ================================================================= */}
        {/* 1. Neon Glow Aura */}
        <Path
          d="M 152 28 C 76 34 50 110 108 148"
          stroke="#7E8BFF"
          strokeWidth="10"
          strokeOpacity="0.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* 2. Main Luminous Curved Rod */}
        <Path
          d="M 152 28 C 76 34 50 110 108 148"
          stroke="url(#backRodLuminous)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* 3. Specular Ridge Highlight */}
        <Path
          d="M 152 28 C 76 34 50 110 108 148"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeOpacity="0.85"
          fill="none"
          strokeLinecap="round"
        />

        {/* Top North Pole Finial / Luminous Axis Beacon */}
        <Circle cx="153" cy="22" r="7" fill="#7E8BFF" opacity="0.45" />
        <Circle cx="153" cy="22" r="5" fill="url(#standLuminous)" />
        <Circle cx="152" cy="21" r="2" fill="#FFFFFF" opacity="0.95" />
      </Svg>

      {/* =================================================================== */}
      {/* LAYER 2: 3D EARTH SPHERE (Tilted & Continuously Revolving)          */}
      {/* =================================================================== */}
      <View
        style={[
          styles.globePlacement,
          {
            top: 28 * scale,
            left: (260 * scale - globeDiameter) / 2,
            width: globeDiameter,
            height: globeDiameter,
            borderRadius: globeRadius,
          },
        ]}
      >
        {/* Deep Oceanic Planet Base with Spherical Gradient */}
        <LinearGradient
          colors={['#10224D', '#0A1535', '#050B1B']}
          start={{ x: 0.15, y: 0.15 }}
          end={{ x: 0.85, y: 0.85 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Rotating Continents Canvas (Tilted 23.5 deg) */}
        <View style={styles.tiltedContainer}>
          <Animated.View
            style={[
              styles.slidingWorldStrip,
              {
                width: worldMapWidth * 2,
                transform: [{ translateX: mapTranslateX }],
              },
            ]}
          >
            {/* World Map Instance 1 */}
            <SvgWorldMap width={worldMapWidth} height={globeDiameter * 1.1} />
            {/* World Map Instance 2 (seamless continuation) */}
            <SvgWorldMap width={worldMapWidth} height={globeDiameter * 1.1} />
          </Animated.View>
        </View>

        {/* 3D Curvature Gradients, Specular Gleam & Night Shadow (Non-rotating overlay) */}
        {/* 1. Sunlight Directional Gleam (Top-Left Specular highlight) */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.45)', 'rgba(118, 184, 255, 0.15)', 'transparent']}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.65, y: 0.65 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* 2. Night Terminator Shadow (Bottom-Right directional shadow) */}
        <LinearGradient
          colors={['transparent', 'rgba(3, 5, 14, 0.35)', 'rgba(3, 5, 14, 0.88)']}
          start={{ x: 0.35, y: 0.35 }}
          end={{ x: 0.95, y: 0.95 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* 3. Inset Vignette Ring (Edge Curvature / Spherical Depth) */}
        <View style={styles.vignetteRing} pointerEvents="none" />
      </View>

      {/* Atmospheric Rim Glow Halo */}
      <Animated.View
        style={[
          styles.atmosphericHalo,
          {
            top: 26 * scale,
            left: (260 * scale - (globeDiameter + 8 * scale)) / 2,
            width: globeDiameter + 8 * scale,
            height: globeDiameter + 8 * scale,
            borderRadius: (globeDiameter + 8 * scale) / 2,
            opacity: haloOpacity,
          },
        ]}
        pointerEvents="none"
      />

      {/* =================================================================== */}
      {/* LAYER 3: FRONT CURSIVE "X" STAND & SUPPORTING ARM                   */}
      {/* Ultra-Vibrant & Visible Colors from the VorldX Theme                */}
      {/* =================================================================== */}
      <Svg
        width={size}
        height={size * 1.05}
        viewBox="0 0 260 274"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {/* ================================================================= */}
        {/* FRONT HALF OF THE CURVED ROD (Passing in Front Around Bottom)     */}
        {/* ================================================================= */}
        {/* 1. Neon Aura Glow */}
        <Path
          d="M 108 148 C 158 144 196 98 152 28"
          stroke="#76B8FF"
          strokeWidth="10"
          strokeOpacity="0.45"
          fill="none"
          strokeLinecap="round"
        />
        {/* 2. Main Luminous Stroke */}
        <Path
          d="M 108 148 C 158 144 196 98 152 28"
          stroke="url(#standLuminous)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* 3. Specular Gleam Highlight */}
        <Path
          d="M 108 148 C 158 144 196 98 152 28"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeOpacity="0.9"
          fill="none"
          strokeLinecap="round"
        />

        {/* South Pole Finial Mount */}
        <Circle cx="108" cy="148" r="7" fill="#38BDF8" opacity="0.4" />
        <Circle cx="108" cy="148" r="5" fill="url(#standLuminous)" />
        <Circle cx="107" cy="147" r="2" fill="#FFFFFF" opacity="0.95" />

        {/* ================================================================= */}
        {/* THE "X" STAND SCULPTURE                                            */}
        {/* Elegant cursive crossing with straight sturdy anchor to the base   */}
        {/* ================================================================= */}

        {/* 1. Left-to-Right Stroke of 'X':                                    */}
        {/* Sweeps from the globe cradle at (108, 148), crosses center (130, 200) */}
        {/* and extends straight into the right base anchor at (158, 250).      */}
        {/* Layer A: Wide Neon Glow Aura */}
        <Path
          d="M 108 148 C 112 170 122 188 130 200 L 158 250"
          stroke="#7E8BFF"
          strokeWidth="11"
          strokeOpacity="0.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Layer B: Main Luminous Body */}
        <Path
          d="M 108 148 C 112 170 122 188 130 200 L 158 250"
          stroke="url(#standLuminous)"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Layer C: Crisp Specular White Spine Highlight */}
        <Path
          d="M 108 148 C 112 170 122 188 130 200 L 158 250"
          stroke="url(#chromeGleam)"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 2. Right-to-Left Stroke of 'X':                                    */}
        {/* Sweeps from upper right (152, 166), crosses center (130, 200),     */}
        {/* and extends straight into the left base anchor at (102, 250).       */}
        {/* Layer A: Wide Neon Glow Aura */}
        <Path
          d="M 152 166 C 148 178 138 190 130 200 L 102 250"
          stroke="#38BDF8"
          strokeWidth="11"
          strokeOpacity="0.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Layer B: Main Luminous Body */}
        <Path
          d="M 152 166 C 148 178 138 190 130 200 L 102 250"
          stroke="url(#standLuminous)"
          strokeWidth="6.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Layer C: Crisp Specular White Spine Highlight */}
        <Path
          d="M 152 166 C 148 178 138 190 130 200 L 102 250"
          stroke="url(#chromeGleam)"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Base Attachment Mounting Anchors (Straight connection into base) */}
        <Circle cx="102" cy="250" r="5" fill="url(#standLuminous)" />
        <Circle cx="102" cy="250" r="2" fill="#FFFFFF" opacity="0.9" />

        <Circle cx="158" cy="250" r="5" fill="url(#standLuminous)" />
        <Circle cx="158" cy="250" r="2" fill="#FFFFFF" opacity="0.9" />

        {/* Central Interlocking Gem (Where the 'X' strokes intersect) */}
        <Circle cx="130" cy="200" r="8" fill="#7E8BFF" opacity="0.5" />
        <Circle cx="130" cy="200" r="5" fill="#38BDF8" />
        <Circle cx="130" cy="200" r="2.2" fill="#FFFFFF" opacity="0.95" />

        {/* ================================================================= */}
        {/* Sculptural Ground Base / Dual Luminous Orbital Rings              */}
        {/* ================================================================= */}
        {/* Outer Base Glow */}
        <Ellipse
          cx="130"
          cy="252"
          rx="54"
          ry="10"
          fill="none"
          stroke="#7E8BFF"
          strokeWidth="6"
          strokeOpacity="0.3"
        />
        {/* Outer Base Rim */}
        <Ellipse
          cx="130"
          cy="252"
          rx="52"
          ry="9"
          fill="none"
          stroke="url(#standLuminous)"
          strokeWidth="4"
        />
        {/* Outer Base Gleam */}
        <Ellipse
          cx="130"
          cy="252"
          rx="52"
          ry="9"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          opacity="0.8"
        />

        {/* Inner Pedestal Hub */}
        <Ellipse
          cx="130"
          cy="251"
          rx="32"
          ry="5.5"
          fill="url(#standLuminous)"
          opacity="0.95"
        />
        <Ellipse
          cx="130"
          cy="250"
          rx="18"
          ry="3"
          fill="#FFFFFF"
          opacity="0.85"
        />
      </Svg>
    </Animated.View>
  );
};

// ===========================================================================
// SUBCOMPONENT: CONTINUOUS SVG WORLD MAP LANDMASSES + PARALLELS
// ===========================================================================
function SvgWorldMap({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 280 124">
      <Defs>
        <SvgLinearGradient id="landmassGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
          <Stop offset="50%" stopColor="#2DD4BF" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0.85" />
        </SvgLinearGradient>

        <SvgLinearGradient id="gridLines" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#76B8FF" stopOpacity="0.2" />
          <Stop offset="50%" stopColor="#76B8FF" stopOpacity="0.45" />
          <Stop offset="100%" stopColor="#76B8FF" stopOpacity="0.2" />
        </SvgLinearGradient>
      </Defs>

      {/* 1. Curved Latitude Parallels */}
      <Path
        d="M 0 25 Q 140 34 280 25"
        stroke="url(#gridLines)"
        strokeWidth="0.8"
        fill="none"
      />
      <Path
        d="M 0 45 Q 140 56 280 45"
        stroke="url(#gridLines)"
        strokeWidth="0.9"
        fill="none"
      />
      {/* Equator */}
      <Path
        d="M 0 62 Q 140 68 280 62"
        stroke="url(#gridLines)"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        fill="none"
      />
      <Path
        d="M 0 82 Q 140 74 280 82"
        stroke="url(#gridLines)"
        strokeWidth="0.9"
        fill="none"
      />
      <Path
        d="M 0 102 Q 140 92 280 102"
        stroke="url(#gridLines)"
        strokeWidth="0.8"
        fill="none"
      />

      {/* 2. Longitude Meridians */}
      <Path
        d="M 35 10 Q 42 62 35 114"
        stroke="url(#gridLines)"
        strokeWidth="0.7"
        fill="none"
      />
      <Path
        d="M 90 10 Q 98 62 90 114"
        stroke="url(#gridLines)"
        strokeWidth="0.7"
        fill="none"
      />
      <Path
        d="M 145 10 Q 155 62 145 114"
        stroke="url(#gridLines)"
        strokeWidth="0.8"
        fill="none"
      />
      <Path
        d="M 200 10 Q 208 62 200 114"
        stroke="url(#gridLines)"
        strokeWidth="0.7"
        fill="none"
      />
      <Path
        d="M 255 10 Q 262 62 255 114"
        stroke="url(#gridLines)"
        strokeWidth="0.7"
        fill="none"
      />

      {/* 3. Continents & Landmass Silhouettes (Accurate Worldwide Outlines) */}
      <G fill="url(#landmassGradient)">
        {/* North America (Alaska, Canada, USA, Mexico, Greenland) */}
        <Path d="M 15 22 Q 22 16 35 18 Q 45 20 42 28 Q 38 34 44 42 Q 40 48 34 46 Q 30 52 24 50 Q 20 44 16 38 Z" />
        {/* Greenland */}
        <Path d="M 52 14 Q 58 12 62 17 Q 60 22 54 21 Z" />
        {/* Central America & Caribbean */}
        <Path d="M 34 50 Q 38 53 37 57 Q 33 55 34 50 Z" />

        {/* South America */}
        <Path d="M 38 60 Q 48 62 52 70 Q 50 82 46 95 Q 40 98 39 88 Q 36 75 38 60 Z" />

        {/* Europe & UK */}
        <Path d="M 78 22 Q 85 20 90 26 Q 88 32 82 34 Q 76 30 78 22 Z" />
        <Path d="M 72 23 Q 75 22 74 27 Q 71 27 72 23 Z" />

        {/* Africa & Madagascar */}
        <Path d="M 78 38 Q 94 36 98 48 Q 99 64 92 80 Q 86 85 82 78 Q 74 62 76 46 Z" />
        <Path d="M 103 66 Q 106 68 104 76 Q 101 75 103 66 Z" />

        {/* Asia, Middle East, India, China, Russia */}
        <Path d="M 94 18 Q 120 14 150 20 Q 165 24 160 38 Q 152 46 142 44 Q 138 38 132 40 Q 125 54 118 56 Q 115 48 110 44 Q 100 42 96 32 Z" />
        {/* India */}
        <Path d="M 118 45 Q 126 48 125 58 Q 120 62 117 54 Z" />
        {/* Japan */}
        <Path d="M 166 32 Q 169 36 167 42 Q 164 40 166 32 Z" />
        {/* Southeast Asia */}
        <Path d="M 136 50 Q 144 52 142 60 Q 135 62 136 50 Z" />
        <Path d="M 144 64 Q 155 66 150 72 Q 142 70 144 64 Z" />

        {/* Australia & New Zealand */}
        <Path d="M 148 76 Q 166 74 172 84 Q 168 96 155 95 Q 146 90 148 76 Z" />
        <Path d="M 178 88 Q 182 90 180 96 Q 176 94 178 88 Z" />

        {/* Antarctica (Polar Ice Base) */}
        <Path d="M 20 114 Q 140 108 260 114 Q 280 120 0 120 Z" opacity="0.8" />
      </G>

      {/* Luminous Telemetry Sparkles / Capital Hub Nodes */}
      <Circle cx="36" cy="34" r="1.5" fill="#FFFFFF" opacity="0.9" />
      <Circle cx="84" cy="27" r="1.5" fill="#FFFFFF" opacity="0.95" />
      <Circle cx="120" cy="50" r="1.6" fill="#FFFFFF" opacity="0.95" />
      <Circle cx="152" cy="36" r="1.5" fill="#FFFFFF" opacity="0.9" />
      <Circle cx="160" cy="84" r="1.4" fill="#FFFFFF" opacity="0.9" />
      <Circle cx="44" cy="74" r="1.4" fill="#FFFFFF" opacity="0.9" />
      <Circle cx="86" cy="56" r="1.4" fill="#FFFFFF" opacity="0.85" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginVertical: 4,
  },
  globePlacement: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#070E20',
    borderWidth: 1.5,
    borderColor: 'rgba(126, 139, 255, 0.6)',
    shadowColor: '#5965F2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  tiltedContainer: {
    width: '100%',
    height: '100%',
    transform: [{ rotate: '-23.5deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  slidingWorldStrip: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  vignetteRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
    borderWidth: 2.5,
    borderColor: 'rgba(9, 16, 36, 0.75)',
  },
  atmosphericHalo: {
    position: 'absolute',
    borderWidth: 1.8,
    borderColor: 'rgba(118, 184, 255, 0.65)',
    backgroundColor: 'transparent',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
});
