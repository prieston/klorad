"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface TeleportationArcProps {
  start: THREE.Vector3;
  end: THREE.Vector3 | null;
  isValid: boolean;
  hasIntersection?: boolean;
  segments?: number;
}

export const TeleportationArc: React.FC<TeleportationArcProps> = ({
  start,
  end,
  isValid,
  hasIntersection = false,
  segments = 50,
}) => {
  const lineRef = useRef<THREE.Line>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const positionsRef = useRef<Float32Array | null>(null);
  const maxSegments = segments;

  // Initialize buffer attribute once
  useEffect(() => {
    if (lineRef.current) {
      const geometry = lineRef.current.geometry;
      const bufferSize = maxSegments * 3;
      positionsRef.current = new Float32Array(bufferSize);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positionsRef.current, 3)
      );
    }
  }, [maxSegments]);

  // Calculate arc points
  const arcPoints = useMemo(() => {
    if (!end) return [];

    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();

    // Create a smooth arc using quadratic bezier curve
    const midPoint = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5);
    midPoint.y = Math.max(start.y, end.y) + distance * 0.3; // Arc height

    const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
    const curvePoints = curve.getPoints(segments);

    return curvePoints;
  }, [start, end, segments]);

  // Update line geometry using persistent buffer
  useFrame(() => {
    if (lineRef.current && positionsRef.current) {
      const geometry = lineRef.current.geometry as THREE.BufferGeometry;

      if (arcPoints.length > 0) {
        // Update existing array instead of creating new one
        arcPoints.forEach((point, i) => {
          if (i * 3 + 2 < positionsRef.current!.length) {
            positionsRef.current![i * 3] = point.x;
            positionsRef.current![i * 3 + 1] = point.y;
            positionsRef.current![i * 3 + 2] = point.z;
          }
        });

        // Mark attribute as needing update
        geometry.attributes.position.needsUpdate = true;
        geometry.setDrawRange(0, arcPoints.length);
        geometry.computeBoundingSphere();
      } else {
        // Hide line if no points
        geometry.setDrawRange(0, 0);
      }
    }

    // Update ring indicator - only when mesh is actually rendered
    if (ringRef.current && end && hasIntersection) {
      ringRef.current.position.copy(end);
      // Raise the circle 0.05m above the ground intersection point
      ringRef.current.position.y += 0.05;
      ringRef.current.visible = true;
    } else if (ringRef.current) {
      ringRef.current.visible = false;
    }
  });

  const lineColor = isValid ? 0x00ff00 : 0xff0000;
  const pointColor = isValid ? 0x00ff00 : 0xff0000;

  return (
    <>
      {/* Arc line */}
      <line ref={lineRef}>
        <bufferGeometry />
        <lineBasicMaterial
          color={lineColor}
          linewidth={3}
          transparent
          opacity={isValid ? 0.8 : 0.5}
        />
      </line>

      {/* Ring indicator - only show when there's an actual intersection (LEFT CONTROLLER ONLY - NO SPHERE) */}
      {end && hasIntersection && (
        <mesh
          key="left-controller-ring"
          ref={ringRef}
          position={end}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.2, 0.3, 32]} />
          <meshBasicMaterial
            color={pointColor}
            transparent
            opacity={isValid ? 0.9 : 0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </>
  );
};
