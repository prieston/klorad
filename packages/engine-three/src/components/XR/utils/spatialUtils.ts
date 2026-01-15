import * as THREE from "three";

/**
 * Calculate container position next to a model
 */
export function calculateContainerPosition(
  modelPosition: THREE.Vector3,
  modelBounds: THREE.Box3,
  cameraPosition: THREE.Vector3,
  offset: number = 1.5
): THREE.Vector3 {
  // Get model center
  const modelCenter = modelBounds.getCenter(new THREE.Vector3());

  // Calculate direction from model to camera
  const direction = new THREE.Vector3()
    .subVectors(cameraPosition, modelCenter)
    .normalize();

  // Set Y to 0 for horizontal offset
  direction.y = 0;
  direction.normalize();

  // Calculate position offset from model center
  const size = modelBounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const totalOffset = maxSize / 2 + offset;

  const containerPosition = modelCenter.clone().add(
    direction.multiplyScalar(totalOffset)
  );

  // Keep container at a reasonable height (slightly above model center)
  containerPosition.y = modelCenter.y + size.y / 2 + 0.5;

  return containerPosition;
}

/**
 * Create a billboard material that always faces the camera
 */
export function createBillboardMaterial(
  color: number = 0xffffff,
  opacity: number = 0.95
): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
    side: THREE.DoubleSide,
  });
}
