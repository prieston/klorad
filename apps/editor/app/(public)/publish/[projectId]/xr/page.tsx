"use client";
import PreviewScene from "@/app/components/Builder/Scene/PreviewScene";
import { useSceneStore } from "@klorad/core";
import { LoadingScreen } from "@klorad/ui";
import { Box, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import useProject from "@/app/hooks/useProject";

export default function Scene() {
  const { projectId } = useParams();
  const { project: fetchedProject, loadingProject } = useProject(projectId as string);
  const [project, setProject] = useState(null);

  // Destructure necessary state and actions from the store.
  const { setPreviewMode } = useSceneStore();

  // Enable preview mode on mount.
  useEffect(() => {
    setPreviewMode(true);
  }, [setPreviewMode]);

  // Initialize project when it loads
  useEffect(() => {
    if (!fetchedProject) return;

    if (!fetchedProject.isPublished) {
      throw new Error("Project not published");
    }
    setProject(fetchedProject);

    // Initialize objects, selectedAssetId, selectedLocation, basemapType, and cesiumIonAssets
    if (fetchedProject.sceneData && typeof fetchedProject.sceneData === 'object') {
      const sceneData = fetchedProject.sceneData as {
        objects?: unknown[];
        selectedAssetId?: string;
        selectedLocation?: unknown;
        basemapType?: string;
        cesiumIonAssets?: unknown[];
        cesiumLightingEnabled?: boolean;
        cesiumShadowsEnabled?: boolean;
        cesiumCurrentTime?: unknown;
        gridEnabled?: boolean;
        groundPlaneEnabled?: boolean;
        skyboxType?: "default" | "none";
        ambientLightIntensity?: number;
      };
      const {
        objects,
        selectedAssetId,
        selectedLocation,
        basemapType,
        cesiumIonAssets,
        cesiumLightingEnabled,
        cesiumShadowsEnabled,
        cesiumCurrentTime,
        gridEnabled,
        groundPlaneEnabled,
        skyboxType,
        ambientLightIntensity,
      } = sceneData;

      // Initialize objects (GLB models, etc.)
      if (Array.isArray(objects)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useSceneStore.setState({ objects: objects as any });
      }

          if (selectedAssetId && typeof selectedAssetId === 'string') {
            useSceneStore.setState({ selectedAssetId });
          }
          if (selectedLocation && typeof selectedLocation === 'object' && selectedLocation !== null && 'latitude' in selectedLocation && 'longitude' in selectedLocation) {
            useSceneStore.setState({ selectedLocation: selectedLocation as { latitude: number; longitude: number; altitude?: number } });
          }
          if (basemapType && typeof basemapType === 'string') {
            const validBasemapTypes = ["cesium", "none", "google", "google-photorealistic", "bing"] as const;
            if (validBasemapTypes.includes(basemapType as typeof validBasemapTypes[number])) {
              useSceneStore.setState({ basemapType: basemapType as typeof validBasemapTypes[number] });
            }
          }
          if (Array.isArray(cesiumIonAssets)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            useSceneStore.setState({ cesiumIonAssets: cesiumIonAssets as any });
          }
          // Restore time simulation settings
          if (cesiumLightingEnabled !== undefined) {
            useSceneStore.setState({ cesiumLightingEnabled });
          }
          if (cesiumShadowsEnabled !== undefined) {
            useSceneStore.setState({ cesiumShadowsEnabled });
          }
          if (cesiumCurrentTime !== undefined && cesiumCurrentTime !== null) {
            useSceneStore.setState({ cesiumCurrentTime: String(cesiumCurrentTime) });
          }
          // Restore environment settings
          if (gridEnabled !== undefined) {
            useSceneStore.setState({ gridEnabled });
          }
          if (groundPlaneEnabled !== undefined) {
            useSceneStore.setState({ groundPlaneEnabled });
          }
          if (skyboxType !== undefined) {
            useSceneStore.setState({ skyboxType });
          }
          if (ambientLightIntensity !== undefined) {
            useSceneStore.setState({ ambientLightIntensity });
          }
    }
  }, [fetchedProject]);

  if (loadingProject || !project) {
    return <LoadingScreen message="Loading XR scene..." />;
  }

  if (!project) {
    return (
      <Box sx={{ p: 5 }}>
        <Typography variant="h6">
          Project not found or not published.
        </Typography>
      </Box>
    );
  }
  return (
    <PreviewScene
      initialSceneData={project.sceneData}
      renderObservationPoints={false}
      enableXR={true}
    />
  );
}
