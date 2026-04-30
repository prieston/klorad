"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import CloseIcon from "@mui/icons-material/Close";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VideocamIcon from "@mui/icons-material/Videocam";
import { FormField, TextField } from "@klorad/ui";
import type { POI } from "@klorad/api";
import Breadcrumbs from "./Breadcrumbs";

export interface POIsViewProps {
  pois: POI[];
  selectedPoiId: string | null;
  placingPoi: boolean;

  onSelectPoi: (id: string | null) => void;
  onStartPlacing: () => void;
  onStopPlacing: () => void;

  onUpdatePoi: (id: string, patch: Partial<POI>) => void;
  onFlyToPoi: (id: string) => void;
  onDeletePoi: (id: string) => void;

  /**
   * Save the map's current centre + camera (zoom/pitch/bearing) onto
   * this POI in one shot. Called from the single "Capture point of
   * view" affordance in the detail screen.
   */
  onCapturePOV: (id: string) => void;
}

/**
 * POIs panel — a two-state inner navigation that mirrors BuildingsView:
 *   - Root: list of non-building POIs (cafés, entrances, parking…)
 *           with an inline filter and an "Add POI" CTA.
 *   - Detail: focused edit screen — name, description, and a single
 *           "Capture point of view" button that saves position + view
 *           together so the user doesn't think about coordinates.
 */
export default function POIsView(props: POIsViewProps) {
  const { pois, selectedPoiId, onSelectPoi } = props;
  const [query, setQuery] = useState("");

  const selectedPoi = useMemo(
    () => (selectedPoiId ? pois.find((p) => p.id === selectedPoiId) ?? null : null),
    [selectedPoiId, pois]
  );

  const crumbs = [
    {
      label: "POIs",
      onClick: () => onSelectPoi(null),
      current: !selectedPoi,
    },
    selectedPoi
      ? { label: selectedPoi.name || "Untitled", onClick: () => {}, current: true }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    onClick: () => void;
    current: boolean;
  }>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Breadcrumbs crumbs={crumbs} />
      <Box sx={{ flex: 1, overflow: "auto", px: 2, pb: 2 }}>
        {selectedPoi ? (
          <PoiDetail {...props} poi={selectedPoi} />
        ) : (
          <PoiList {...props} query={query} setQuery={setQuery} />
        )}
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  POI list                                  */
/* -------------------------------------------------------------------------- */

function PoiList({
  pois,
  placingPoi,
  query,
  setQuery,
  onSelectPoi,
  onStartPlacing,
  onStopPlacing,
  onFlyToPoi,
  onDeletePoi,
}: POIsViewProps & { query: string; setQuery: (q: string) => void }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pois;
    return pois.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
    );
  }, [pois, query]);

  return (
    <Stack spacing={1.5} sx={{ pt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography
          variant="overline"
          sx={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "text.secondary",
            letterSpacing: "0.08em",
            flex: 1,
          }}
        >
          Points of Interest
        </Typography>
        <Chip
          label={pois.length}
          size="small"
          sx={(t) => ({
            height: 20,
            fontSize: "0.7rem",
            bgcolor: alpha(t.palette.primary.main, 0.16),
            color: "primary.main",
            fontWeight: 600,
          })}
        />
      </Stack>

      <Button
        size="small"
        variant={placingPoi ? "outlined" : "contained"}
        color={placingPoi ? "warning" : "primary"}
        startIcon={
          placingPoi ? (
            <CloseIcon sx={{ fontSize: 14 }} />
          ) : (
            <AddLocationAltIcon sx={{ fontSize: 14 }} />
          )
        }
        onClick={placingPoi ? onStopPlacing : onStartPlacing}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        {placingPoi ? "Cancel placing" : "Add POI"}
      </Button>

      {pois.length > 6 && (
        <TextField
          size="small"
          fullWidth
          placeholder="Filter by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {filtered.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 1, fontSize: "0.8125rem" }}
        >
          {pois.length === 0
            ? "No POIs yet — drop one to mark a building, café, or entrance."
            : "Nothing matches that filter."}
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {filtered.map((p) => (
            <Box
              key={p.id}
              role="button"
              onClick={() => onSelectPoi(p.id)}
              sx={(t) => ({
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.25,
                py: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: alpha(t.palette.primary.main, 0.06),
                  borderColor: alpha(t.palette.primary.main, 0.4),
                },
              })}
            >
              <Box
                sx={(t) => ({
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: t.palette.primary.main,
                  flexShrink: 0,
                })}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </Typography>
                {p.description && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontSize: "0.7rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {p.description}
                  </Typography>
                )}
              </Box>
              <Tooltip title="Fly to">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlyToPoi(p.id);
                  }}
                  sx={{ p: 0.25 }}
                >
                  <FlightTakeoffIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePoi(p.id);
                  }}
                  sx={{ p: 0.25 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <ChevronRightIcon
                sx={{ fontSize: 16, color: "text.secondary" }}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 POI detail                                 */
/* -------------------------------------------------------------------------- */

function PoiDetail({
  poi,
  onUpdatePoi,
  onFlyToPoi,
  onDeletePoi,
  onCapturePOV,
}: POIsViewProps & { poi: POI }) {
  return (
    <Stack spacing={2.5} sx={{ pt: 1.5 }}>
      {/* Header — name, fly-to, delete */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {poi.name || "Untitled"}
        </Typography>
        <Tooltip title="Fly to">
          <IconButton size="small" onClick={() => onFlyToPoi(poi.id)}>
            <FlightTakeoffIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDeletePoi(poi.id)}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ----------------------------- Basics ------------------------------ */}
      <Section label="Basics">
        <FormField label="Name">
          <TextField
            fullWidth
            size="small"
            value={poi.name}
            onChange={(e) => onUpdatePoi(poi.id, { name: e.target.value })}
          />
        </FormField>
        <FormField label="Description">
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            placeholder="Short blurb shown on the public viewer card"
            value={poi.description ?? ""}
            onChange={(e) =>
              onUpdatePoi(poi.id, { description: e.target.value })
            }
          />
        </FormField>
      </Section>

      {/* ----------------------------- Camera ------------------------------ */}
      <Section label="Point of view">
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: "0.75rem" }}
        >
          {poi.view
            ? "Visitors fly to this saved view when they pick this POI."
            : "Pan and zoom the map to where you want visitors to land, then capture."}
        </Typography>
        <Button
          variant={poi.view ? "outlined" : "contained"}
          size="small"
          startIcon={<VideocamIcon sx={{ fontSize: 16 }} />}
          onClick={() => onCapturePOV(poi.id)}
          sx={{ alignSelf: "flex-start", textTransform: "none" }}
        >
          {poi.view ? "Re-capture point of view" : "Capture point of view"}
        </Button>
      </Section>
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        variant="overline"
        sx={{
          fontSize: "0.7rem",
          fontWeight: 600,
          color: "text.secondary",
          letterSpacing: "0.08em",
          display: "block",
          mb: 1,
        }}
      >
        {label}
      </Typography>
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}
