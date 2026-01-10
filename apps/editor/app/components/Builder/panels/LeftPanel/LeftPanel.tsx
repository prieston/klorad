"use client";

import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { getLeftPanelConfig } from "@klorad/config/factory";
import { LeftPanelContainer, GenericPanel } from "@klorad/ui";
import SettingRenderer from "../../SettingRenderer";
import LogoHeader from "@/app/components/AppBar/LogoHeader";

const LeftPanel: React.FC = () => {
  // Combine all scene store subscriptions into a single selector to reduce subscriptions from 9 to 1
  const sceneState = useSceneStore((state) => ({
    previewMode: state.previewMode,
    gridEnabled: state.gridEnabled,
    setGridEnabled: state.setGridEnabled,
    groundPlaneEnabled: state.groundPlaneEnabled,
    setGroundPlaneEnabled: state.setGroundPlaneEnabled,
    skyboxType: state.skyboxType,
    setSkyboxType: state.setSkyboxType,
    ambientLightIntensity: state.ambientLightIntensity,
    setAmbientLightIntensity: state.setAmbientLightIntensity,
    basemapType: state.basemapType,
    setBasemapType: state.setBasemapType,
  }));

  const { engine } = useWorldStore();

  // Destructure for cleaner lookups
  const {
    previewMode,
    gridEnabled,
    setGridEnabled,
    groundPlaneEnabled,
    setGroundPlaneEnabled,
    skyboxType,
    setSkyboxType,
    ambientLightIntensity,
    setAmbientLightIntensity,
    basemapType,
    setBasemapType,
  } = sceneState;

  const config = useMemo(() => {
    return getLeftPanelConfig(
      gridEnabled,
      setGridEnabled,
      groundPlaneEnabled,
      setGroundPlaneEnabled,
      skyboxType,
      setSkyboxType,
      ambientLightIntensity,
      setAmbientLightIntensity,
      basemapType,
      setBasemapType,
      { engine }
    );
    // Zustand setters are stable and don't need to be in dependency array
  }, [engine, gridEnabled, groundPlaneEnabled, skyboxType, ambientLightIntensity, basemapType]);

  return (
    <LeftPanelContainer
      previewMode={previewMode}
      className="glass-panel"
      sx={{ maxHeight: "none !important", height: "calc(100vh - 32px)" }}
    >
      {/* Logo Header - Fixed height, doesn't shrink */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          height: "64px",
          borderBottom: "1px solid rgba(100, 116, 139, 0.2)",
          mb: 2,
          px: 2,
          flexShrink: 0,
        }}
      >
        <LogoHeader />
      </Box>

      {/* Panel Content - Takes remaining space using flex: 1 */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <GenericPanel
          Container={({ children }) => <>{children}</>}
          config={config}
          renderSetting={(setting) => <SettingRenderer setting={setting} />}
          previewMode={previewMode}
        />
      </Box>
    </LeftPanelContainer>
  );
};

export default LeftPanel;
