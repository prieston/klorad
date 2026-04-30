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
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ApartmentIcon from "@mui/icons-material/Apartment";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import VideocamIcon from "@mui/icons-material/Videocam";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { TextField } from "@klorad/ui";
import type { POI, POICategory, POIEvent } from "@klorad/api";
import Breadcrumbs from "./Breadcrumbs";

const CATEGORIES: POICategory[] = [
  "building",
  "department",
  "library",
  "dining",
  "parking",
  "sports",
  "medical",
  "admin",
  "housing",
  "amenity",
  "custom",
];

const POI_CATEGORY_COLORS: Record<POICategory, string> = {
  building: "#3b82f6",
  department: "#8b5cf6",
  library: "#f59e0b",
  dining: "#10b981",
  parking: "#6b7280",
  sports: "#ef4444",
  medical: "#ec4899",
  admin: "#0ea5e9",
  housing: "#f97316",
  amenity: "#84cc16",
  custom: "#94a3b8",
};

export interface POIsViewProps {
  pois: POI[];
  selectedPoiId: string | null;
  placingPoi: boolean;

  onSelectPoi: (id: string | null) => void;
  onStartPlacing: () => void;
  onStopPlacing: () => void;

  onUpdatePoi: (id: string, patch: Partial<POI>) => void;
  onUnlinkBuilding: (id: string) => void;
  onFlyToPoi: (id: string) => void;
  onDeletePoi: (id: string) => void;

  onUseMapCenter: () => void;
  onCaptureView: () => void;
  onClearView: () => void;

  onAddEvent: () => void;
  onRemoveEvent: (poiId: string, eventId: string) => void;
}

