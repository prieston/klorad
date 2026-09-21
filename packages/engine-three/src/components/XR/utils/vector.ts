import * as THREE from "three";

/**
 * True when every component of the vector is a finite number.
 *
 * The XR controllers call this before trusting a raycast result, a controller
 * world position or a teleport target: a NaN or an Infinity from a degenerate
 * matrix propagates silently through three's maths and ends up as an invisible
 * or mislocated object.
 *
 * why: this used to be written as `vec.isFinite()`. three's Vector3 has no such
 * method and never has, so every one of those guards threw a TypeError at
 * runtime rather than returning false (issue #295).
 */
export function isFiniteVector3(vector: THREE.Vector3): boolean {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}
