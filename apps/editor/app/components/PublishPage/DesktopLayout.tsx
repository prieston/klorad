"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button, FormControlLabel, Switch, Typography, Box } from "@mui/material";
import { ViewInAr } from "@mui/icons-material";
import { LeftPanelContainer } from "@klorad/ui";
import {
  DesktopContainer,
  SidebarHeader,
  SidebarContent,
  ButtonGroupContainer,
  DesktopSceneContainer,
  Separator,
} from "./DesktopLayout.styles";
import LogoHeader from "../AppBar/LogoHeader";
import type { SceneProps } from "@klorad/engine-three";
import { ConnectedModelDisplay } from "./ConnectedModelDisplay";

type Observation = {
  id?: string | number;
  title?: string;
  description?: string;
  connectedModelId?: string;
};

type Project = {
  id?: string | number;
  title: string;
  description?: string;
  sceneData: NonNullable<SceneProps["initialSceneData"]>;
};

// Dynamically import PreviewScene to avoid SSR issues with 3d-tiles-renderer
const PreviewScene = dynamic(() => import("../Builder/Scene/PreviewScene"), {
  ssr: false,
});

interface DesktopLayoutProps {
  project: Project;
  currentObservation: Observation | null;
  previewMode: boolean;
  setPreviewMode: (value: boolean) => void;
  previewIndex: number;
  observationPoints: Observation[];
  nextObservation: () => void;
  prevObservation: () => void;
  projectId: string;
  engine: "three" | "cesium";
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  project,
  currentObservation,
  previewMode,
  setPreviewMode,
  previewIndex,
  observationPoints,
  nextObservation,
  prevObservation,
  projectId,
  engine,
}) => {
  const router = useRouter();

  const handleEnterVR = () => {
    router.push(`/publish/${projectId}/xr`);
  };
  return (
    <DesktopContainer>
      <DesktopSceneContainer>
        <PreviewScene
          initialSceneData={project.sceneData}
          renderObservationPoints={false}
          enableXR={false}
          isPublishMode={true}
        />
      </DesktopSceneContainer>

      <LeftPanelContainer
        previewMode={false}
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          height: "calc(100vh - 32px)",
          maxHeight: "calc(100vh - 32px)",
          zIndex: 1000,
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <SidebarHeader>
            <LogoHeader />
          </SidebarHeader>

          <SidebarHeader>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={previewMode}
                    onChange={(e) => setPreviewMode(e.target.checked)}
                    color="primary"
                  />
                }
                label={previewMode ? "Preview Mode" : "Free Navigation"}
              />
              {engine === "three" && (
                <Button
                  variant="contained"
                  onClick={handleEnterVR}
                  fullWidth
                  startIcon={<ViewInAr />}
                  sx={{
                    background: (theme) =>
                      theme.palette.mode === "dark"
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    "&:hover": {
                      background: (theme) =>
                        theme.palette.mode === "dark"
                          ? "linear-gradient(135deg, #5568d3 0%, #6a4190 100%)"
                          : "linear-gradient(135deg, #5568d3 0%, #6a4190 100%)",
                    },
                  }}
                >
                  Enter VR Mode
                </Button>
              )}
            </Box>
          </SidebarHeader>

          <ButtonGroupContainer>
            <Button
              variant="outlined"
              onClick={prevObservation}
              disabled={previewIndex === 0}
              fullWidth
            >
              Previous
            </Button>
            <Button
              variant="outlined"
              onClick={nextObservation}
              disabled={
                !observationPoints || previewIndex >= observationPoints.length - 1
              }
              fullWidth
            >
              Next
            </Button>
          </ButtonGroupContainer>

          <SidebarContent>
            <Typography
              variant="h5"
              gutterBottom
              sx={{
                fontWeight: 600,
                color: (theme) => theme.palette.text.primary,
              }}
            >
              {project.title}
            </Typography>
            <Typography
              variant="body1"
              gutterBottom
              sx={{
                color: (theme) => theme.palette.text.secondary,
              }}
            >
              {project.description}
            </Typography>
            <Separator />
            {currentObservation ? (
              <>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    color: (theme) => theme.palette.text.primary,
                  }}
                >
                  {currentObservation.title || "Untitled"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: (theme) => theme.palette.text.secondary,
                  }}
                >
                  {currentObservation.description || "No description provided."}
                </Typography>
                <ConnectedModelDisplay
                  connectedModelId={currentObservation.connectedModelId}
                  sceneObjects={project.sceneData.objects || []}
                  projectId={projectId}
                />
              </>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: (theme) => theme.palette.text.secondary,
                }}
              >
                No observation point selected.
              </Typography>
            )}
          </SidebarContent>
        </Box>
      </LeftPanelContainer>
    </DesktopContainer>
  );
};

export default DesktopLayout;
