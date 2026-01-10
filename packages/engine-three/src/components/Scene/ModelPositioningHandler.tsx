"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useSceneStore } from "@klorad/core";
import * as THREE from "three";

const ModelPositioningHandler = () => {
  const { scene, camera, gl } = useThree();
  const selectingPosition = useSceneStore((state) => state.selectingPosition);
  const viewMode = useSceneStore((state) => state.viewMode);
  const onPositionSelected = useSceneStore((state) => state.onPositionSelected);

  // Use ref to store callback to avoid re-attaching event listener on every callback change
  const onPositionSelectedRef = useRef(onPositionSelected);
  useEffect(() => {
    onPositionSelectedRef.current = onPositionSelected;
  }, [onPositionSelected]);

  useEffect(() => {
    if (!selectingPosition) return;
    if (viewMode === "firstPerson") return;
    if (!onPositionSelectedRef.current) return;

    const handleClick = (e: MouseEvent) => {
      if (e.target !== (gl as any).domElement) return;

      // Stop propagation to prevent other handlers from interfering
      e.stopPropagation();

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const rect = (gl as any).domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera as any);

      // Get all meshes in scene
      const meshes: THREE.Object3D[] = [];
      (scene as any).traverse((obj: any) => {
        if ((obj as THREE.Mesh).isMesh) {
          meshes.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        onPositionSelectedRef.current([point.x, point.y, point.z]);
      } else {
        // Fallback: intersect with an invisible ground plane at y=0
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        const intersection = raycaster.ray.intersectPlane(
          groundPlane,
          intersectionPoint
        );

        if (intersection) {
          onPositionSelectedRef.current([
            intersectionPoint.x,
            intersectionPoint.y,
            intersectionPoint.z,
          ]);
        } else {
          // Final fallback: use origin if plane intersection fails
          onPositionSelectedRef.current([0, 0, 0]);
        }
      }
    };

    // Use capture phase to ensure this handler runs before others
    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [selectingPosition, viewMode, scene, camera, gl]);

  return null;
};

export default ModelPositioningHandler;
