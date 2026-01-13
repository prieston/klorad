"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useXRStore } from "@klorad/core";
import { useSceneStore } from "@klorad/core";

export const ModelHighlight: React.FC<{ modelId: string }> = ({ modelId }) => {
  const highlightRef = useRef<THREE.Group>(null);
  const outlineRef = useRef<THREE.Mesh>(null);
  const hoveredModelId = useXRStore((state) => state.hoveredModelId);
  const { scene } = useThree();
  const objects = useSceneStore((state) => state.objects);

  const selectedModel = objects.find((obj) => obj.id === modelId);
  const isHovered = hoveredModelId === modelId;

  // Find model in scene by traversing and matching userData.modelId
  const modelRef = useMemo(() => {
    if (!selectedModel) return null;
    let found: THREE.Object3D | null = null;
    scene.traverse((object) => {
      if (object.userData.modelId === modelId) {
        found = object;
      }
    });
    return found;
  }, [selectedModel, modelId, scene]);

  // Cache model bounds computation
  const { size, center } = useMemo(() => {
    if (!modelRef) return { size: null, center: null };
    const box = new THREE.Box3().setFromObject(modelRef);
    const computedSize = box.getSize(new THREE.Vector3());
    const computedCenter = box.getCenter(new THREE.Vector3());
    return { size: computedSize, center: computedCenter };
  }, [modelRef]);

  useFrame(() => {
    if (!highlightRef.current || !modelRef) return;

    // Update highlight position to match model
    const modelObj = modelRef as THREE.Object3D;
    highlightRef.current.position.copy(modelObj.position);
    highlightRef.current.rotation.copy(modelObj.rotation);
    highlightRef.current.scale.copy(modelObj.scale);

    // Animate outline opacity
    if (outlineRef.current) {
      const material = outlineRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = isHovered ? 0.8 : 0;
    }
  });

  if (!modelRef || !size || !center) {
    return null;
  }

  return (
    <group ref={highlightRef} visible={isHovered}>
      {/* Outline effect using a slightly larger box */}
      <mesh
        ref={outlineRef}
        position={[
          center.x - (modelRef as THREE.Object3D).position.x,
          center.y - (modelRef as THREE.Object3D).position.y,
          center.z - (modelRef as THREE.Object3D).position.z,
        ]}
      >
        <boxGeometry args={[size.x + 0.1, size.y + 0.1, size.z + 0.1]} />
        <meshBasicMaterial
          color={0x00ff00}
          transparent
          opacity={0}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
};
