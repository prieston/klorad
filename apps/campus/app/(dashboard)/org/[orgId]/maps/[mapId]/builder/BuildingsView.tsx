"use client";

import { useMemo } from "react";
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
import ApartmentIcon from "@mui/icons-material/Apartment";
import LayersIcon from "@mui/icons-material/Layers";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import VideocamIcon from "@mui/icons-material/Videocam";
import { Autocomplete, FormField, MenuItem, TextField } from "@klorad/ui";
import type { FloorPlan, POI, POICategory, Room } from "@klorad/api";

const BUILDING_CATEGORIES: POICategory[] = [
  "building",
  "department",
  "library",
  "dining",
  "sports",
  "medical",
  "admin",
  "housing",
  "amenity",
];

const CATEGORY_COLORS: Record<POICategory, string> = {
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
import {
  ROOM_TEMPLATES,
  getRoomTemplate,
} from "@/app/lib/roomTemplates";
import Breadcrumbs from "./Breadcrumbs";

/**
 * Replaces the old <BuildingsTree /> hierarchy with a breadcrumb-driven
 * stack. The view at any moment is determined by which selection is
 * set (`selectedPoiId` → `activePlanId` → `activeRoomId`); each level
 * has its own detail screen with inline editing.
 */
export interface BuildingsViewProps {
  pois: POI[];
  plans: FloorPlan[];
  rooms: Room[];

  selectedPoiId: string | null;
  activePlanId: string | null;
  activeRoomId: string | null;

  onSelectBuilding: (poiId: string | null) => void;
  onSelectFloor: (poiId: string | null, planId: string | null) => void;
  onSelectRoom: (roomId: string | null) => void;

  onDrawBuilding: () => void;
  onAddFloor: (poiId: string) => void;
  onDrawRoom: (poiId: string, floor: number, planId: string | null) => void;

  onUpdateBuilding: (poiId: string, patch: Partial<POI>) => void;
  onRemoveBuilding: (poiId: string) => void;
  onCapturePOV: (poiId: string) => void;

  onEditFloor: (planId: string) => void;
  onRemoveFloor: (planId: string) => void;

  onUpdateRoom: (roomId: string, patch: Partial<Room>) => void;
  onRemoveRoom: (roomId: string) => void;
}

export default function BuildingsView(props: BuildingsViewProps) {
  const {
    pois,
    plans,
    rooms,
    selectedPoiId,
    activePlanId,
    activeRoomId,
    onSelectBuilding,
    onSelectFloor,
    onSelectRoom,
  } = props;

  const buildings = useMemo(
    () => pois.filter((p) => p.linkedBuilding),
    [pois]
  );

  const selectedBuilding =
    selectedPoiId !== null
      ? buildings.find((p) => p.id === selectedPoiId) ?? null
      : null;

  const activePlan =
    activePlanId !== null && selectedBuilding
      ? plans.find(
          (p) => p.id === activePlanId && p.buildingId === selectedBuilding.id
        ) ?? null
      : null;

  const activeRoom =
    activeRoomId !== null
      ? rooms.find((r) => r.id === activeRoomId) ?? null
      : null;

  const crumbs = [
    {
      label: "Buildings",
      onClick: () => {
        onSelectBuilding(null);
      },
      current: !selectedBuilding,
    },
    selectedBuilding
      ? {
          label: selectedBuilding.name,
          onClick: () => {
            onSelectFloor(selectedBuilding.id, null);
            onSelectRoom(null);
          },
          current: !activePlan,
        }
      : null,
    activePlan
      ? {
          label: floorLabel(activePlan),
          onClick: () => {
            onSelectRoom(null);
          },
          current: !activeRoom,
        }
      : null,
    activeRoom
      ? { label: activeRoom.name, onClick: () => {}, current: true }
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
        {!selectedBuilding && <BuildingsRoot {...props} buildings={buildings} />}
        {selectedBuilding && !activePlan && (
          <BuildingDetail
            {...props}
            building={selectedBuilding}
          />
        )}
        {selectedBuilding && activePlan && !activeRoom && (
          <FloorDetail
            {...props}
            building={selectedBuilding}
            plan={activePlan}
          />
        )}
        {activeRoom && (
          <RoomDetail
            {...props}
            room={activeRoom}
            building={selectedBuilding}
            plan={activePlan}
          />
        )}
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Buildings (root)                              */
/* -------------------------------------------------------------------------- */

function BuildingsRoot({
  buildings,
  plans,
  rooms,
  onSelectBuilding,
  onDrawBuilding,
}: BuildingsViewProps & { buildings: POI[] }) {
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
          Buildings
        </Typography>
        <Chip
          label={buildings.length}
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
        variant="outlined"
        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
        onClick={onDrawBuilding}
        sx={{ alignSelf: "flex-start", textTransform: "none" }}
      >
        Draw building
      </Button>

      {buildings.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 1, fontSize: "0.8125rem" }}
        >
          Trace a polygon on the map to create your first building.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {buildings.map((b) => {
            const buildingPlans = plans.filter((p) => p.buildingId === b.id);
            const buildingRooms = rooms.filter((r) => r.buildingId === b.id);
            return (
              <Box
                key={b.id}
                role="button"
                onClick={() => onSelectBuilding(b.id)}
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
                <ApartmentIcon
                  sx={{ fontSize: 18, color: "primary.main", flexShrink: 0 }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {b.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.7rem" }}
                >
                  {buildingPlans.length} fl · {buildingRooms.length} rm
                </Typography>
                <ChevronRightIcon
                  sx={{ fontSize: 16, color: "text.secondary" }}
                />
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Building detail                               */
/* -------------------------------------------------------------------------- */

function BuildingDetail({
  building,
  plans,
  rooms,
  onSelectFloor,
  onAddFloor,
  onEditFloor,
  onRemoveFloor,
  onRemoveBuilding,
  onUpdateBuilding,
  onCapturePOV,
}: BuildingsViewProps & { building: POI }) {
  const buildingPlans = plans
    .filter((p) => p.buildingId === building.id)
    .sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0));
  const buildingRooms = rooms.filter((r) => r.buildingId === building.id);

  return (
    <Stack spacing={2} sx={{ pt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <ApartmentIcon sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {building.name}
        </Typography>
        <Chip
          label={`${buildingPlans.length} fl`}
          size="small"
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
        <Chip
          label={`${buildingRooms.length} rm`}
          size="small"
          sx={(t) => ({
            height: 20,
            fontSize: "0.7rem",
            bgcolor: alpha(t.palette.primary.main, 0.16),
            color: "primary.main",
          })}
        />
        <Tooltip title="Delete building">
          <IconButton
            size="small"
            onClick={() => {
              const msg =
                buildingRooms.length > 0 || buildingPlans.length > 0
                  ? `Delete "${building.name}"? This also removes ${buildingPlans.length} floor${buildingPlans.length === 1 ? "" : "s"} and ${buildingRooms.length} room${buildingRooms.length === 1 ? "" : "s"}.`
                  : `Delete "${building.name}"?`;
              if (typeof window !== "undefined" && window.confirm(msg)) {
                onRemoveBuilding(building.id);
              }
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <FormField label="Name">
        <TextField
          fullWidth
          size="small"
          value={building.name}
          onChange={(e) => onUpdateBuilding(building.id, { name: e.target.value })}
        />
      </FormField>
      <FormField label="Description">
        <TextField
          fullWidth
          size="small"
          multiline
          rows={2}
          placeholder="Short blurb shown on the public viewer card"
          value={building.description ?? ""}
          onChange={(e) =>
            onUpdateBuilding(building.id, { description: e.target.value })
          }
        />
      </FormField>
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.75 }}
        >
          Category
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {BUILDING_CATEGORIES.map((cat) => {
            const active = building.category === cat;
            return (
              <Chip
                key={cat}
                label={cat}
                size="small"
                clickable
                onClick={() =>
                  onUpdateBuilding(building.id, { category: cat })
                }
                sx={{
                  fontSize: "0.7rem",
                  height: 22,
                  bgcolor: active ? CATEGORY_COLORS[cat] : "action.hover",
                  color: active ? "#fff" : "text.secondary",
                }}
              />
            );
          })}
        </Box>
      </Box>

      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.75 }}
        >
          {building.view
            ? "Visitors fly to this saved view when they pick this building."
            : "Pan and zoom the map to where you want visitors to land, then capture."}
        </Typography>
        <Button
          variant={building.view ? "outlined" : "contained"}
          size="small"
          startIcon={<VideocamIcon sx={{ fontSize: 16 }} />}
          onClick={() => onCapturePOV(building.id)}
          sx={{ textTransform: "none" }}
        >
          {building.view ? "Re-capture point of view" : "Capture point of view"}
        </Button>
      </Box>

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
          Floors
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={() => onAddFloor(building.id)}
          sx={{ textTransform: "none" }}
        >
          Add floor
        </Button>
      </Stack>

      {buildingPlans.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 1, fontSize: "0.8125rem" }}
        >
          No floors yet. Add one to start drawing rooms.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {buildingPlans.map((plan) => {
            const roomCount = buildingRooms.filter(
              (r) => r.floor === plan.floor
            ).length;
            return (
              <Box
                key={plan.id}
                role="button"
                onClick={() => onSelectFloor(building.id, plan.id)}
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
                <LayersIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    fontWeight: 500,
                    fontSize: "0.875rem",
                  }}
                >
                  {floorLabel(plan)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.7rem" }}
                >
                  {roomCount} rm
                </Typography>
                <Tooltip title="Edit floor">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFloor(plan.id);
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <EditOutlinedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove floor">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFloor(plan.id);
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
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Floor detail                                */
/* -------------------------------------------------------------------------- */

function FloorDetail({
  building,
  plan,
  rooms,
  onSelectRoom,
  onDrawRoom,
  onEditFloor,
  onRemoveFloor,
}: BuildingsViewProps & {
  building: POI;
  plan: FloorPlan;
}) {
  const floorRooms = rooms
    .filter((r) => r.buildingId === building.id && r.floor === plan.floor)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Stack spacing={2} sx={{ pt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <LayersIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {floorLabel(plan)}
        </Typography>
        <Tooltip title="Edit floor">
          <IconButton size="small" onClick={() => onEditFloor(plan.id)}>
            <EditOutlinedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Remove floor">
          <IconButton size="small" onClick={() => onRemoveFloor(plan.id)}>
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Stack>

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
          Rooms
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={() => onDrawRoom(building.id, plan.floor, plan.id)}
          sx={{ textTransform: "none" }}
        >
          Draw room
        </Button>
      </Stack>

      {floorRooms.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 1, fontSize: "0.8125rem" }}
        >
          No rooms yet. Trace a polygon on the floor to add one.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {floorRooms.map((r) => {
            const tpl = getRoomTemplate(r.type);
            return (
              <Box
                key={r.id}
                role="button"
                onClick={() => onSelectRoom(r.id)}
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
                    bgcolor: tpl.color,
                    flexShrink: 0,
                  }}
                />
                <MeetingRoomIcon
                  sx={{ fontSize: 14, color: "text.secondary" }}
                />
                <Typography
                  variant="body2"
                  sx={{ flex: 1, fontWeight: 500, fontSize: "0.875rem" }}
                >
                  {r.name}
                </Typography>
                {r.roomNumber && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.7rem" }}
                  >
                    {r.roomNumber}
                  </Typography>
                )}
                <ChevronRightIcon
                  sx={{ fontSize: 16, color: "text.secondary" }}
                />
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Room detail                                 */
/* -------------------------------------------------------------------------- */

function RoomDetail({
  room,
  onUpdateRoom,
  onRemoveRoom,
}: BuildingsViewProps & {
  room: Room;
  building: POI | null;
  plan: FloorPlan | null;
}) {
  return (
    <Stack spacing={2} sx={{ pt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: getRoomTemplate(room.type).color,
            flexShrink: 0,
          }}
        />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
          {room.name}
        </Typography>
        <Tooltip title="Delete room">
          <IconButton size="small" onClick={() => onRemoveRoom(room.id)}>
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={1.5}>
        <FormField label="Name">
          <TextField
            fullWidth
            size="small"
            value={room.name}
            onChange={(e) => onUpdateRoom(room.id, { name: e.target.value })}
          />
        </FormField>
        <FormField label="Type">
          <TextField
            fullWidth
            size="small"
            select
            value={room.type}
            onChange={(e) =>
              onUpdateRoom(room.id, { type: e.target.value as Room["type"] })
            }
          >
            {ROOM_TEMPLATES.map((tpl) => (
              <MenuItem key={tpl.id} value={tpl.id}>
                {tpl.label}
              </MenuItem>
            ))}
          </TextField>
        </FormField>
        <FormField label="Room number">
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. B3-204"
            value={room.roomNumber ?? ""}
            onChange={(e) =>
              onUpdateRoom(room.id, {
                roomNumber: e.target.value || undefined,
              })
            }
          />
        </FormField>
        <FormField label="Lead occupant">
          <TextField
            fullWidth
            size="small"
            placeholder="Person or department"
            value={room.occupants?.[0]?.name ?? ""}
            onChange={(e) => {
              const name = e.target.value.trim();
              const role = room.occupants?.[0]?.role;
              onUpdateRoom(room.id, {
                occupants: name ? [{ name, role }] : undefined,
              });
            }}
          />
        </FormField>
        <FormField label="Occupant role">
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. Professor of Biology"
            value={room.occupants?.[0]?.role ?? ""}
            onChange={(e) => {
              const role = e.target.value.trim();
              const name = room.occupants?.[0]?.name;
              if (!name) return;
              onUpdateRoom(room.id, {
                occupants: [{ name, role: role || undefined }],
              });
            }}
          />
        </FormField>
        <FormField
          label="Search keywords"
          helperText="How visitors might look this room up — Bio 101, microbiology, lab-A."
        >
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={[]}
            value={room.searchKeywords ?? []}
            onChange={(_e, value) =>
              onUpdateRoom(room.id, {
                searchKeywords: value.length > 0 ? value : undefined,
              })
            }
            renderTags={(value, getTagProps) =>
              value.map((option, i) => {
                const { key, ...tagProps } = getTagProps({ index: i });
                return <Chip key={key} {...tagProps} label={option} size="small" />;
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Add a keyword + Enter"
                size="small"
              />
            )}
          />
        </FormField>
      </Stack>
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

function floorLabel(plan: FloorPlan): string {
  if (plan.name?.trim()) return plan.name.trim();
  const f = plan.floor ?? 0;
  if (f === 0) return "Ground floor";
  if (f < 0) return `Basement ${Math.abs(f)}`;
  return `Floor ${f}`;
}
