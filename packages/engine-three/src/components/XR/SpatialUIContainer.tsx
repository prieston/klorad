"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useXRStore } from "@klorad/core";
import { useSceneStore } from "@klorad/core";
import { SpatialUIContent } from "./SpatialUIContent";
import { calculateContainerPosition } from "./utils/spatialUtils";

interface SpatialUIContainerProps {
  projectId?: string;
}

export const SpatialUIContainer: React.FC<SpatialUIContainerProps> = ({
  projectId,
}) => {
  const containerRef = useRef<THREE.Group>(null);
  const { camera, scene } = useThree();
  const openContainerId = useXRStore((state) => state.openContainerId);
  const closeContainer = useXRStore((state) => state.closeContainer);
  const objects = useSceneStore((state) => state.objects);

  const selectedModel = useMemo(() => {
    if (!openContainerId) return null;
    return objects.find((obj) => obj.id === openContainerId) || null;
  }, [openContainerId, objects]);

  // Find model in scene by traversing and matching userData.modelId
  const modelRef = useMemo(() => {
    if (!selectedModel) return null;
    let found: THREE.Object3D | null = null;
    scene.traverse((object) => {
      if (object.userData.modelId === selectedModel.id) {
        found = object;
      }
    });
    return found;
  }, [selectedModel, scene]);

  const containerPosition = useMemo(() => {
    if (!modelRef || !selectedModel) return null;

    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(modelRef);
    if (box.isEmpty()) {
      // Fallback to model position if no bounds
      return new THREE.Vector3(
        selectedModel.position[0],
        selectedModel.position[1] + 2,
        selectedModel.position[2]
      );
    }

    return calculateContainerPosition(
      new THREE.Vector3(...selectedModel.position),
      box,
      camera.position
    );
  }, [modelRef, selectedModel, camera.position]);

  // Billboard behavior: always face camera
  const cameraWorldPos = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!containerRef.current || !containerPosition) return;

    containerRef.current.position.copy(containerPosition);

    // Use world position for lookAt in XR
    camera.getWorldPosition(cameraWorldPos.current);
    containerRef.current.lookAt(cameraWorldPos.current);
  });

  if (!openContainerId || !selectedModel || !containerPosition) {
    return null;
  }

  const assetId = selectedModel.assetId;
  if (!assetId) {
    return null;
  }

  return (
    <group ref={containerRef} position={containerPosition}>
      <SpatialUIContent
        assetId={assetId}
        projectId={projectId}
        onClose={closeContainer}
      />
    </group>
  );
};
