"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import AdminLayout from "@/app/components/Builder/AdminLayout";
import SceneCanvas from "@/app/components/Builder/Scene/SceneCanvas";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { showToast } from "@klorad/ui";
import { updateProjectScene, publishProject, getModel } from "@/app/utils/api";
import { extractTransformFromMetadata } from "@klorad/engine-cesium";
import useProject from "@/app/hooks/useProject";

// Function to sanitize scene data before saving
const sanitizeSceneData = (
  objects,
  observationPoints,
  selectedAssetId,
  selectedLocation,
  showTiles,
  basemapType,
  cesiumIonAssets,
  cesiumLightingEnabled,
  cesiumShadowsEnabled,
  cesiumCurrentTime,
  gridEnabled,
  groundPlaneEnabled,
  skyboxType,
  ambientLightIntensity
) => {
  // Ensure we have valid arrays to work with
  const safeObjects = Array.isArray(objects) ? objects : [];
  const safeObservationPoints = Array.isArray(observationPoints)
    ? observationPoints
    : [];

  // Clean up objects by removing any undefined or null values
  // and removing any circular references (like refs)
  const cleanObjects = safeObjects
    .map((obj) => {
      if (!obj) return null;

      // Remove any circular references and undefined values
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ref, ...rest } = obj;

      // Base object properties
      const cleanObj: any = {
        id: rest.id || "",
        name: rest.name || "",
        url: rest.url || "",
        type: rest.type || "model",
        position: rest.position || [0, 0, 0],
        rotation: rest.rotation || [0, 0, 0],
        scale: rest.scale || [1, 1, 1],
        assetId: rest.assetId || undefined,
        apiKey: rest.apiKey || undefined,
        component: rest.component || undefined,
        cesiumAssetId: rest.cesiumAssetId || undefined, // Include cesiumAssetId for matching
      };

      // Include observation model data if present
      if (rest.isObservationModel !== undefined) {
        cleanObj.isObservationModel = rest.isObservationModel;
      }

      if (rest.observationProperties) {
        cleanObj.observationProperties = {
          // Sensor Configuration
          sensorType: rest.observationProperties.sensorType || "cone",
          fov: rest.observationProperties.fov || 60,
          fovH: rest.observationProperties.fovH,
          fovV: rest.observationProperties.fovV,
          visibilityRadius: rest.observationProperties.visibilityRadius || 500,

          // Visualization Options
          showSensorGeometry:
            rest.observationProperties.showSensorGeometry !== undefined
              ? rest.observationProperties.showSensorGeometry
              : true,
          showViewshed:
            rest.observationProperties.showViewshed !== undefined
              ? rest.observationProperties.showViewshed
              : false,
          // Use theme success color (softer green) instead of pure green
          sensorColor: rest.observationProperties.sensorColor || "#22c55e",
          viewshedColor: rest.observationProperties.viewshedColor || "#0080ff",

          // Analysis Options
          analysisQuality:
            rest.observationProperties.analysisQuality || "medium",
          raysAzimuth: rest.observationProperties.raysAzimuth,
          raysElevation: rest.observationProperties.raysElevation,
          clearance: rest.observationProperties.clearance,
          stepCount: rest.observationProperties.stepCount,

          // Transform Editor
          enableTransformEditor:
            rest.observationProperties.enableTransformEditor !== undefined
              ? rest.observationProperties.enableTransformEditor
              : true,

          // Model Direction
          alignWithModelFront:
            rest.observationProperties.alignWithModelFront !== undefined
              ? rest.observationProperties.alignWithModelFront
              : false,
          manualFrontDirection: rest.observationProperties.manualFrontDirection,

          // Additional Ion SDK properties
          include3DModels: rest.observationProperties.include3DModels,
          modelFrontAxis: rest.observationProperties.modelFrontAxis,
          sensorForwardAxis: rest.observationProperties.sensorForwardAxis,
          tiltDeg: rest.observationProperties.tiltDeg,
        };
      }

      // Include IoT configuration if present
      if (rest.iotProperties) {
        cleanObj.iotProperties = {
          enabled:
            rest.iotProperties.enabled !== undefined
              ? rest.iotProperties.enabled
              : false,
          serviceType: rest.iotProperties.serviceType || "weather",
          apiEndpoint:
            rest.iotProperties.apiEndpoint ||
            "https://api.open-meteo.com/v1/forecast",
          updateInterval: rest.iotProperties.updateInterval || 300000,
          showInScene:
            rest.iotProperties.showInScene !== undefined
              ? rest.iotProperties.showInScene
              : true,
          displayFormat: rest.iotProperties.displayFormat || "compact",
          autoRefresh:
            rest.iotProperties.autoRefresh !== undefined
              ? rest.iotProperties.autoRefresh
              : true,
        };
      }

      // Note: weatherData is transient IoT data and should not be saved to projects
      // It will be fetched fresh when IoT is enabled

      return cleanObj;
    })
    .filter(Boolean);

  // Clean up observation points
  const cleanObservationPoints = safeObservationPoints
    .map((point) => {
      if (!point) return null;

      // Handle position and target data
      let position = null;
      let target = null;

      if (point.position) {
        // If position is already an array, use it directly
        if (Array.isArray(point.position)) {
          position = point.position;
        }
        // If position is a Vector3, convert to array
        else if (point.position.x !== undefined) {
          position = [point.position.x, point.position.y, point.position.z];
        }
      }

      if (point.target) {
        // If target is already an array, use it directly
        if (Array.isArray(point.target)) {
          target = point.target;
        }
        // If target is a Vector3, convert to array
        else if (point.target.x !== undefined) {
          target = [point.target.x, point.target.y, point.target.z];
        }
      }

      return {
        id: point.id || 0,
        title: point.title || "",
        description: point.description || "",
        position,
        target,
      };
    })
    .filter(Boolean);

  // Clean up selected location
  const cleanSelectedLocation = selectedLocation
    ? {
        latitude: selectedLocation.latitude || 0,
        longitude: selectedLocation.longitude || 0,
      }
    : null;

  // Deduplicate cesiumIonAssets by assetId (Cesium Ion asset ID, not name)
  // Having the same Cesium Ion asset ID multiple times causes duplicate tilesets to load
  // Keep the entry with transform if duplicates exist (more complete data)
  const cleanCesiumIonAssets = Array.isArray(cesiumIonAssets)
    ? (() => {
        const seen = new Map<string, any>();
        // Process in reverse to keep the last occurrence of each assetId
        for (let i = cesiumIonAssets.length - 1; i >= 0; i--) {
          const asset = cesiumIonAssets[i] as any;
          if (!asset || !asset.assetId) continue;
          const assetId = String(asset.assetId);
          // Only keep if we haven't seen this assetId yet, or if this one has a transform (more complete)
          if (!seen.has(assetId) || asset.transform) {
            seen.set(assetId, asset);
          }
        }
        // Return in original order, but deduplicated
        const deduplicated: any[] = [];
        const added = new Set<string>();
        for (const asset of cesiumIonAssets) {
          const assetId = String((asset as any)?.assetId);
          if (assetId && !added.has(assetId) && seen.has(assetId)) {
            deduplicated.push(seen.get(assetId));
            added.add(assetId);
          }
        }
        return deduplicated;
      })()
    : [];

  return {
    objects: cleanObjects,
    observationPoints: cleanObservationPoints,
    selectedAssetId: selectedAssetId || "2275207",
    selectedLocation: cleanSelectedLocation,
    showTiles,
    basemapType: basemapType || "cesium",
    cesiumIonAssets: cleanCesiumIonAssets,
    cesiumLightingEnabled: cesiumLightingEnabled || false,
    cesiumShadowsEnabled: cesiumShadowsEnabled || false,
    cesiumCurrentTime: cesiumCurrentTime || null,
    gridEnabled: gridEnabled !== undefined ? gridEnabled : true,
    groundPlaneEnabled: groundPlaneEnabled !== undefined ? groundPlaneEnabled : false,
    skyboxType: skyboxType || "default",
    ambientLightIntensity: ambientLightIntensity !== undefined ? ambientLightIntensity : 0.5,
  };
};

