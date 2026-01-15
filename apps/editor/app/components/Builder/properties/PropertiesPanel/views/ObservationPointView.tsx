"use client";

import React, { memo, useCallback, useState, useEffect, useRef, useMemo } from "react";
import { Box, Button, TextField, MenuItem, Select, FormControl } from "@mui/material";
import { CameraIcon, FlightTakeoffIcon } from "@klorad/ui";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { createLogger } from "@klorad/core";
import { flyToCesiumPosition } from "@klorad/engine-cesium";
import { textFieldStyles } from "@klorad/ui";

const logger = createLogger("ObservationPointView");
import {
  SettingContainer,
  SettingLabel,
} from "@klorad/ui";
import { ScrollContainer } from "../components/ScrollContainer";
import { InputLabel, InfoText } from "../components/PropertyComponents";
import { ObservationPoint } from "../../types";

// Tuple type: [latitude, longitude, altitude]
type LatLonAlt = [lat: number, lon: number, alt: number];

interface ObservationPointViewProps {
  selectedObservation: ObservationPoint;
  updateObservationPoint: (
    id: number,
    update: Partial<ObservationPoint>
  ) => void;
  setCapturingPOV: (val: boolean) => void;
}

// Type guard for valid 3D vector
const hasVec3 = (v?: number[] | null): v is LatLonAlt =>
  Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));

