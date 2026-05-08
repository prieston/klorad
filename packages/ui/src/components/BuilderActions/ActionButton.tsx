"use client";

import React from "react";
import { Typography, Button, ButtonProps } from "@mui/material";

interface ActionButtonProps extends Omit<ButtonProps, "children"> {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Highlight the button as currently selected (for view-switcher use). */
  active?: boolean;
}

/**
 * Generic action button component for toolbar actions
 * Styled consistently for builder/editor interfaces
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  sx,
  ...buttonProps
}) => {
  const baseSx = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0.5,
    minWidth: 56,
    padding: "8px 12px",
    color: active
      ? "primary.main"
      : "var(--glass-text-secondary, #646464)",
    backgroundColor: active ? "rgba(95, 136, 199, 0.12)" : "transparent",
    "&:hover": {
      backgroundColor: "rgba(95, 136, 199, 0.1)",
      color: "var(--glass-text-primary, #6B9CD8)",
    },
    "&.Mui-disabled": {
      color: "var(--glass-text-disabled, #9ca3af)",
    },
  } as const;
  const mergedSx = Array.isArray(sx) ? [baseSx, ...sx] : [baseSx, sx];
  return (
    <Button
      {...buttonProps}
      onClick={onClick}
      disabled={disabled}
      sx={mergedSx}
    >
      {icon}
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 400,
          letterSpacing: "0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
    </Button>
  );
};

