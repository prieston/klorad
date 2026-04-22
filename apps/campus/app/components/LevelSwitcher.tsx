"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { FloorPlan } from "@klorad/api";

interface Props {
  plans: FloorPlan[];
  activeFloor: number | null;
  onSelectFloor: (floor: number | null) => void;
}

/**
 * Vertical floor-picker pill docked to the right edge of the map.
 * Renders floors top-to-bottom (highest floor first). Clicking the
 * currently-active floor collapses back to outdoor view.
 */
export default function LevelSwitcher({ plans, activeFloor, onSelectFloor }: Props) {
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
        const isActive = activeFloor === floor;
        const label = floor === 0 ? "Γ" : String(floor);
        return (
          <Box
            key={plan.id}
            role="button"
            onClick={() => onSelectFloor(isActive ? null : floor)}
            sx={(t) => ({
              width: 44,
              height: 36,
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
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
