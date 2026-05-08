import { SceneControlsConfiguration } from "../scene-controls/sceneControlsConfig";
import {
  createThreeJSSceneControlsConfig,
  createCesiumSceneControlsConfig,
} from "../scene-controls/sceneControlsConfig";
import { getEngine } from "../utils/worldStore";
import { TransformMode } from "../types/topBarConfig";

export const getSceneControlsConfig = (
  selectedObject: any,
  transformMode: TransformMode,
  magnetEnabled: boolean = false,
  worldStoreState?: any
): SceneControlsConfiguration => {
  const engine = getEngine(worldStoreState);

  switch (engine) {
    case "three":
      return createThreeJSSceneControlsConfig(
        selectedObject,
        transformMode,
        magnetEnabled
      );
    case "cesium":
      return createCesiumSceneControlsConfig(selectedObject, transformMode);
    case "mapbox":
      return createCesiumSceneControlsConfig(selectedObject, transformMode);
    default:
      return createThreeJSSceneControlsConfig(
        selectedObject,
        transformMode,
        magnetEnabled
      ); // Default to ThreeJS
  }
};
