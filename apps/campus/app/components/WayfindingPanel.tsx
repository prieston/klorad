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
import { useT } from "../lib/i18n";

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
  const t = useT();
  return (
    <Box
      sx={{
        position: "absolute",
        zIndex: 1400,
        bgcolor: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        borderRadius: 2,
        p: 2,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        // Desktop: floating bottom-left card.
        // Mobile: full-width sheet above the bottom pill of controls.
        left: { xs: 16, md: 16 },
        right: { xs: 16, md: "auto" },
        bottom: { xs: 88, md: 16 },
        width: { xs: "auto", md: 340 },
        maxWidth: { md: "calc(100vw - 32px)" },
        maxHeight: { xs: "70vh", md: "calc(100vh - 32px)" },
        overflowY: "auto",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {t("wayfind.title")}
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
            {t("common.clear")}
          </Typography>
        )}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={1.5}>
        <FormField label={t("wayfind.from")}>
          <Select
            size="small"
            fullWidth
            value={fromId ?? ""}
            onChange={(e) => onChangeFrom((e.target.value as string) || null)}
            displayEmpty
          >
            <MenuItem value="" disabled>
              {t("wayfind.pickFrom")}
            </MenuItem>
            {pois.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormField>

        <FormField label={t("wayfind.to")}>
          <Select
            size="small"
            fullWidth
            value={toId ?? ""}
            onChange={(e) => onChangeTo((e.target.value as string) || null)}
            displayEmpty
          >
            <MenuItem value="" disabled>
              {t("wayfind.pickTo")}
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
            label={t("wayfind.mode.standard")}
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
            label={t("wayfind.mode.stepFree")}
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
              {t("wayfind.loading")}
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
                {t("wayfind.duration")}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDuration(route.duration)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {t("wayfind.distance")}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatDistance(route.distance)}
              </Typography>
            </Box>
          </Box>
        )}

        {mode === "a11y" && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
            {t("wayfind.stepFreeCaveat")}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
