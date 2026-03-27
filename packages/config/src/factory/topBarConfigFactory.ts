import { TopBarConfiguration } from "../types/topBarConfig";
import {
  createThreeJSTopBarConfig,
  createCesiumTopBarConfig,
} from "../top-bar/topBarConfig";
import { getEngine } from "../utils/worldStore";

export const getTopBarConfig = (
  selectedObject: any,
  transformMode: "translate" | "rotate" | "scale",
  onTransformModeChange: (mode: "translate" | "rotate" | "scale") => void,
  onSave?: () => Promise<void>,
  onPublish?: () => void,
  previewMode: boolean = false,
  positioningProps?: {
    selectingPosition: boolean;
    setSelectingPosition: (selecting: boolean) => void;
    selectedPosition: [number, number, number] | null;
    setSelectedPosition: (position: [number, number, number] | null) => void;
    pendingModel: any;
    setPendingModel: (model: any) => void;
  },
  worldStoreState?: any
): TopBarConfiguration => {
  const engine = getEngine(worldStoreState);

  switch (engine) {
    case "three":
      return createThreeJSTopBarConfig(
        selectedObject,
        transformMode,
        onTransformModeChange,
        onSave,
        onPublish,
        previewMode,
        positioningProps
      );
    case "cesium":
      return createCesiumTopBarConfig(
        selectedObject,
        transformMode,
        onTransformModeChange,
        onSave,
        onPublish,
        previewMode,
        positioningProps
      );
    case "mapbox":
      return createCesiumTopBarConfig(
        selectedObject,
        transformMode,
        onTransformModeChange,
        onSave,
        onPublish,
        previewMode,
        positioningProps
      );
    default:
      return createThreeJSTopBarConfig(
        selectedObject,
        transformMode,
        onTransformModeChange,
        onSave,
        onPublish,
        previewMode,
        positioningProps
      ); // Default to ThreeJS
  }
};
