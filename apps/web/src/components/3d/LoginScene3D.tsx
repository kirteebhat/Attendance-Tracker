import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDocumentVisibility } from "../../utils/webglSupport";

/**
 * Interactive floating VorldX geometric crystal mesh.
 * Smoothly rotates and lerps based on pointer/mouse movement.
 */
function VorldXFloatingCrystal() {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerCageRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();
    const pointer = state.pointer;

    // Smooth lerping towards cursor position (soft parallax)
    const targetRotY = pointer.x * 0.5 + time * 0.2;
    const targetRotX = -pointer.y * 0.35;

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotY,
      Math.min(delta * 3.5, 0.1)
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotX,
      Math.min(delta * 3.5, 0.1)
    );

    // Floating harmonic vertical bob
    groupRef.current.position.y = Math.sin(time * 1.5) * 0.12;

    // Counter-rotation on outer geometric wireframe cage
    if (outerCageRef.current) {
      outerCageRef.current.rotation.y = -time * 0.15;
      outerCageRef.current.rotation.z = time * 0.1;
    }

    // Subtle pulsation on core crystal
    if (coreRef.current) {
      const scale = 1 + Math.sin(time * 2) * 0.03;
      coreRef.current.scale.set(scale, scale, scale);
    }

    // Rotating orbital resonance rings
    if (ringRef.current) {
      ringRef.current.rotation.x = 1.1 + Math.sin(time * 0.5) * 0.1;
      ringRef.current.rotation.y = time * 0.4;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -0.8 + Math.cos(time * 0.5) * 0.1;
      ring2Ref.current.rotation.y = -time * 0.3;
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      {/* 1. Core Faceted Crystal (Icosahedron) */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.2, 0]} />
        <meshStandardMaterial
          color="#0ea5e9"
          emissive="#0369a1"
          emissiveIntensity={0.6}
          roughness={0.25}
          metalness={0.85}
          flatShading
        />
      </mesh>

      {/* 2. Outer Wireframe Cage (Dodecahedron) */}
      <mesh ref={outerCageRef}>
        <dodecahedronGeometry args={[1.65, 0]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#0284c7"
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* 3. Primary Glowing Orbital Ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[2.0, 0.035, 16, 64]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#0891b2"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* 4. Secondary Counter-Orbital Ring */}
      <mesh ref={ring2Ref}>
        <torusGeometry args={[2.2, 0.02, 16, 64]} />
        <meshStandardMaterial
          color="#818cf8"
          emissive="#4f46e5"
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.7}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

interface LoginScene3DProps {
  className?: string;
  size?: number;
}

/**
 * Animated 3D Scene for the VorldX Staff Login Page.
 * - Gentle floating geometry responding to mouse movement.
 * - Pauses automatically when tab is hidden to save GPU and CPU.
 * - Pixel ratio capped to [1, 1.5] for high frame rate and battery life.
 */
export default function LoginScene3D({
  className = "",
  size = 200,
}: LoginScene3DProps) {
  const isTabVisible = useDocumentVisibility();

  return (
    <div
      role="img"
      aria-label="Interactive 3D VorldX security crystal"
      className={`relative select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">
        Interactive 3D rotating VorldX cryptographic crystal responding to cursor movement
      </span>

      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop={isTabVisible ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        className="w-full h-full"
      >
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1.2} color="#ffffff" />
        <pointLight position={[-10, -10, -5]} intensity={0.8} color="#06b6d4" />
        <directionalLight position={[0, 5, 5]} intensity={0.6} color="#818cf8" />

        <VorldXFloatingCrystal />
      </Canvas>
    </div>
  );
}
