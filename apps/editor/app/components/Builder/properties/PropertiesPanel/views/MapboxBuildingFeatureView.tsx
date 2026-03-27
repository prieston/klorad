import React, { useState, memo, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { useSceneStore } from "@klorad/core";
import { ScrollContainer } from "../components/ScrollContainer";
import CesiumFeatureProperties from "../../CesiumFeatureProperties";

interface MapboxBuildingFeatureViewProps {
  selectedMapboxBuilding: {
    properties: Record<string, unknown>;
    lng?: number;
    lat?: number;
  };
}

/**
 * Basemap building attributes from Mapbox Standard (Interactions API).
 */
export const MapboxBuildingFeatureView: React.FC<MapboxBuildingFeatureViewProps> =
  memo(
    ({ selectedMapboxBuilding }) => {
      const [showEmptyFields, setShowEmptyFields] = useState(false);
      const setSelectedMapboxBuilding = useSceneStore(
        (state) => state.setSelectedMapboxBuilding
      );

      const { properties, lng, lat } = selectedMapboxBuilding;

      return (
        <ScrollContainer>
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "rgba(51, 65, 85, 0.95)",
                }}
              >
                Mapbox building
              </Typography>
              <Button
                size="small"
                onClick={() => setSelectedMapboxBuilding(null)}
                aria-label="Clear selected building"
                sx={{
                  minWidth: "auto",
                  padding: "4px 8px",
                  fontSize: "0.7rem",
                }}
              >
                Clear
              </Button>
            </Box>
            {(lng != null || lat != null) && (
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: "rgba(100, 116, 139, 0.85)",
                  mb: 1,
                }}
              >
                Click ≈ {lng != null ? lng.toFixed(5) : "—"},{" "}
                {lat != null ? lat.toFixed(5) : "—"} (lng, lat)
              </Typography>
            )}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  color: "rgba(100, 116, 139, 0.8)",
                }}
              >
                {useMemo(() => Object.keys(properties).length, [properties])}{" "}
                properties
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showEmptyFields}
                    onChange={(e) => setShowEmptyFields(e.target.checked)}
                    size="small"
                    sx={{ padding: "4px" }}
                  />
                }
                label="Show empty"
                sx={{
                  margin: 0,
                  "& .MuiFormControlLabel-label": {
                    fontSize: "0.7rem",
                    color: "rgba(100, 116, 139, 0.9)",
                  },
                }}
              />
            </Box>
          </Box>

          <CesiumFeatureProperties
            properties={properties}
            showEmptyFields={showEmptyFields}
          />
        </ScrollContainer>
      );
    },
    (prev, next) =>
      prev.selectedMapboxBuilding.properties ===
        next.selectedMapboxBuilding.properties &&
      prev.selectedMapboxBuilding.lng === next.selectedMapboxBuilding.lng &&
      prev.selectedMapboxBuilding.lat === next.selectedMapboxBuilding.lat
  );

MapboxBuildingFeatureView.displayName = "MapboxBuildingFeatureView";
