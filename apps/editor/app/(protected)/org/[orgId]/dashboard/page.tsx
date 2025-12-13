"use client";

import React, { useMemo, useRef } from "react";
import { Grid } from "@mui/material";
import {
  Page,
  PageHeader,
  PageDescription,
  PageContent,
  formatTimeAgo,
} from "@klorad/ui";
import {
  AnimatedBackground,
  GlowingContainer,
  GlowingSpan,
} from "@/app/components/Builder/AdminLayout.styles";
import useProjects from "@/app/hooks/useProjects";
import useModels from "@/app/hooks/useModels";
import useActivity from "@/app/hooks/useActivity";
import { SensorsIcon } from "@klorad/ui";
import { MapIcon, CloudUploadIcon, PersonAddIcon } from "@klorad/ui";
import { KeyMetrics } from "./components/KeyMetrics";
import { QuickActions } from "./components/QuickActions";
import { RecentActivity } from "./components/RecentActivity";
import { UsageSummary } from "./components/UsageSummary";
import { RecentProjects } from "./components/RecentProjects";

interface DashboardMetrics {
  projects: number;
  models: number;
  sensors: number;
  tilesets: number;
  storageUsed: string;
}

const DashboardPage = () => {
  const { projects, loadingProjects } = useProjects();
  const { models, loadingModels } = useModels({ assetType: "model" });
  const { models: tilesets, loadingModels: loadingTilesets } = useModels({
    assetType: "cesiumIonAsset",
  });
  const { activities, loadingActivity } = useActivity({ limit: 10 });

  // Format storage helper function
  const formatStorage = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Use refs to cache previous calculations and prevent infinite loops
  const prevStorageRef = useRef<number>(0);
  const prevModelsIdsRef = useRef<string>("");
  const prevTilesetsIdsRef = useRef<string>("");
  const prevModelsLengthRef = useRef<number>(-1);
  const prevTilesetsLengthRef = useRef<number>(-1);

  // Calculate storage only when data actually changes
  const totalStorageBytes = useMemo(() => {
    const modelsLength = models.length;
    const tilesetsLength = tilesets.length;

    // Create stable IDs for comparison (just IDs, not fileSize to avoid recalculation)
    const modelsIds = models.map((m) => m.id).join(",");
    const tilesetsIds = tilesets.map((t) => t.id).join(",");

    // Check if nothing changed - return cached value
    if (
      modelsLength === prevModelsLengthRef.current &&
      tilesetsLength === prevTilesetsLengthRef.current &&
      modelsIds === prevModelsIdsRef.current &&
      tilesetsIds === prevTilesetsIdsRef.current
    ) {
      return prevStorageRef.current;
    }

    // Update refs
    prevModelsLengthRef.current = modelsLength;
    prevTilesetsLengthRef.current = tilesetsLength;
    prevModelsIdsRef.current = modelsIds;
    prevTilesetsIdsRef.current = tilesetsIds;

    // Recalculate storage
    let totalBytes = 0;
    [...models, ...tilesets].forEach((asset) => {
      // For regular models: use fileSize column
      if (asset.fileSize) {
        const size =
          typeof asset.fileSize === "bigint"
            ? Number(asset.fileSize)
            : asset.fileSize;
        totalBytes += size;
      }
      // For Cesium Ion assets: check metadata.bytes
      else if (
        asset.assetType === "cesiumIonAsset" &&
        asset.metadata &&
        typeof asset.metadata === "object"
      ) {
        const metadata = asset.metadata as Record<string, unknown>;
        if (typeof metadata.bytes === "number") {
          totalBytes += metadata.bytes;
        }
      }
    });

    prevStorageRef.current = totalBytes;
    return totalBytes;
  }, [models, tilesets]);

  // Memoize metrics calculation to prevent infinite loops
  const metrics = useMemo<DashboardMetrics>(() => {
    if (loadingProjects || loadingModels || loadingTilesets) {
      return {
        projects: 0,
        models: 0,
        sensors: 0,
        tilesets: 0,
        storageUsed: "0 GB",
      };
    }

    return {
      projects: projects.length,
      models: models.length,
      sensors: 0, // Always 0 - coming soon
      tilesets: tilesets.length,
      storageUsed: formatStorage(totalStorageBytes),
    };
  }, [
    projects.length,
    models.length,
    tilesets.length,
    totalStorageBytes,
    loadingProjects,
    loadingModels,
    loadingTilesets,
  ]);

  const loadingMetrics = loadingProjects || loadingModels || loadingTilesets;

  // Format activities for RecentActivity component
  const recentActivity = activities.map((activity) => {
    // Map entity types and actions to icons
    let icon: React.ReactNode;
    if (activity.entityType === "MODEL" || activity.entityType === "GEOSPATIAL_ASSET") {
      icon = <CloudUploadIcon />;
    } else if (activity.entityType === "SENSOR") {
      icon = <SensorsIcon />;
    } else if (activity.entityType === "PROJECT") {
      icon = <MapIcon />;
    } else if (activity.entityType === "USER") {
      icon = <PersonAddIcon />;
    } else {
      icon = <CloudUploadIcon />;
    }

    // Use message if available, otherwise construct from entityType + action
    const title =
      activity.message ||
      `${activity.entityType} ${activity.action.toLowerCase()}`;

    // Extract description from metadata or project title
    const description =
      activity.project?.title ||
      (activity.metadata && typeof activity.metadata === "object"
        ? (activity.metadata as { assetName?: string; projectTitle?: string })
            .assetName ||
          (activity.metadata as { assetName?: string; projectTitle?: string })
            .projectTitle ||
          ""
        : "");

    return {
      icon,
      title,
      description,
      timestamp: formatTimeAgo(new Date(activity.createdAt)),
    };
  });

  const recentProjects = projects.slice(0, 6);

  return (
    <>
      {/* Animated background */}
      <AnimatedBackground>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
      </AnimatedBackground>

      <Page>
        <PageHeader title="Dashboard" />
        <PageDescription>
          Overview of your projects, assets, activity, and platform updates
        </PageDescription>

        <PageContent maxWidth="6xl">
          {/* Row 1: Key Metrics */}
          <KeyMetrics metrics={metrics} loading={loadingMetrics} />

          {/* Row 2: Quick Actions */}
          <QuickActions />

          {/* Two Column Layout: Left (Activity + Usage) | Right (Projects) */}
          <Grid container spacing={3}>
            {/* Left Column */}
            <Grid item xs={12} md={5}>
              <RecentActivity
                activities={recentActivity}
                loading={loadingActivity}
              />
              <UsageSummary />
            </Grid>

            {/* Right Column */}
            <Grid item xs={12} md={7}>
              <RecentProjects projects={recentProjects} loading={loadingProjects} />
            </Grid>
          </Grid>
        </PageContent>
      </Page>
    </>
  );
};

export default DashboardPage;
