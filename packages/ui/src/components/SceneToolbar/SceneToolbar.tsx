"use client";

import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

export interface SceneTool {
  id: string;
  /** Icon element. */
  icon: React.ReactNode;
  /** Tooltip text (shown on hover). */
  label: string;
  /** Called when clicked. */
  onClick: () => void;
  /** Highlight the tool as currently active. */
  active?: boolean;
  /** Gray out and block clicks. */
  disabled?: boolean;
}

export interface SceneToolbarProps {
  tools: SceneTool[];
  /** "vertical" (default, CAD-style rail) or "horizontal". */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * Floating, glass-effect tool bar for 3D / map scenes. CAD-style:
 * small, one icon per row, with tooltips.
 *
 * Positioning is caller-controlled — wrap it with `position: absolute`
 * and `top`/`left` of your choice.
 */
export const SceneToolbar: React.FC<SceneToolbarProps> = ({
  tools,
  orientation = "vertical",
  className,
}) => {
  return (
    <Box
      className={className}
      sx={(t) => ({
        display: "flex",
        flexDirection: orientation === "vertical" ? "column" : "row",
        gap: 0.5,
        p: 0.5,
        bgcolor: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: 1,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        boxShadow: t.palette.mode === "dark"
          ? "0 2px 6px rgba(0,0,0,0.4)"
          : "0 2px 6px rgba(15,23,42,0.08)",
      })}
    >
      {tools.map((tool) => (
        <Tooltip
          key={tool.id}
          title={tool.label}
          placement={orientation === "vertical" ? "right" : "bottom"}
          arrow
        >
          <span>
            <IconButton
              size="small"
              onClick={tool.onClick}
              disabled={tool.disabled}
              sx={(t) => ({
                width: 36,
                height: 36,
                borderRadius: 1,
                color: tool.active
                  ? "primary.main"
                  : "var(--glass-text-secondary, #646464)",
                backgroundColor: tool.active
                  ? alpha(t.palette.primary.main, 0.16)
                  : "transparent",
                "&:hover": {
                  backgroundColor: alpha(t.palette.primary.main, 0.12),
                  color: "primary.main",
                },
                "&.Mui-disabled": {
                  opacity: 0.4,
                },
              })}
            >
              {tool.icon}
            </IconButton>
          </span>
        </Tooltip>
      ))}
    </Box>
  );
};
