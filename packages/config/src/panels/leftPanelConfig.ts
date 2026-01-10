import { ViewInArIcon as ViewInAr, LandscapeIcon as Landscape } from "@klorad/ui";
import { PanelConfiguration } from "../types/panelConfig";

export const createThreeJSLeftPanelConfig = (
  gridEnabled: boolean,
  setGridEnabled: (enabled: boolean) => void,
  groundPlaneEnabled: boolean,
  setGroundPlaneEnabled: (enabled: boolean) => void,
  skyboxType: "default" | "none",
  setSkyboxType: (type: "default" | "none") => void
): PanelConfiguration => {
  return {
    id: "left-panel",
    name: "Left Panel",
    tabs: [
      {
        id: "assets",
        label: "Scene",
        icon: ViewInAr,
        settings: [
          {
            id: "scene-objects",
            type: "custom",
            label: "Scene Objects",
            customComponent: "SceneObjectsList",
          },
        ],
      },
      {
        id: "environment",
        label: "Environment",
        icon: Landscape,
        settings: [
          {
            id: "grid-enabled",
            type: "switch",
            label: "Show Grid",
            description: "Toggle the visibility of the grid helper",
            defaultValue: gridEnabled,
            onChange: (value: boolean) => setGridEnabled(value),
          },
          {
            id: "ground-plane-enabled",
            type: "switch",
            label: "Ground at 0",
            description: "Show a large ground plane at Y=0",
            defaultValue: groundPlaneEnabled,
            onChange: (value: boolean) => setGroundPlaneEnabled(value),
          },
          {
            id: "skybox-type",
            type: "dropdown",
            label: "Skybox Type",
            description: "Choose the type of skybox to display",
            defaultValue: skyboxType,
            options: [
              { value: "default", label: "Default Sky" },
              { value: "none", label: "No Sky" },
            ],
            onChange: (value: "default" | "none") => setSkyboxType(value),
          },
        ],
      },
    ],
  };
};

export const createCesiumLeftPanelConfig = (
  gridEnabled: boolean,
  setGridEnabled: (enabled: boolean) => void,
  skyboxType: "default" | "none",
  setSkyboxType: (type: "default" | "none") => void,
  ambientLightIntensity: number,
  setAmbientLightIntensity: (intensity: number) => void,
  basemapType: "cesium" | "google" | "google-photorealistic" | "bing" | "none",
  setBasemapType: (
    type: "cesium" | "google" | "google-photorealistic" | "bing" | "none"
  ) => void
): PanelConfiguration => {
  return {
    id: "left-panel",
    name: "Left Panel",
    tabs: [
      {
        id: "assets",
        label: "Scene",
        icon: ViewInAr,
        settings: [
          {
            id: "scene-objects",
            type: "custom",
            label: "Scene Objects",
            customComponent: "SceneObjectsList",
          },
        ],
      },
      {
        id: "environment",
        label: "Environment",
        icon: Landscape,
        settings: [
          {
            id: "location-search",
            type: "custom",
            label: "Location & Tiles",
            customComponent: "CesiumLocationSearchSection",
          },
          {
            id: "basemap-selector",
            type: "custom",
            label: "Basemap",
            customComponent: "CesiumBasemapSelector",
            customProps: {
              onBasemapChange: setBasemapType,
              currentBasemap: basemapType,
            },
          },
          {
            id: "datetime-selector",
            type: "custom",
            label: "Date & Time",
            customComponent: "CesiumDateTimeSelector",
          },
        ],
      },
    ],
  };
};
