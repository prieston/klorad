import { extend } from "@react-three/fiber";
import * as THREE from "three";

/**
 * `THREE.Line` as a JSX component.
 *
 * why: React Three Fiber v9 deliberately drops `line` from its intrinsic
 * elements (`ThreeElements extends Omit<ThreeElementsImpl, 'audio' | 'source' |
 * 'line' | 'path'>`), because those four names collide with DOM and SVG
 * elements. So `<line ref={someLineRef}>` resolves to the SVG `line` and the ref
 * is typed `Ref<SVGLineElement>`, which is what issue #295 reported.
 *
 * The single-constructor `extend` overload returns a typed component, so this is
 * the renamed-element escape hatch R3F documents for the clash. Shared by the
 * interaction ray and the teleportation arc; neither should call `extend` again.
 */
export const ThreeLine = extend(THREE.Line);
