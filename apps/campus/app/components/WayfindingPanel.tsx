"use client";

import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import AccessibleIcon from "@mui/icons-material/Accessible";
import { FormField, Select } from "@klorad/ui";
import type { POI } from "@klorad/api";
import {
  formatDistance,
  formatDuration,
  type Route,
  type RouteMode,
} from "../hooks/useMapboxRoute";

interface Props {
  pois: POI[];
  fromId: string | null;
  toId: string | null;
  mode: RouteMode;
  route: Route | null;
  loading: boolean;
  error: string | null;
  onChangeFrom: (id: string | null) => void;
  onChangeTo: (id: string | null) => void;
  onChangeMode: (mode: RouteMode) => void;
  onClear: () => void;
  onClose: () => void;
}

export default function WayfindingPanel({
  pois,
  fromId,
  toId,
  mode,
  route,
  loading,
  error,
  onChangeFrom,
  onChangeTo,
  onChangeMode,
  onClear,
  onClose,
}: Props) {
  const hasRoute = Boolean(fromId || toId || route);
  return (
    <Box
      sx={{
        position: "absolute",
        left: 16,
        bottom: 16,
        width: 340,
        maxWidth: "calc(100vw - 32px)",
        zIndex: 1401,
        bgcolor: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        borderRadius: 2,
        p: 2,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          Directions
        </Typography>
        {hasRoute && (
          <Typography
            component="button"
            variant="caption"
            onClick={onClear}
            sx={{
              background: "none",
              border: "none",
              color: "text.secondary",
              cursor: "pointer",
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              "&:hover": { color: "primary.main" },
            }}
          >
            Clear
          </Typography>
        )}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={1.5}>
        <FormField label="From">
          <Select
            size="small"
            fullWidth
            value={fromId ?? ""}
            onChange={(e) => onChangeFrom((e.target.value as string) || null)}
            displayEmpty
          >
            <MenuItem value="" disabled>
              Pick a starting point…
            </MenuItem>
            {pois.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormField>

        <FormField label="To">
          <Select
            size="small"
            fullWidth
            value={toId ?? ""}
            onChange={(e) => onChangeTo((e.target.value as string) || null)}
            displayEmpty
          >
            <MenuItem value="" disabled>
              Pick a destination…
            </MenuItem>
            {pois.map((p) => (
              <MenuItem key={p.id} value={p.id} disabled={p.id === fromId}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormField>

        {/* Mode toggle */}
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            clickable
            icon={<DirectionsWalkIcon sx={{ fontSize: 16 }} />}
            label="Standard"
            onClick={() => onChangeMode("walk")}
            sx={(t) => ({
              flex: 1,
              height: 32,
              fontWeight: mode === "walk" ? 600 : 400,
              bgcolor: mode === "walk" ? alpha(t.palette.primary.main, 0.2) : "action.hover",
              color: mode === "walk" ? "primary.main" : "text.secondary",
            })}
          />
          <Chip
            size="small"
            clickable
            icon={<AccessibleIcon sx={{ fontSize: 16 }} />}
            label="Step-free"
            onClick={() => onChangeMode("a11y")}
            sx={{
              flex: 1,
              height: 32,
              fontWeight: mode === "a11y" ? 600 : 400,
              bgcolor: mode === "a11y" ? "rgba(167,139,250,0.25)" : "action.hover",
              color: mode === "a11y" ? "#a78bfa" : "text.secondary",
            }}
          />
        </Stack>

        {/* Status */}
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Finding route…
            </Typography>
          </Box>
        )}

        {error && (
          <Typography variant="caption" color="error.main">
            {error}
          </Typography>
        )}

        {route && !loading && (
          <Box
            sx={(t) => ({
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 1.25,
              borderRadius: 1,
              bgcolor:
                route.mode === "a11y"
                  ? "rgba(167,139,250,0.1)"
                  : alpha(t.palette.primary.main, 0.08),
              border: "1px solid",
              borderColor: "divider",
            })}
          >
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Duration
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDuration(route.duration)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Distance
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDistance(route.distance)}
              </Typography>
            </Box>
          </Box>
        )}

        {mode === "a11y" && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
            Step-free routing uses the walking network. Campus-specific stair
            and elevator data can be added in the Studio to refine this route.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
