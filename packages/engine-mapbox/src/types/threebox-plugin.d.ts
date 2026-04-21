/** Loaded via `import()` inside `loadThreeboxBundle()` only (SSR-safe). Sets `window.Threebox`. */
declare module "threebox-plugin/dist/threebox.js";

declare module "threebox-plugin" {
  import type { Map as MapboxMap } from "mapbox-gl";

  export type ThreeboxLoadObjOptions = {
    obj: string;
    type: "gltf" | "glb" | string;
    scale?: { x: number; y: number; z: number } | number;
    units?: string;
    rotation?: { x?: number; y?: number; z?: number };
    [key: string]: unknown;
  };

  export type ThreeboxObject3D = {
    setCoords(lngLat: number[] | [number, number, number]): unknown;
    setRotation(rot: { x?: number; y?: number; z?: number } | number): unknown;
    model?: { scale: { set(x: number, y: number, z: number): void } };
    uuid: string;
    dispose?: () => void;
  };

  export class Threebox {
    constructor(
      map: MapboxMap,
      gl: WebGLRenderingContext,
      options?: { defaultLights?: boolean; [key: string]: unknown }
    );

    loadObj(
      options: ThreeboxLoadObjOptions,
      cb: (model: ThreeboxObject3D) => void
    ): void;

    add(obj: ThreeboxObject3D, layerId?: string, sourceId?: string): void;
    remove(obj: ThreeboxObject3D): void;
    update(): void;
    clear(
      layerId?: string | null,
      dispose?: boolean
    ): Promise<unknown> | Promise<void>;

    map: MapboxMap;
  }
}
