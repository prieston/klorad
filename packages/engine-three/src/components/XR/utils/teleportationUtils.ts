import * as THREE from "three";

// Cache for teleportable meshes keyed by scene UUID
const teleportableMeshesCache = new Map<
  string,
  { meshes: THREE.Mesh[]; timestamp: number }
>();
const CACHE_TTL = 1000; // 1 second cache

/**
 * Get all teleportable meshes from the scene (cached)
 * Cache is invalidated after TTL or when scene UUID changes
 */
export function getTeleportableMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const sceneUuid = scene.uuid;
  const now = Date.now();
  const cached = teleportableMeshesCache.get(sceneUuid);

  // Return cached if still valid
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.meshes;
  }

  // Rebuild cache
  const meshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      object.userData.isTeleportable === true
    ) {
      meshes.push(object);
    }
  });

  // Store in cache
  teleportableMeshesCache.set(sceneUuid, { meshes, timestamp: now });

  return meshes;
}

/**
 * Find ground intersection point along a ray
 * Returns hit point, world normal, and hit object for validation
 */
export function findGroundIntersection(
  raycaster: THREE.Raycaster,
  scene: THREE.Scene,
  maxDistance: number = 50
): {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  hitObject: THREE.Object3D;
} | null {
  // Validate maxDistance
  const clampedMaxDistance = Math.max(0, Math.min(maxDistance, 100));
  raycaster.far = clampedMaxDistance;

  // Get teleportable meshes only (cached)
  const teleportableMeshes = getTeleportableMeshes(scene);

  const intersections = raycaster.intersectObjects(teleportableMeshes, false);

  if (intersections.length > 0) {
    const hit = intersections[0];
    
    // Validate hit point
    if (!hit.point.isFinite()) {
      return null;
    }

    // Get world normal from face
    let normal: THREE.Vector3;
    if (hit.face) {
      normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      // Validate normal
      if (!normal.isFinite() || normal.length() < 0.1) {
        normal = new THREE.Vector3(0, 1, 0); // Fallback to up
      }
      normal.normalize();
    } else {
      normal = new THREE.Vector3(0, 1, 0); // Default to up if no face normal
    }

    return {
      point: hit.point,
      normal,
      hitObject: hit.object,
    };
  }

  // Fallback: intersect with ground plane at y=0 (only if no teleportable meshes found)
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectionPoint = new THREE.Vector3();
  const intersection = raycaster.ray.intersectPlane(
    groundPlane,
    intersectionPoint
  );

  if (intersection && intersectionPoint.isFinite()) {
    return {
      point: intersectionPoint,
      normal: new THREE.Vector3(0, 1, 0),
      hitObject: null as unknown as THREE.Object3D, // No object for plane fallback
    };
  }

  return null;
}

// Teleportation distance constraints
const MIN_TELEPORT_DISTANCE = 0.5; // Minimum 0.5m to prevent teleporting too close
const MAX_TELEPORT_DISTANCE = 50; // Maximum 50m teleportation distance

/**
 * Validate if a teleport location is safe
 * Uses surface normal to check slope (rejects walls/steep surfaces)
 * Also validates distance constraints
 */
export function isValidTeleportLocation(
  position: THREE.Vector3,
  normal: THREE.Vector3,
  hitObject: THREE.Object3D | null,
  startPosition?: THREE.Vector3
): boolean {
  // Validate position
  if (!position.isFinite()) {
    return false;
  }

  // Validate normal
  if (!normal.isFinite() || normal.length() < 0.1) {
    return false;
  }

  // Check distance constraints if start position provided
  if (startPosition && startPosition.isFinite()) {
    const distance = position.distanceTo(startPosition);
    if (distance < MIN_TELEPORT_DISTANCE) {
      return false; // Too close
    }
    if (distance > MAX_TELEPORT_DISTANCE) {
      return false; // Too far
    }
  }

  // Ground plane fallback (hitObject is null) is always valid if position is valid
  if (!hitObject) {
    return true;
  }

  // Check slope: surface normal should be mostly upward (reject walls and steep slopes)
  const worldUp = new THREE.Vector3(0, 1, 0);
  const slopeDot = normal.dot(worldUp);
  const minSlope = 0.7; // ~45 degrees max slope

  if (slopeDot < minSlope) {
    return false; // Too steep or wall
  }

  // Optional: Check for obstacles at player height (only check blocking meshes)
  // For now, skip obstacle check to avoid false rejections
  // TODO: Implement proper blocking mesh list or use layers

  return true;
}