/**
 * POIs panel — a two-state inner navigation that mirrors BuildingsView:
 *   - Root: list of POIs with an inline filter and "+ Add" CTA.
 *   - Detail: focused edit screen for the selected POI, grouped into
 *     three visual blocks (Basics, Map link, Events). Camera "Position
 *     & view" details are collapsed behind a single toggle so the
 *     happy-path screen stays calm.
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
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
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
          placeholder="Filter by name, category…"
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
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: POI_CATEGORY_COLORS[p.category ?? "custom"],
                  flexShrink: 0,
                }}
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.7rem" }}
                >
                  {p.category ?? "custom"}
                  {p.linkedBuilding ? " · linked" : ""}
                </Typography>
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
  onUnlinkBuilding,
  onFlyToPoi,
  onDeletePoi,
  onUseMapCenter,
  onCaptureView,
  onClearView,
  onAddEvent,
  onRemoveEvent,
}: POIsViewProps & { poi: POI }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <Stack spacing={2.5} sx={{ pt: 1.5 }}>
      {/* Header — name, category, fly-to, delete */}
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: POI_CATEGORY_COLORS[poi.category ?? "custom"],
            flexShrink: 0,
          }}
        />
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
        <TextField
          label="Name"
          size="small"
          value={poi.name}
          onChange={(e) => onUpdatePoi(poi.id, { name: e.target.value })}
        />
        <TextField
          label="Description"
          size="small"
          multiline
          rows={2}
          placeholder="Short blurb shown on the public viewer card"
          value={poi.description ?? ""}
          onChange={(e) =>
            onUpdatePoi(poi.id, { description: e.target.value })
          }
        />
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.75 }}
          >
            Category
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {CATEGORIES.map((cat) => {
              const active = poi.category === cat;
              return (
                <Chip
                  key={cat}
                  label={cat}
                  size="small"
                  clickable
                  onClick={() => onUpdatePoi(poi.id, { category: cat })}
                  sx={{
                    fontSize: "0.7rem",
                    height: 22,
                    bgcolor: active
                      ? POI_CATEGORY_COLORS[cat]
                      : "action.hover",
                    color: active ? "#fff" : "text.secondary",
                  }}
                />
              );
            })}
          </Box>
        </Box>
      </Section>

      {/* --------------------------- Map link ------------------------------ */}
      <Section label="On the map">
        {poi.linkedBuilding ? (
          <Box
            sx={(t) => ({
              p: 1.25,
              borderRadius: 1,
              bgcolor: alpha(t.palette.primary.main, 0.06),
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              gap: 1,
            })}
          >
            <ApartmentIcon sx={{ fontSize: 20, color: "primary.main" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontSize: "0.8125rem", fontWeight: 600 }}
                noWrap
              >
                {poi.linkedBuilding.label ?? "Linked building"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.7rem",
                  display: "block",
                }}
              >
                {poi.linkedBuilding.lng.toFixed(5)},{" "}
                {poi.linkedBuilding.lat.toFixed(5)}
              </Typography>
            </Box>
            <Tooltip title="Unlink">
              <IconButton
                size="small"
                onClick={() => onUnlinkBuilding(poi.id)}
              >
                <LinkOffIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.75rem" }}
          >
            Not linked to a building. Use the apartment tool on the map to
            link this POI to a 3D footprint.
          </Typography>
        )}

        {/* Position summary + advanced toggle */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1, fontFamily: "monospace", fontSize: "0.75rem" }}
            >
              {poi.position[0].toFixed(5)}, {poi.position[1].toFixed(5)}
              {poi.position[2] ? ` · ${poi.position[2].toFixed(0)}m` : ""}
            </Typography>
            <Button
              size="small"
              startIcon={<MyLocationIcon sx={{ fontSize: 14 }} />}
              onClick={onUseMapCenter}
              sx={{ textTransform: "none", fontSize: "0.7rem", py: 0 }}
            >
              Use centre
            </Button>
          </Stack>
        </Box>

        {/* View capture */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flex: 1, fontSize: "0.75rem" }}
            >
              {poi.view
                ? `View · zoom ${poi.view.zoom?.toFixed(1) ?? "—"}, pitch ${poi.view.pitch?.toFixed(0) ?? "—"}°`
                : "No view captured"}
            </Typography>
            <Button
              size="small"
              startIcon={<VideocamIcon sx={{ fontSize: 14 }} />}
              onClick={onCaptureView}
              sx={{ textTransform: "none", fontSize: "0.7rem", py: 0 }}
            >
              Capture
            </Button>
            {poi.view && (
              <Button
                size="small"
                color="inherit"
                onClick={onClearView}
                sx={{ textTransform: "none", fontSize: "0.7rem", py: 0, opacity: 0.6 }}
              >
                Clear
              </Button>
            )}
          </Stack>
        </Box>

        <Button
          size="small"
          onClick={() => setAdvancedOpen((o) => !o)}
          startIcon={
            advancedOpen ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )
          }
          sx={{
            alignSelf: "flex-start",
            textTransform: "none",
            fontSize: "0.7rem",
            opacity: 0.7,
            py: 0,
          }}
        >
          {advancedOpen ? "Hide raw position / view" : "Edit raw position / view"}
        </Button>

        {advancedOpen && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Lng"
                size="small"
                fullWidth
                type="number"
                slotProps={{ htmlInput: { step: 0.000001 } }}
                value={poi.position[0]}
                onChange={(e) =>
                  onUpdatePoi(poi.id, {
                    position: [
                      parseFloat(e.target.value) || 0,
                      poi.position[1],
                      poi.position[2],
                    ],
                  })
                }
              />
              <TextField
                label="Lat"
                size="small"
                fullWidth
                type="number"
                slotProps={{ htmlInput: { step: 0.000001 } }}
                value={poi.position[1]}
                onChange={(e) =>
                  onUpdatePoi(poi.id, {
                    position: [
                      poi.position[0],
                      parseFloat(e.target.value) || 0,
                      poi.position[2],
                    ],
                  })
                }
              />
              <TextField
                label="Alt (m)"
                size="small"
                fullWidth
                type="number"
                slotProps={{ htmlInput: { step: 1 } }}
                value={poi.position[2] ?? 0}
                onChange={(e) =>
                  onUpdatePoi(poi.id, {
                    position: [
                      poi.position[0],
                      poi.position[1],
                      parseFloat(e.target.value) || 0,
                    ],
                  })
                }
              />
            </Stack>
            {poi.view && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Zoom"
                  size="small"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { step: 0.1, min: 0, max: 22 } }}
                  value={poi.view.zoom ?? ""}
                  onChange={(e) =>
                    onUpdatePoi(poi.id, {
                      view: {
                        ...poi.view,
                        zoom: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                />
                <TextField
                  label="Pitch"
                  size="small"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { step: 1, min: 0, max: 85 } }}
                  value={poi.view.pitch ?? ""}
                  onChange={(e) =>
                    onUpdatePoi(poi.id, {
                      view: {
                        ...poi.view,
                        pitch: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                />
                <TextField
                  label="Bearing"
                  size="small"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { step: 1 } }}
                  value={poi.view.bearing ?? ""}
                  onChange={(e) =>
                    onUpdatePoi(poi.id, {
                      view: {
                        ...poi.view,
                        bearing: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                />
              </Stack>
            )}
          </Stack>
        )}
      </Section>

      {/* ----------------------------- Events ------------------------------ */}
      <Section label="Events">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flex: 1, fontSize: "0.75rem" }}
          >
            {(poi.events ?? []).length === 0
              ? "Surface lectures / open days in the public search."
              : `${(poi.events ?? []).length} event${(poi.events ?? []).length === 1 ? "" : "s"}`}
          </Typography>
          <Button
            size="small"
            onClick={onAddEvent}
            sx={{ textTransform: "none", fontSize: "0.7rem", py: 0 }}
          >
            + Add
          </Button>
        </Stack>
        {(poi.events ?? []).length > 0 && (
          <Stack spacing={0.5}>
            {(poi.events ?? []).map((ev: POIEvent) => (
              <Box
                key={ev.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  gap: 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {ev.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: "block" }}
                  >
                    {ev.courseCode ? `${ev.courseCode} · ` : ""}
                    {new Date(ev.startsAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => onRemoveEvent(poi.id, ev.id)}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
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
