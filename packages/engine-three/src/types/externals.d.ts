declare module "three/examples/jsm/loaders/DRACOLoader.js" {
  export class DRACOLoader {
    setDecoderPath(path: string): this;
    dispose(): void;
  }
}

declare module "three/examples/jsm/loaders/KTX2Loader.js" {
  import type { WebGLRenderer } from "three";
  export class KTX2Loader {
    setTranscoderPath(path: string): this;
    detectSupport(renderer: WebGLRenderer): this;
    dispose(): void;
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import type { Group } from "three";
  import type { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
  import type { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

  /** Only what this workspace actually calls. These declarations shadow
   *  @types/three, so anything used here has to be declared here. */
  export interface GLTF {
    scene: Group;
    scenes: Group[];
    animations: unknown[];
    asset: Record<string, unknown>;
  }

  export class GLTFLoader {
    setDRACOLoader(loader: DRACOLoader): this;
    setKTX2Loader(loader: KTX2Loader): this;
    loadAsync(url: string, onProgress?: (e: ProgressEvent) => void): Promise<GLTF>;
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (e: ProgressEvent) => void,
      onError?: (e: unknown) => void,
    ): void;
  }
}

declare module "three/examples/jsm/loaders/3DMLoader.js" {
  export class Rhino3dmLoader {}
}

declare module "3d-tiles-renderer" {
  export class TilesRenderer {
    registerPlugin(plugin: any): void;
    setCamera(camera: any): void;
    setResolutionFromRenderer(camera: any, renderer: any): void;
    update(): void;
    addEventListener(type: string, listener: (...args: any[]) => void): void;
    errorTarget: number;
  }
}

declare module "3d-tiles-renderer/plugins" {
  export class CesiumIonAuthPlugin {
    constructor(options: any);
  }
  export class TilesFadePlugin {
    constructor(options?: any);
  }
  export class TileCompressionPlugin {
    constructor(options?: any);
  }
  export class GLTFExtensionsPlugin {
    constructor(options: any);
  }
}

declare module "@klorad/core/state" {
  export const useSceneStore: any;
  export const useWorldStore: any;
}
