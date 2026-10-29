import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDocumentVisibility } from "../../utils/webglSupport";

interface AttendanceOrbMeshProps {
  attendanceRate: number;
}

/**
 * 3D Attendance Orb with layered gimbal rings and orbital satellite.
 * Visual properties (color, spin rate, glow intensity) map dynamically to the real attendance percentage.
 */
function AttendanceOrbMesh({ attendanceRate }: AttendanceOrbMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);

  const normalizedRate = Math.max(0, Math.min(100, attendanceRate));

  // Dynamic color palette based on attendance percentage
  const theme = useMemo(() => {
    if (normalizedRate >= 80) {
      return {
        coreColor: "#10b981", // Emerald
        coreEmissive: "#059669",
        ringColor: "#34d399",
        ringEmissive: "#10b981",
        speedMultiplier: 1.2,
        glowIntensity: 0.8,
      };
    } else if (normalizedRate >= 60) {
      return {
        coreColor: "#f59e0b", // Amber
        coreEmissive: "#d97706",
        ringColor: "#fbbf24",
        ringEmissive: "#f59e0b",
        speedMultiplier: 1.0,
        glowIntensity: 0.65,
      };
    } else {
      return {
        coreColor: "#f43f5e", // Rose
        coreEmissive: "#e11d48",
        ringColor: "#fb7185",
        ringEmissive: "#f43f5e",
        speedMultiplier: 0.8,
        glowIntensity: 0.5,
      };
    }
  }, [normalizedRate]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const pointer = state.pointer;

    // Soft mouse tilt / parallax
    const targetY = pointer.x * 0.45;
    const targetX = -pointer.y * 0.35;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY + time * 0.15 * theme.speedMultiplier,
      Math.min(delta * 4, 0.1)
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX,
      Math.min(delta * 4, 0.1)
    );

    // Inner core breathing pulsation
    if (coreRef.current) {
      const pulse = 1 + Math.sin(time * 2.5 * theme.speedMultiplier) * 0.05;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    // Layer 1: Inclined equatorial attendance ring
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = time * 0.5 * theme.speedMultiplier;
    }

    // Layer 2: Counter-rotating outer gimbal ring
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = time * -0.4 * theme.speedMultiplier;
      ring2Ref.current.rotation.y = time * 0.3 * theme.speedMultiplier;
    }

    // Orbiting Satellite Beacon
    if (satelliteRef.current) {
      const orbitAngle = time * 1.4 * theme.speedMultiplier;
      const orbitRadius = 1.65;
      satelliteRef.current.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        Math.sin(orbitAngle * 0.8) * 0.5,
        Math.sin(orbitAngle) * orbitRadius
      );
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      {/* 1. Central Glowing Attendance Orb */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshStandardMaterial
          color={theme.coreColor}
          emissive={theme.coreEmissive}
          emissiveIntensity={theme.glowIntensity}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* 2. Primary Tilted Orbital Ring */}
      <mesh ref={ring1Ref} rotation={[1.1, 0.2, 0]}>
        <torusGeometry args={[1.35, 0.045, 16, 64]} />
        <meshStandardMaterial
          color={theme.ringColor}
          emissive={theme.ringEmissive}
          emissiveIntensity={theme.glowIntensity * 0.9}
          roughness={0.15}
          metalness={0.85}
        />
      </mesh>

      {/* 3. Layered Outer Gimbal Ring */}
      <mesh ref={ring2Ref} rotation={[-0.7, 0.8, 0]}>
        <torusGeometry args={[1.5, 0.025, 16, 64]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.7}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* 4. Orbiting Satellite Node */}
      <mesh ref={satelliteRef}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={theme.ringColor}
          emissiveIntensity={1.2}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}

interface AttendanceOrb3DProps {
  attendanceRate: number;
  size?: number;
  className?: string;
}

/**
 * 3D Attendance Hero Orb component for Dashboard.
 * Pauses automatically when tab is hidden and caps pixel ratio for performance.
 */
export default function AttendanceOrb3D({
  attendanceRate,
  size = 64,
  className = "",
}: AttendanceOrb3DProps) {
  const isTabVisible = useDocumentVisibility();

  return (
    <div
      role="img"
      aria-label={`Interactive 3D attendance orb: ${attendanceRate}% presence`}
      className={`relative select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">
        Interactive 3D glowing attendance orb reflecting {attendanceRate}% daily workforce presence
      </span>

      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 42 }}
        dpr={[1, 1.5]}
        frameloop={isTabVisible ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="w-full h-full"
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[6, 6, 6]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-6, -6, -4]} intensity={0.9} color="#38bdf8" />
        <directionalLight position={[0, 4, 4]} intensity={0.7} color="#ffffff" />

        <AttendanceOrbMesh attendanceRate={attendanceRate} />
      </Canvas>
    </div>
  );
}
