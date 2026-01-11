import React from "react";
import { Box, Button, Typography, Switch, FormControlLabel } from "@mui/material";
import {
  FlightTakeoffIcon,
  LocationOnIcon,
  OpenWithIcon,
  RotateRightIcon,
} from "@klorad/ui";
import { SettingContainer, SettingLabel } from "@klorad/ui";

interface ObjectActionsSectionProps {
  onFlyToObject: () => void;
  onReposition?: () => void;
  repositioning: boolean;
  showGizmoControls?: boolean;
  transformMode?: "translate" | "rotate" | "scale";
  onTransformModeChange?: (mode: "translate" | "rotate" | "scale") => void;
  interactable?: boolean;
  onInteractableChange?: (interactable: boolean) => void;
  engine?: "three" | "cesium";
}

const ObjectActionsSection: React.FC<ObjectActionsSectionProps> = ({
  onFlyToObject,
  onReposition,
  repositioning,
  showGizmoControls = false,
  transformMode = "translate",
  onTransformModeChange,
  interactable = true,
  onInteractableChange,
  engine,
}) => {
  return (
    <SettingContainer>
      <SettingLabel>Object Actions</SettingLabel>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onFlyToObject}
          startIcon={<FlightTakeoffIcon />}
          sx={{
            flex: 1,
            borderRadius: "4px",
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.75rem",
            borderColor: "rgba(95, 136, 199, 0.3)",
            color: "var(--color-primary, #6B9CD8)",
            padding: "6px 16px",
            "&:hover": {
              borderColor: "var(--color-primary, #6B9CD8)",
              backgroundColor: "rgba(95, 136, 199, 0.08)",
            },
          }}
        >
          Fly to Object
        </Button>
        {onReposition && (
          <Button
            variant="outlined"
            onClick={onReposition}
            startIcon={<LocationOnIcon />}
            sx={{
              flex: 1,
              borderRadius: "4px",
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.75rem",
              borderColor: "rgba(95, 136, 199, 0.3)",
              color: "var(--color-primary, #6B9CD8)",
              padding: "6px 16px",
              "&:hover": {
                borderColor: "var(--color-primary, #6B9CD8)",
                backgroundColor: "rgba(95, 136, 199, 0.08)",
              },
            }}
            disabled={repositioning}
            data-testid="reposition-button"
          >
            {repositioning ? "Repositioning..." : "Reposition"}
          </Button>
        )}
      </Box>

      {/* Interactable Switch - Only for ThreeJS */}
      {engine === "three" && onInteractableChange && (
        <Box
          sx={(theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : theme.palette.common.white,
            borderRadius: "4px",
            border:
              theme.palette.mode === "dark"
                ? "1px solid rgba(255, 255, 255, 0.08)"
                : "1px solid rgba(255, 255, 255, 0.08)",
            mt: 2,
            mb: showGizmoControls && onTransformModeChange ? 0 : 0,
          })}
        >
          <FormControlLabel
            control={
              <Switch
                id="interactable-enabled"
                name="interactable-enabled"
                checked={interactable}
                onChange={(e) => onInteractableChange(e.target.checked)}
                sx={(theme) => ({
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: theme.palette.primary.main,
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    backgroundColor: theme.palette.primary.main,
                  },
                })}
              />
            }
            label="Interactable"
            sx={(theme) => ({
              margin: 0,
              padding: "8.5px 14px",
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              "& .MuiFormControlLabel-label": {
                fontSize: "0.75rem",
                fontWeight: 400,
                color: theme.palette.text.secondary,
                flex: 1,
              },
            })}
            labelPlacement="start"
          />
        </Box>
      )}

      {/* Gizmo Transform Controls */}
      {showGizmoControls && onTransformModeChange && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="caption"
            sx={{
              color: "rgba(51, 65, 85, 0.7)",
              display: "block",
              mb: 1,
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            Transform Mode
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => onTransformModeChange("translate")}
              startIcon={<OpenWithIcon />}
              sx={{
                flex: 1,
                borderRadius: "4px",
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                borderColor: "rgba(95, 136, 199, 0.3)",
                color: "var(--color-primary, #6B9CD8)",
                padding: "6px 16px",
                "&:hover": {
                  borderColor: "var(--color-primary, #6B9CD8)",
                  backgroundColor: "rgba(95, 136, 199, 0.08)",
                },
                ...(transformMode === "translate" && {
                  backgroundColor: "rgba(95, 136, 199, 0.2)",
                  borderColor: "var(--color-primary, #6B9CD8)",
                }),
              }}
            >
              Move
            </Button>
            <Button
              variant="outlined"
              onClick={() => onTransformModeChange("rotate")}
              startIcon={<RotateRightIcon />}
              sx={{
                flex: 1,
                borderRadius: "4px",
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                borderColor: "rgba(95, 136, 199, 0.3)",
                color: "var(--color-primary, #6B9CD8)",
                padding: "6px 16px",
                "&:hover": {
                  borderColor: "var(--color-primary, #6B9CD8)",
                  backgroundColor: "rgba(95, 136, 199, 0.08)",
                },
                ...(transformMode === "rotate" && {
                  backgroundColor: "rgba(95, 136, 199, 0.2)",
                  borderColor: "var(--color-primary, #6B9CD8)",
                }),
              }}
            >
              Rotate
            </Button>
          </Box>
        </Box>
      )}
    </SettingContainer>
  );
};

export default ObjectActionsSection;