export default function BuilderPage() {
  const { projectId } = useParams();
  const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
  const {
    project: fetchedProject,
    loadingProject,
    mutate: mutateProject,
  } = useProject(projectIdStr);
  const [project, setProject] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const setActiveWorld = useWorldStore((s) => s.setActiveWorld);

  // Get scene data and actions from store
  const setObjects = useSceneStore((state) => state.setObjects);
  const setObservationPoints = useSceneStore(
    (state) => state.setObservationPoints
  );

  // Initialize scene when project loads
  useEffect(() => {
    if (!fetchedProject) return;

    const initializeProject = async () => {
      try {
        // Reset scene state first
        useSceneStore.getState().resetScene();

        setProject(fetchedProject);
        setActiveWorld(fetchedProject);

        // Initialize scene data from project
        if (
          fetchedProject?.sceneData &&
          typeof fetchedProject.sceneData === "object"
        ) {
          const sceneData = fetchedProject.sceneData as {
            objects?: unknown[];
            observationPoints?: unknown[];
            selectedAssetId?: string;
            selectedLocation?: unknown;
            showTiles?: boolean;
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
            observationPoints,
            selectedAssetId,
            selectedLocation,
            showTiles,
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

          if (Array.isArray(objects)) {
            // Restore objects with all their properties including observation model data
            setObjects(objects as Parameters<typeof setObjects>[0]);
          }
          if (Array.isArray(observationPoints)) {
            setObservationPoints(
              observationPoints as Parameters<typeof setObservationPoints>[0]
            );
          }
          if (selectedAssetId && typeof selectedAssetId === "string") {
            useSceneStore.setState({
              selectedAssetId,
              showTiles: showTiles ?? false,
            });
          }
          if (
            selectedLocation &&
            typeof selectedLocation === "object" &&
            selectedLocation !== null &&
            "latitude" in selectedLocation &&
            "longitude" in selectedLocation
          ) {
            useSceneStore.setState({
              selectedLocation: selectedLocation as {
                latitude: number;
                longitude: number;
                altitude?: number;
              },
            });
          }
          if (basemapType && typeof basemapType === "string") {
            const validBasemapTypes = [
              "cesium",
              "none",
              "google",
              "google-photorealistic",
              "bing",
            ] as const;
            if (
              validBasemapTypes.includes(
                basemapType as (typeof validBasemapTypes)[number]
              )
            ) {
              useSceneStore.setState({
                basemapType: basemapType as (typeof validBasemapTypes)[number],
              });
            }
          }
          if (Array.isArray(cesiumIonAssets)) {
            // First deduplicate by assetId (Cesium Ion asset ID, not name)
            // Having the same Cesium Ion asset ID multiple times causes duplicate tilesets
            // Keep the entry with transform if duplicates exist (more complete data)
            const deduplicatedAssets = (() => {
              const seen = new Map<string, any>();
              for (let i = cesiumIonAssets.length - 1; i >= 0; i--) {
                const asset = cesiumIonAssets[i] as any;
                if (!asset || !asset.assetId) continue;
                const assetId = String(asset.assetId);
                // Keep if we haven't seen this assetId, or if this one has a transform (more complete)
                if (!seen.has(assetId) || asset.transform) {
                  seen.set(assetId, asset);
                }
              }
              // Return in original order, but deduplicated
              const result: any[] = [];
              const added = new Set<string>();
              for (const asset of cesiumIonAssets) {
                const assetId = String((asset as any)?.assetId);
                if (assetId && !added.has(assetId) && seen.has(assetId)) {
                  result.push(seen.get(assetId));
                  added.add(assetId);
                }
              }
              return result;
            })();

            // Fetch metadata and extract transforms for cesiumIonAssets
            // The saved scene data doesn't include metadata, so we need to fetch it
            const enrichedAssets = await Promise.all(
              deduplicatedAssets.map(async (asset) => {
                // Try to find the database assetId from the objects array
                // Objects have assetId (database ID) and cesiumAssetId (Ion ID)
                // cesiumIonAsset.assetId is the Cesium Ion asset ID (not database ID)
                const assetIdString = String(asset.assetId);

                // First try to match by cesiumAssetId
                let matchingObject = Array.isArray(objects)
                  ? (objects as any[]).find(
                      (obj) =>
                        obj.type === "cesium-ion-tileset" &&
                        obj.cesiumAssetId != null &&
                        String(obj.cesiumAssetId) === assetIdString
                    )
                  : null;

                // Fallback: match by name if cesiumAssetId matching failed
                // This handles cases where objects were saved before cesiumAssetId was added
                if (!matchingObject) {
                  matchingObject = Array.isArray(objects)
                    ? (objects as any[]).find(
                        (obj) =>
                          obj.type === "cesium-ion-tileset" &&
                          obj.name === asset.name
                      )
                    : null;
                }

                const databaseAssetId = matchingObject?.assetId;

                // Try to fetch metadata if we have a database assetId
                let transform = asset.transform; // Keep existing transform if present
                if (!transform && databaseAssetId) {
                  try {
                    const fetchedAsset = await getModel(databaseAssetId);
                    const metadata = fetchedAsset.asset?.metadata as
                      | Record<string, unknown>
                      | undefined;
                    const extractedTransform =
                      extractTransformFromMetadata(metadata);

                    if (extractedTransform) {
                      transform = extractedTransform;
                    }
                  } catch (err) {
                    console.warn(
                      "[BuilderPage] Failed to fetch metadata for asset:",
                      databaseAssetId,
                      err
                    );
                    // Continue without transform if fetch fails
                  }
                }

                return {
                  ...asset,
                  transform,
                };
              })
            );

            // Filter out assets that failed to load (will be caught by error handler in CesiumIonAssetsRenderer)
            // We keep them here but they'll fail to load and be logged
            const validAssets = enrichedAssets.filter((asset) => {
              if (!asset || !asset.assetId) return false;
              // Keep all assets - let CesiumIonAssetsRenderer handle 404 errors
              return true;
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            useSceneStore.setState({ cesiumIonAssets: validAssets as any });
          }
          // Restore time simulation settings
          if (cesiumLightingEnabled !== undefined) {
            useSceneStore.setState({ cesiumLightingEnabled });
          }
          if (cesiumShadowsEnabled !== undefined) {
            useSceneStore.setState({ cesiumShadowsEnabled });
          }
          if (cesiumCurrentTime !== undefined && cesiumCurrentTime !== null) {
            useSceneStore.setState({
              cesiumCurrentTime: String(cesiumCurrentTime),
            });
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
      } catch (error) {
        console.error("Error initializing project:", error);
        showToast("Error loading project");
      }
    };

    initializeProject();

    return () => setActiveWorld(null);
  }, [fetchedProject, setObjects, setObservationPoints, setActiveWorld]);

  // Save handler
  const handleSave = async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);

      // Get the current state from the store
      const storeState = useSceneStore.getState();

      // Sanitize the scene data
      const sceneData = sanitizeSceneData(
        storeState.objects,
        storeState.observationPoints,
        storeState.selectedAssetId,
        storeState.selectedLocation,
        storeState.showTiles,
        storeState.basemapType,
        storeState.cesiumIonAssets,
        storeState.cesiumLightingEnabled,
        storeState.cesiumShadowsEnabled,
        storeState.cesiumCurrentTime,
        storeState.gridEnabled,
        storeState.groundPlaneEnabled,
        storeState.skyboxType,
        storeState.ambientLightIntensity
      );

      await updateProjectScene(projectIdStr, sceneData);

      showToast("Project saved successfully", "info");
    } catch (error) {
      console.error("Error saving project:", error);
      showToast(error.message || "Failed to save project", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Publish handler
  const handlePublish = async () => {
    try {
      await publishProject(projectIdStr);
      showToast("Project published successfully!");

      // Open the published world in a new window
      window.open(`/publish/${projectId}`, "_blank");
    } catch (error) {
      console.error("Error publishing project:", error);
      showToast(error.message || "Error publishing project");
    }
  };

  if (loadingProject) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const handleThumbnailUpdate = () => {
    mutateProject(); // Refresh project data to get updated thumbnail
  };

  return (
    <AdminLayout
      onSave={handleSave}
      onPublish={handlePublish}
      projectId={projectIdStr}
      projectThumbnail={project?.thumbnail || null}
      onThumbnailUpdate={handleThumbnailUpdate}
    >
      <SceneCanvas
        initialSceneData={project?.sceneData}
        renderObservationPoints={true}
      />
    </AdminLayout>
  );
}
