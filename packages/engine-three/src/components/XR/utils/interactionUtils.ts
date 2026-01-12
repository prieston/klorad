import * as THREE from "three";
import type { Model } from "@klorad/core/src/state/scene-store/types";

// Cache for candidate objects keyed by scene UUID
const candidateObjectsCache = new Map<
  string,
  { objects: THREE.Object3D[]; timestamp: number }
>();
const CACHE_TTL = 2000; // 2 second cache

/**
 * Get cached list of candidate objects for raycasting (interactables + walls)
 * This optimizes performance by avoiding scene traversal every frame
 */
export function getCandidateObjects(scene: THREE.Scene): THREE.Object3D[] {
  const sceneUuid = scene.uuid;
  const now = Date.now();
  const cached = candidateObjectsCache.get(sceneUuid);

  // Return cached if still valid
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.objects;
  }

  // Rebuild cache
  const candidates: THREE.Object3D[] = [];
  scene.traverse((object) => {
    // Include interactable models
    if (object.userData.isModel === true && object.userData.modelId) {
      candidates.push(object);
    }
    // Include walls/obstacles (for occlusion checks)
    if (object.userData.isWall === true || object.userData.isObstacle === true) {
      candidates.push(object);
    }
  });

  // Store in cache
  candidateObjectsCache.set(sceneUuid, { objects: candidates, timestamp: now });

  return candidates;
}

/**
 * Check if an object is a wall or obstacle
 */
export function isWall(object: THREE.Object3D): boolean {
  return (
    object.userData.isWall === true || object.userData.isObstacle === true
  );
}

/**
 * Check if an object is an interactable model
 */
export function isInteractableObject(
  object: THREE.Object3D,
  objects: Model[]
): { model: Model; hitPoint: THREE.Vector3 } | null {
  // Traverse up the hierarchy to find the model
  let currentObject: THREE.Object3D | null = object;
  while (currentObject) {
    if (currentObject.userData.isModel === true) {
      const modelId = currentObject.userData.modelId;
      if (modelId) {
        const model = objects.find((obj) => obj.id === modelId);
        if (model && isModelInteractable(model)) {
          return {
            model,
            hitPoint: currentObject.position.clone(), // Will be replaced by actual hit point
          };
        }
      }
    }
    currentObject = currentObject.parent;
  }
  return null;
}

/**
 * Find the first interactable model hit by a raycaster with occlusion support
 * Returns null if blocked by a wall or no interactable found
 */
export function findInteractableModel(
  raycaster: THREE.Raycaster,
  objects: Model[],
  scene: THREE.Scene
): { model: Model; hitPoint: THREE.Vector3 } | null {
  // Get cached candidate objects (interactables + walls)
  const candidates = getCandidateObjects(scene);

  if (candidates.length === 0) {
    return null;
  }

  // Raycast only against candidate objects (much faster than entire scene)
  const intersections = raycaster.intersectObjects(candidates, false);

  if (intersections.length === 0) {
    return null;
  }

  // Check first hit for occlusion (walls block interaction)
  const firstHit = intersections[0];
  if (isWall(firstHit.object)) {
    // Blocked by wall - no interaction allowed
    return null;
  }

  // Find the model that owns the hit mesh
  const interactableResult = isInteractableObject(firstHit.object, objects);
  if (interactableResult) {
    return {
      model: interactableResult.model,
      hitPoint: firstHit.point,
    };
  }

  return null;
}

/**
 * Check if a model is interactable
 */
export function isModelInteractable(model: Model): boolean {
  return model.interactable === true;
}
