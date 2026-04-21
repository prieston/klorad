import React from "react";
import { Card, CardContent, Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";

export interface CreateProjectCardProps {
  onClick?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  /** Title shown under the plus icon. Defaults to "Create Project". */
  label?: string;
  /** Short subtitle under the title. */
  description?: string;
}

export default function CreateProjectCard({
  onClick,
  selected,
  onSelect: _onSelect,
  label = "Create Project",
  description = "Start building your new XR experience",
}: CreateProjectCardProps) {
  const handleCardClick = () => {
    _onSelect?.();
    onClick?.();
  };

  return (
    <Card
      className={`glass-card ${selected ? "selected" : ""}`}
      onClick={handleCardClick}
      sx={(theme) => {
        const base = theme.palette.primary.main;
        const hoverTone = alpha(base, 0.12);
        const borderTone = alpha(base, 0.4);
        const activeShadow = alpha(base, 0.2);

        return {
        width: 300,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        background:
          theme.palette.mode === "dark"
            ? "rgba(22, 24, 26, 0.85)"
            : "#14171A",
        backdropFilter: "blur(20px) saturate(130%)",
        WebkitBackdropFilter: "blur(20px) saturate(130%)",
        border:
          theme.palette.mode === "dark"
            ? "2px dashed rgba(255, 255, 255, 0.12)"
            : `2px dashed ${alpha(base, 0.35)}`,
        borderRadius: "4px",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 1px 3px rgba(0, 0, 0, 0.35)"
            : `0 8px 32px ${alpha(base, 0.18)}`,
        transition: "background-color 0.15s ease, border-color 0.15s ease",
        "&:hover": {
          background:
            theme.palette.mode === "dark"
              ? "rgba(28, 31, 34, 0.9)"
              : hoverTone,
          borderColor:
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.18)"
              : borderTone,
        },
        "&.selected": {
          background:
            theme.palette.mode === "dark"
              ? alpha(base, 0.18)
              : alpha(base, 0.18),
          borderColor: base,
          boxShadow:
            theme.palette.mode === "dark"
              ? `0 1px 3px rgba(0, 0, 0, 0.5), 0 0 0 1px ${alpha(base, 0.35)}`
              : `0 20px 25px -5px ${activeShadow}, 0 10px 10px -5px ${alpha(base, 0.1)}, 0 0 0 2px ${alpha(base, 0.28)}`,
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            theme.palette.mode === "dark"
              ? "linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 50%, rgba(255, 255, 255, 0.02) 100%)"
              : "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(255, 255, 255, 0.1) 100%)",
          opacity: 0,
          transition: "opacity 0.15s ease",
          pointerEvents: "none",
          zIndex: 1,
        },
        "&:hover::before": {
          opacity: 1,
        },
        };
      }}
    >
      <CardContent
        className="glass-card-content"
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={(theme) => ({
            width: 48,
            height: 48,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              theme.palette.mode === "dark"
                ? alpha(theme.palette.primary.main, 0.16)
                : "rgba(255, 255, 255, 0.05)",
            color: theme.palette.primary.main,
            position: "relative",
            overflow: "hidden",
            zIndex: 2,
          })}
        >
          <AddIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography
          className="glass-card-title"
          variant="h6"
          sx={{ fontWeight: 600, color: "text.primary" }}
        >
          {label}
        </Typography>
        <Typography
          className="glass-card-subtitle"
          variant="body2"
          sx={{ color: "text.secondary", textAlign: "center" }}
        >
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}
