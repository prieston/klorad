"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface InteractionRayProps {
  start: THREE.Vector3;
  end: THREE.Vector3 | null;
  isInteractable: boolean;
  hasIntersection?: boolean;
  forward?: THREE.Vector3;
}

export const InteractionRay: React.FC<InteractionRayProps> = ({
  start,
  end,
  isInteractable,
  hasIntersection = false,
  forward,
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const hitPointRef = useRef<THREE.Mesh>(null);
  const positionsRef = useRef<Float32Array | null>(null);

  // Initialize buffer attribute once (2 points = 6 floats)
  useEffect(() => {
    if (lineRef.current) {
      const geometry = lineRef.current.geometry;
      positionsRef.current = new Float32Array(6);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positionsRef.current, 3)
      );
    }
  }, []);

  useFrame(() => {
    if (lineRef.current && positionsRef.current) {
      const geometry = lineRef.current.geometry as THREE.BufferGeometry;

      // Always update line
      // If end is null, project forward using controller direction
      let endPoint: THREE.Vector3;
      if (end) {
        endPoint = end;
      } else if (forward) {
        endPoint = start.clone().add(forward.clone().multiplyScalar(20));
      } else {
        // Fallback: project forward in Z direction
        endPoint = start.clone().add(new THREE.Vector3(0, 0, -20));
      }

      // Update existing array instead of creating new one
      positionsRef.current[0] = start.x;
      positionsRef.current[1] = start.y;
      positionsRef.current[2] = start.z;
      positionsRef.current[3] = endPoint.x;
      positionsRef.current[4] = endPoint.y;
      positionsRef.current[5] = endPoint.z;

      // Mark attribute as needing update
      geometry.attributes.position.needsUpdate = true;
      geometry.setDrawRange(0, 2);
    }

    if (hitPointRef.current) {
      // Only show sphere at actual intersections
      hitPointRef.current.visible = !!(end && hasIntersection);
      if (end && hasIntersection) {
        hitPointRef.current.position.copy(end);
      }
    }
  });

  // Brighter colors for better visibility
  const rayColor = isInteractable ? 0x00ff00 : 0xffffff; // White instead of gray
  const pointColor = isInteractable ? 0x00ff00 : 0xffffff;

  return (
    <>
      {/* Ray line */}
      <line ref={lineRef}>
        <bufferGeometry />
        <lineBasicMaterial
          color={rayColor}
          linewidth={3}
          transparent
          opacity={isInteractable ? 0.9 : 0.8}
        />
      </line>

      {/* Hit point indicator - only show sphere at actual intersections (RIGHT CONTROLLER ONLY) */}
      {end && hasIntersection && (
        <mesh key="right-controller-sphere" ref={hitPointRef} position={end}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial
            color={pointColor}
            transparent
            opacity={isInteractable ? 0.9 : 0.7}
          />
        </mesh>
      )}
    </>
  );
};