/**
 * ObservationPointView - Displays and edits observation point properties
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const ObservationPointView: React.FC<ObservationPointViewProps> = memo(
  ({ selectedObservation, updateObservationPoint, setCapturingPOV }) => {
    const engine = useWorldStore((s) => s.engine);
    const cesiumViewer = useSceneStore((s) => s.cesiumViewer);

    // Local state for inputs to prevent focus loss on re-renders
    const [title, setTitle] = useState(selectedObservation.title || "");
    const [description, setDescription] = useState(
      (selectedObservation.description as string) || ""
    );

    // Track if we're currently editing to prevent syncing during user input
    const isEditingRef = useRef({ title: false, description: false });
    // Track the last observation ID we synced from
    const lastSyncedIdRef = useRef(selectedObservation.id);

    // Sync local state when observation changes (e.g., switching observations)
    // Only sync when the observation ID changes, not during active editing
    useEffect(() => {
      // Only sync when switching to a different observation
      if (selectedObservation.id !== lastSyncedIdRef.current) {
        const newTitle = selectedObservation.title || "";
        const newDescription = (selectedObservation.description as string) || "";
        setTitle(newTitle);
        setDescription(newDescription);
        lastSyncedIdRef.current = selectedObservation.id;
        // Reset editing flags when switching observations
        isEditingRef.current.title = false;
        isEditingRef.current.description = false;
      }
    }, [selectedObservation.id, selectedObservation.title, selectedObservation.description]);

    // Get available models from scene
    const objects = useSceneStore((state) => state.objects);
    const availableModels = useMemo(() => {
      return objects.filter((obj) => obj.url && obj.id); // Only models with URLs
    }, [objects]);

    // Type-safe property updates
    type ObsKey = "title" | "description" | "position" | "target" | "connectedModelId";
    const handleObservationChange = useCallback(
      <K extends ObsKey>(key: K, value: ObservationPoint[K]) => {
        updateObservationPoint(selectedObservation.id, {
          [key]: value,
        } as Pick<ObservationPoint, K>);
      },
      [selectedObservation.id, updateObservationPoint]
    );

    const handleModelConnectionChange = useCallback(
      (modelId: string) => {
        updateObservationPoint(selectedObservation.id, {
          connectedModelId: modelId === "" ? undefined : modelId,
        });
      },
      [selectedObservation.id, updateObservationPoint]
    );

    const handleFlyToObservation = useCallback(() => {
      if (!hasVec3(selectedObservation.position)) {
        logger.warn("Invalid observation position");
        return;
      }

      if (engine === "cesium" && cesiumViewer) {
        if (typeof window === "undefined") return;
        const Cesium = (window as any).Cesium;
        if (!Cesium) {
          logger.warn("Cesium not available");
          return;
        }

        // Position and target are both LatLonAlt: [lat, lon, alt]
        const [lat, lon, alt] = selectedObservation.position;
        const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

        // If there's a valid target, use it to orient the camera
        if (hasVec3(selectedObservation.target)) {
          const [targetLat, targetLon, targetAlt] = selectedObservation.target;
          const target = Cesium.Cartesian3.fromDegrees(targetLon, targetLat, targetAlt);

          // Calculate the direction from position to target
          const direction = Cesium.Cartesian3.subtract(
            target,
            position,
            new Cesium.Cartesian3()
          );
          Cesium.Cartesian3.normalize(direction, direction);

          // Calculate the up vector
          const up = cesiumViewer.scene.globe.ellipsoid.geodeticSurfaceNormal(
            position,
            new Cesium.Cartesian3()
          );

          // Use flyTo with proper orientation
          cesiumViewer.camera.flyTo({
            destination: position,
            orientation: {
              direction: direction,
              up: up,
            },
            duration: 1.5,
            easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
          });
        } else {
          // Fallback to simple flyTo if no target
          flyToCesiumPosition(cesiumViewer, lon, lat, alt);
        }
      } else if (engine === "three") {
        // For Three.js, enable preview mode to animate to the observation point
        // This will trigger the CameraSpringController to handle the animation
        const setPreviewMode = useSceneStore.getState().setPreviewMode;
        const setPreviewIndex = useSceneStore.getState().setPreviewIndex;
        const observationPoints = useSceneStore.getState().observationPoints;

        const index = observationPoints.findIndex(p => p.id === selectedObservation.id);
        if (index >= 0) {
          setPreviewIndex(index);
          setPreviewMode(true);
        }
      }
    }, [engine, cesiumViewer, selectedObservation.position, selectedObservation.target, selectedObservation.id]);

    const handleCapturePosition = useCallback(
      () => setCapturingPOV(true),
      [setCapturingPOV]
    );

    return (
      <ScrollContainer>
        {/* Observation Point Actions */}
        <SettingContainer>
          <SettingLabel>Observation Point Actions</SettingLabel>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              onClick={handleFlyToObservation}
              disabled={!hasVec3(selectedObservation.position)}
              startIcon={<FlightTakeoffIcon />}
              sx={{
                flex: 1,
                borderRadius: 4,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                borderColor: "rgba(95, 136, 199, 0.35)",
                color: "var(--color-primary, #6B9CD8)",
                padding: "6px 16px",
                "&:hover": {
                  borderColor: "var(--color-primary, #6B9CD8)",
                  backgroundColor: "rgba(95, 136, 199, 0.12)",
                },
                "&:disabled": {
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  color: "rgba(100, 116, 139, 0.4)",
                },
              }}
            >
              Fly To
            </Button>

            <Button
              variant="outlined"
              onClick={handleCapturePosition}
              startIcon={<CameraIcon />}
              sx={{
                flex: 1,
                borderRadius: 4,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                borderColor: "rgba(95, 136, 199, 0.35)",
                color: "var(--color-primary, #6B9CD8)",
                padding: "6px 16px",
                "&:hover": {
                  borderColor: "var(--color-primary, #6B9CD8)",
                  backgroundColor: "rgba(95, 136, 199, 0.12)",
                },
              }}
            >
              Capture Position
            </Button>
          </Box>
        </SettingContainer>

        <SettingContainer>
          <SettingLabel>Observation Point Settings</SettingLabel>

          {/* Title Input */}
          <Box sx={{ mb: 2 }}>
            <InputLabel>Title</InputLabel>
            <TextField
              id={`observation-title-${selectedObservation.id}`}
              name="observation-title"
              fullWidth
              size="small"
              placeholder="Enter title"
              value={title}
              onChange={(e) => {
                isEditingRef.current.title = true;
                setTitle(e.target.value);
              }}
              onBlur={() => {
                handleObservationChange("title", title);
                isEditingRef.current.title = false;
              }}
              sx={textFieldStyles}
            />
          </Box>

          {/* Description Input */}
          <Box sx={{ mb: 2 }}>
            <InputLabel>Description</InputLabel>
            <TextField
              id={`observation-description-${selectedObservation.id}`}
              name="observation-description"
              fullWidth
              size="small"
              placeholder="Enter description"
              multiline
              rows={4}
              value={description}
              onChange={(e) => {
                isEditingRef.current.description = true;
                setDescription(e.target.value);
              }}
              onBlur={() => {
                handleObservationChange("description", description);
                isEditingRef.current.description = false;
              }}
              sx={textFieldStyles}
            />
          </Box>

          {/* Connected Model Selection */}
          <Box sx={{ mb: 2 }}>
            <InputLabel>Connected Model</InputLabel>
            <FormControl fullWidth size="small">
              <Select
                value={selectedObservation.connectedModelId || ""}
                onChange={(e) => handleModelConnectionChange(e.target.value)}
                displayEmpty
                sx={textFieldStyles}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {availableModels.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name || model.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Position Info - Display Only */}
          <InfoText
            label="Camera Position"
            value={
              hasVec3(selectedObservation.position)
                ? `Lat: ${selectedObservation.position[0].toFixed(
                    6
                  )}, Lon: ${selectedObservation.position[1].toFixed(
                    6
                  )}, Alt: ${selectedObservation.position[2].toFixed(2)}m`
                : "Not captured"
            }
          />

          {/* Target Info - Display Only */}
          <InfoText
            label="Camera Target"
            value={
              hasVec3(selectedObservation.target)
                ? `Lat: ${selectedObservation.target[0].toFixed(
                    6
                  )}, Lon: ${selectedObservation.target[1].toFixed(
                    6
                  )}, Alt: ${selectedObservation.target[2].toFixed(2)}m`
                : "Not captured"
            }
          />
        </SettingContainer>
      </ScrollContainer>
    );
  }
);

ObservationPointView.displayName = "ObservationPointView";
