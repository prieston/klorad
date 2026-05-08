"use client";

import { Box, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { FloorPlan } from "@klorad/api";

interface Props {
  plans: FloorPlan[];
  activePlanId: string | null;
  onSelectPlan: (planId: string | null) => void;
}

/**
 * Label shown on the switcher pill. Uses the plan's display name when
 * set; otherwise falls back to the floor number ("Γ" for ground, the
 * digit for others). The pill grows horizontally up to a max width and
 * long names are ellipsized with the full name available in the tooltip.
 */
function floorLabel(plan: FloorPlan): string {
  const name = plan.name?.trim();
  if (name) return name;
  const floor = plan.floor ?? 0;
  return floor === 0 ? "Γ" : String(floor);
}

/**
 * Vertical floor-picker pill docked to the right edge of the map.
 * Renders floors top-to-bottom (highest floor first). Clicking the
 * currently-active floor collapses back to outdoor view.
 */
export default function LevelSwitcher({ plans, activePlanId, onSelectPlan }: Props) {
  if (plans.length === 0) return null;

  // Sort descending — top floor at the top.
  const ordered = [...plans].sort((a, b) => (b.floor ?? 0) - (a.floor ?? 0));

  return (
    <Box
      sx={{
        position: "absolute",
        right: 16,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 1401,
        bgcolor: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: 2,
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        p: 0.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
      }}
    >
      {ordered.map((plan) => {
        const floor = plan.floor ?? 0;
        const isActive = activePlanId === plan.id;
        const label = floorLabel(plan);
        const tooltip = plan.name?.trim() || (floor === 0 ? "Ground floor" : `Floor ${floor}`);
        return (
          <Tooltip key={plan.id} title={tooltip} placement="left" arrow>
            <Box
              role="button"
              onClick={() => onSelectPlan(isActive ? null : plan.id)}
              sx={(t) => ({
                minWidth: 44,
                maxWidth: 160,
                height: 36,
                px: 1.25,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
                bgcolor: isActive ? alpha(t.palette.primary.main, 0.18) : "transparent",
                color: isActive ? "primary.main" : "var(--glass-text-secondary, #bbb)",
                "&:hover": {
                  bgcolor: alpha(t.palette.primary.main, 0.12),
                  color: "primary.main",
                },
              })}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: isActive ? 700 : 500,
                  fontSize: "0.9375rem",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {label}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
