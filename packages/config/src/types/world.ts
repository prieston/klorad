export type Engine = "three" | "cesium" | "mapbox";

export interface World {
  id: string;
  title: string;
  description?: string;
  sceneData: any;
  engine: Engine;
}
