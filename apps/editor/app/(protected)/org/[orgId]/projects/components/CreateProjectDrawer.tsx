"use client";

import React from "react";
import {
  Box,
  Button,
  Drawer,
  Typography,
  TextField,
  IconButton,
  Divider,
  RadioGroup,
  Radio,
  FormControl,
  FormControlLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloseIcon } from "@klorad/ui";
import {
  textFieldStyles,
  SettingContainer,
  SettingLabel,
} from "@klorad/ui";

interface CreateProjectDrawerProps {
  open: boolean;
  editingProjectId: string | null;
  title: string;
  description: string;
  engine: string;
  saving: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onEngineChange: (value: "cesium" | "three") => void;
  onSave: () => void;
}

export const CreateProjectDrawer: React.FC<CreateProjectDrawerProps> = ({
  open,
  editingProjectId,
  title,
  description,
  engine,
  saving,
  onClose,
  onTitleChange,
  onDescriptionChange,
  onEngineChange,
  onSave,
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        zIndex: 1500, // Higher than sidebar (1400)
        "& .MuiBackdrop-root": {
          zIndex: 1499, // Backdrop should be just below drawer
        },
      }}
      ModalProps={{
        keepMounted: false,
        disableScrollLock: true,
      }}
      PaperProps={{
        sx: (theme) => ({
          width: { xs: "100%", sm: "420px" },
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A !important"
              : theme.palette.background.paper,
          borderLeft: "1px solid rgba(255, 255, 255, 0.05)",
          zIndex: 1500,
          "&.MuiPaper-root": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        }),
      }}
    >
      <Box
        sx={(theme) => ({
          p: 3,
          backgroundColor:
            theme.palette.mode === "dark" ? "#14171A" : theme.palette.background.paper,
          minHeight: "100%",
        })}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {editingProjectId ? "Edit Project" : "Create New Project"}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: "text.secondary",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Form */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <SettingContainer sx={{ borderBottom: "none", padding: 0 }}>
            <SettingLabel>Project Title</SettingLabel>
            <TextField
              id="project-title"
              name="project-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter project title"
              fullWidth
              size="small"
              variant="outlined"
              sx={textFieldStyles}
            />
          </SettingContainer>

          <SettingContainer sx={{ borderBottom: "none", padding: 0 }}>
            <SettingLabel>Project Description</SettingLabel>
            <TextField
              id="project-description"
              name="project-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Enter project description"
              fullWidth
              multiline
              rows={4}
              size="small"
              variant="outlined"
              sx={textFieldStyles}
            />
          </SettingContainer>

          {!editingProjectId && (
            <SettingContainer sx={{ borderBottom: "none", padding: 0 }}>
              <SettingLabel>World Type</SettingLabel>
              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={engine === "cesium" ? "geospatial" : "independent"}
                  onChange={(e) =>
                    onEngineChange(e.target.value === "geospatial" ? "cesium" : "three")
                  }
                  sx={{ gap: 1.5 }}
                >
                  <FormControlLabel
                    value="geospatial"
                    control={
                      <Radio
                        sx={{
                          color: "text.secondary",
                          "&.Mui-checked": {
                            color: "primary.main",
                          },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Geospatial Virtual World
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
                        >
                          A world anchored to real Earth locations, scale, and orientation.
                          Best for representing places, landscapes, cities, and large-scale
                          environments.
                        </Typography>
                      </Box>
                    }
                    sx={{ marginLeft: 0, alignItems: "flex-start" }}
                  />
                  <FormControlLabel
                    value="independent"
                    control={
                      <Radio
                        sx={{
                          color: "text.secondary",
                          "&.Mui-checked": {
                            color: "primary.main",
                          },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Independent Virtual World
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
                        >
                          A self-contained virtual space with no real-world location
                          constraints. Best for rooms, buildings, objects, and fully designed
                          environments.
                        </Typography>
                      </Box>
                    }
                    sx={{ marginLeft: 0, alignItems: "flex-start" }}
                  />
                </RadioGroup>
              </FormControl>
            </SettingContainer>
          )}

          {/* Actions */}
          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              onClick={onClose}
              fullWidth
              disabled={saving}
              sx={(theme) => ({
                borderRadius: `${theme.shape.borderRadius}px`,
                textTransform: "none",
              })}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={onSave}
              fullWidth
              disabled={!title.trim() || saving}
              sx={(theme) => ({
                borderRadius: `${theme.shape.borderRadius}px`,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "#161B20"
                    : theme.palette.background.paper,
                color: theme.palette.primary.main,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : alpha(theme.palette.primary.main, 0.05),
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                "&:disabled": {
                  opacity: 0.5,
                },
              })}
            >
              {saving
                ? editingProjectId
                  ? "Saving..."
                  : "Creating..."
                : editingProjectId
                  ? "Save Changes"
                  : "Create Project"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

