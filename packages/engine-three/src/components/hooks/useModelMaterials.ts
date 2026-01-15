import * as THREE from "three";

interface UseModelMaterialsProps {
  modelRef: React.RefObject<THREE.Object3D | null>;
  selected: boolean;
  previewMode: boolean;
}

export function useModelMaterials({
  modelRef,
  selected: _selected,
  previewMode: _previewMode,
}: UseModelMaterialsProps) {
  if (!modelRef.current) return;

  modelRef.current.traverse((child: any) => {
    if (child.isMesh && child.material) {
      // Keep models fully opaque at all times - no transparency effect
      child.material.opacity = 1.0;
      child.material.transparent = false;
    }
  });
}
