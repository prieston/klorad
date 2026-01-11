import { useRef } from "react";
import * as THREE from "three";

const CLICK_THRESHOLD = 5;

interface UseModelSelectionProps {
  id: string;
  onSelect?: ((id: string, object: THREE.Object3D) => void) | null;
  previewMode: boolean;
}

export const useModelSelection = ({
  id,
  onSelect,
  previewMode,
}: UseModelSelectionProps) => {
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    // Ignore right-click (button 2) and middle-click (button 1)
    if (e.button === 2 || e.button === 1) return;
    if (previewMode || !onSelect) return;
    pointerDown.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: any) => {
    e.stopPropagation();
    // Ignore right-click (button 2) and middle-click (button 1)
    if (e.button === 2 || e.button === 1) return;
    if (previewMode || !onSelect || !pointerDown.current) return;

    const dx = e.clientX - pointerDown.current.x;
    const dy = e.clientY - pointerDown.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If we moved the object significantly, don't handle selection
    if (distance >= CLICK_THRESHOLD) {
      pointerDown.current = null;
      return;
    }

    // Find the model in the object hierarchy
    let currentObject = e.object;
    while (currentObject) {
      if (currentObject.userData.isModel) {
        e.stopPropagation(); // Prevent the click from reaching the background
        onSelect(id, currentObject);
        break;
      }
      if (!currentObject.parent) {
        break;
      }
      currentObject = currentObject.parent;
    }

    pointerDown.current = null;
  };

  return {
    handlePointerDown,
    handlePointerUp,
  };
};
