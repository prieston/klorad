"use client";

import { useRef } from "react";
import * as THREE from "three";

interface GroundPlaneProps {
  size?: number;
}

const GroundPlane: React.FC<GroundPlaneProps> = ({ size = 100000 }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Make the plane receive shadows and be visible
  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      userData={{ isTeleportable: true }}
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color="#2a2a2a"
        metalness={0.1}
        roughness={0.8}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
};

export default GroundPlane;
