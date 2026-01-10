"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Typography, Box, Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { LockIcon } from "@klorad/ui";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { LoadingScreen } from "@klorad/ui";
import useProject from "@/app/hooks/useProject";
import { signIn } from "next-auth/react";
// eslint-disable-next-line import/extensions
import MobileLayout from "@/app/components/PublishPage/MobileLayout";
// eslint-disable-next-line import/extensions
import DesktopLayout from "@/app/components/PublishPage/DesktopLayout";

const PublishedScenePage = () => {
  const { projectId } = useParams();
  const { project: fetchedProject, loadingProject, error } = useProject(projectId as string);
  const [project, setProject] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const setActiveWorld = useWorldStore((s) => s.setActiveWorld);
  const engine = useWorldStore((s) => s.engine);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Destructure necessary state and actions from the store using selectors
  const previewMode = useSceneStore((state) => state.previewMode);
  const setPreviewMode = useSceneStore((state) => state.setPreviewMode);
  const setObservationPoints = useSceneStore(
    (state) => state.setObservationPoints
  );
  const observationPoints = useSceneStore((state) => state.observationPoints);
  const previewIndex = useSceneStore((state) => state.previewIndex);
  const selectObservation = useSceneStore((state) => state.selectObservation);
  const nextObservation = useSceneStore((state) => state.nextObservation);
  const prevObservation = useSceneStore((state) => state.prevObservation);

  // Enable preview mode and initialize observation points on mount.
  useEffect(() => {
    setPreviewMode(true);

    // Cleanup on unmount
    return () => {
      setPreviewMode(false);
    };
  }, [setPreviewMode]);

  // Initialize project when it loads
  useEffect(() => {
    if (!fetchedProject) return;

    // Check if project is published
    if (!fetchedProject.isPublished) {
      // Project is not published, don't set it
      return;
    }
    setProject(fetchedProject);
    setActiveWorld(fetchedProject);

    // Initialize observation points from project data
    const sceneData = fetchedProject.sceneData as {
      observationPoints?: Array<{ id: string; [key: string]: unknown }>;
      [key: string]: unknown;
    } | null;
    if (sceneData && Array.isArray(sceneData.observationPoints)) {
      setObservationPoints(sceneData.observationPoints as unknown as Parameters<typeof setObservationPoints>[0]);
      // Select the first observation point if available
      if (sceneData.observationPoints.length > 0) {
        const firstPoint = sceneData.observationPoints[0];
        if (firstPoint && typeof firstPoint === 'object' && 'id' in firstPoint) {
          selectObservation(Number(firstPoint.id));
          useSceneStore.setState({ previewIndex: 0 });
        }
      }
    }

    // Initialize objects, selectedAssetId, selectedLocation, basemapType, and cesiumIonAssets
    if (fetchedProject.sceneData && typeof fetchedProject.sceneData === 'object') {
      const sceneData = fetchedProject.sceneData as {
        objects?: unknown[];
        selectedAssetId?: string;
        selectedLocation?: unknown;
        showTiles?: boolean;
        basemapType?: string;
        cesiumIonAssets?: unknown[];
        cesiumLightingEnabled?: boolean;
        cesiumShadowsEnabled?: boolean;
        cesiumCurrentTime?: unknown;
      };
      const {
        objects,
        selectedAssetId,
        selectedLocation,
        showTiles,
        basemapType,
        cesiumIonAssets,
        cesiumLightingEnabled,
        cesiumShadowsEnabled,
        cesiumCurrentTime,
      } = sceneData;

      // Initialize objects (GLB models, etc.)
      if (Array.isArray(objects)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useSceneStore.setState({ objects: objects as any });
      }

      if (selectedAssetId && typeof selectedAssetId === 'string') {
        useSceneStore.setState({
          selectedAssetId,
          showTiles: showTiles ?? false,
        });
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
    }
  }, [fetchedProject, setActiveWorld, setObservationPoints, selectObservation]);

  // Cleanup function to prevent memory leaks on mobile devices
  useEffect(() => {
    return () => {
      setActiveWorld(null);
      // Clear Cesium viewer reference to allow proper cleanup
      const cesiumViewer = useSceneStore.getState().cesiumViewer;
      if (cesiumViewer) {
        try {
          // Clear all entities and primitives before destroying
          cesiumViewer.entities.removeAll();
          cesiumViewer.scene.primitives.removeAll();
          // Destroy viewer if it exists
          if (typeof cesiumViewer.destroy === 'function') {
            cesiumViewer.destroy();
          }
        } catch (cleanupError) {
          console.warn("Error during Cesium cleanup:", cleanupError);
        }
      }
      // Clear scene store state
      useSceneStore.setState({
        cesiumViewer: null,
        observationPoints: [],
        previewIndex: 0,
        objects: [],
        previewMode: false,
      });
    };
  }, [projectId, setObservationPoints, selectObservation, setActiveWorld]);

  if (loadingProject) {
    return <LoadingScreen message="Loading project..." />;
  }

  // Handle error cases
  if (error || (!loadingProject && !fetchedProject)) {
    const errorStatus = (error as { status?: number })?.status;
    const errorMessage = error?.message || "Project not found";
    const isAuthError = errorStatus === 403 || errorStatus === 401 ||
      errorMessage.includes("authentication") || errorMessage.includes("requires authentication");

    return (
      <Box sx={{ p: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <Typography variant="h6" color="error">
          {isAuthError ? "Authentication Required" : "Project Not Available"}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: "center", maxWidth: 500 }}>
          {isAuthError
            ? "This published world requires you to be logged in. Please sign in to view it."
            : "This project is not published or does not exist."}
        </Typography>
        {isAuthError && (
          <Button
            variant="contained"
            onClick={() => signIn(undefined, { callbackUrl: `/publish/${projectId}` })}
            sx={{ mt: 2 }}
          >
            Sign In
          </Button>
        )}
      </Box>
    );
  }

  // Check if project is published
  if (!fetchedProject.isPublished) {
    return (
      <Box sx={{ p: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minHeight: "100vh", justifyContent: "center" }}>
        <LockIcon sx={{ fontSize: 64, color: (theme) => theme.palette.text.secondary, mb: 2, opacity: 0.5 }} />
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}>
          Content Unavailable
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: "center", maxWidth: 600, mb: 3 }}>
          This project has not been published or is currently unavailable. Please contact the project owner or administrator for access.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 600 }}>
          If you believe this is an error, please verify the URL or reach out to support.
        </Typography>
      </Box>
    );
  }

  if (!project) {
    return <LoadingScreen message="Loading project..." />;
  }

  const currentObservation = observationPoints[previewIndex];

  return isMobile ? (
    <MobileLayout
      project={project}
      currentObservation={currentObservation}
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      previewIndex={previewIndex}
      observationPoints={observationPoints}
      nextObservation={nextObservation}
      prevObservation={prevObservation}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projectId={projectId as string}
      engine={engine}
    />
  ) : (
    <DesktopLayout
      project={project}
      currentObservation={currentObservation}
      previewMode={previewMode}
      setPreviewMode={setPreviewMode}
      previewIndex={previewIndex}
      observationPoints={observationPoints}
      nextObservation={nextObservation}
      prevObservation={prevObservation}
      projectId={projectId as string}
      engine={engine}
    />
  );
};

export default PublishedScenePage;
