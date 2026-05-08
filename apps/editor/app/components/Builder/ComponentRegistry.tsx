"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  ViewModeControls,
  PlaybackControls,
  BottomPanelControls,
  BasemapSelector,
  ObservationPointsList,
} from "@klorad/ui";
import SceneObjectsListWrapper from "../Builder/lists/SceneObjectsListWrapper";
import PropertiesPanel from "../Builder/properties/PropertiesPanel";
import AssetLibraryPanel from "../Builder/assets/AssetLibraryPanel";
import LogoHeader from "../AppBar/LogoHeader";
import ReportGenerator from "../Report/ReportGenerator";
import BuilderActions from "../AppBar/BuilderActions";
// Import directly from component file to avoid pulling in 3d-tiles-renderer via barrel exports
// Component is a default export, so use default import syntax
import ThreeJSLocationSearchSection from "@klorad/engine-three/components/ThreeJSLocationSearchSection";
import {
  CesiumLocationSearchSection,
  CesiumBasemapSelector,
  CesiumDateTimeSelector,
  CesiumIonAssetsManager,
} from "@klorad/engine-cesium/components";
import {
  CesiumViewModeControls,
  CesiumCameraSettings,
  CesiumSimulationInstructions,
} from "@klorad/engine-cesium/components";
import {
  MapboxEnvironmentSection,
} from "@klorad/engine-mapbox/components";

export type AnyComponent = React.ComponentType<any>; // intentionally permissive

export const componentRegistry: Record<string, AnyComponent> = {
  ViewModeControls: ViewModeControls,
  PlaybackControls: PlaybackControls,
  BottomPanelControls: BottomPanelControls,
  ObservationPointsList: ObservationPointsList,
  SceneObjectsList: SceneObjectsListWrapper,
  LocationSearchSection: ThreeJSLocationSearchSection,
  PropertiesPanel: PropertiesPanel,
  AssetLibraryPanel: AssetLibraryPanel,
  LogoHeader: LogoHeader,
  ReportGenerator: ReportGenerator,
  BuilderActions: BuilderActions,
  BasemapSelector: BasemapSelector,
  ThreeJSLocationSearchSection: ThreeJSLocationSearchSection,
  CesiumLocationSearchSection: CesiumLocationSearchSection,
  CesiumBasemapSelector: CesiumBasemapSelector,
  CesiumDateTimeSelector: CesiumDateTimeSelector,
  CesiumIonAssetsManager: CesiumIonAssetsManager,
  CesiumViewModeControls: CesiumViewModeControls,
  CesiumCameraSettings: CesiumCameraSettings,
  CesiumSimulationInstructions: CesiumSimulationInstructions,
  MapboxEnvironmentSection: MapboxEnvironmentSection,
};

export const getComponent = (componentName: string): AnyComponent | null => {
  const component = componentRegistry[componentName] || null;
  return component;
};
