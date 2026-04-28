"use client";

import { useMemo, useState } from "react";
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ApartmentIcon from "@mui/icons-material/Apartment";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LayersIcon from "@mui/icons-material/Layers";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { FloorPlan, POI, Room } from "@klorad/api";
import { getRoomTemplate } from "@/app/lib/roomTemplates";

interface Props {
  pois: POI[];
  plans: FloorPlan[];
  rooms: Room[];
  selectedPoiId: string | null;
  activePlanId: string | null;
  activeRoomId: string | null;
  onSelectBuilding: (poiId: string) => void;
  onSelectFloor: (poiId: string, planId: string | null) => void;
  onSelectRoom: (roomId: string) => void;
  onEditRoom: (roomId: string) => void;
  onAddFloor: (buildingPoiId: string) => void;
  onEditFloor: (planId: string) => void;
  onRemoveFloor: (planId: string) => void;
  /** Pre-scope building+floor and start the Draw Room tool. */
  onDrawRoom: (buildingPoiId: string, floor: number, planId: string | null) => void;
}

interface Floor {
  /** Numeric floor index (0 = ground). */
  floor: number;
  /** A FloorPlan record if the user uploaded one for this floor. */
  plan: FloorPlan | null;
  /** Rooms whose `floor` matches. */
  rooms: Room[];
}

interface BuildingNode {
  poi: POI;
  floors: Floor[];
}

function floorLabel(floor: number): string {
  if (floor === 0) return "Γ · Ground";
  if (floor < 0) return `B${Math.abs(floor)} · Basement`;
  return `${floor}${floor === 1 ? "st" : floor === 2 ? "nd" : floor === 3 ? "rd" : "th"} floor`;
}

export default function BuildingsTree({
  pois,
  plans,
  rooms,
  selectedPoiId,
  activePlanId,
  activeRoomId,
  onSelectBuilding,
  onSelectFloor,
  onSelectRoom,
  onEditRoom,
  onAddFloor,
  onEditFloor,
  onRemoveFloor,
  onDrawRoom,
}: Props) {
  const buildings = useMemo<BuildingNode[]>(() => {
    const linked = pois.filter((p) => p.linkedBuilding);
    return linked.map((p) => {
      const buildingPlans = plans.filter((pl) => pl.buildingId === p.id);
      const buildingRooms = rooms.filter((r) => r.buildingId === p.id);
      const floorIdxs = new Set<number>();
      buildingPlans.forEach((pl) => floorIdxs.add(pl.floor ?? 0));
      buildingRooms.forEach((r) => floorIdxs.add(r.floor));
      const floors: Floor[] = Array.from(floorIdxs)
        .sort((a, b) => a - b)
        .map((floor) => ({
          floor,
          plan: buildingPlans.find((pl) => (pl.floor ?? 0) === floor) ?? null,
          rooms: buildingRooms.filter((r) => r.floor === floor),
        }));
      return { poi: p, floors };
    });
  }, [pois, plans, rooms]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) }));
  const isOpen = (id: string) => expanded[id] ?? true;

  if (buildings.length === 0) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 0.5,
        }}
      >
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
      </Box>
      <Stack spacing={0.5}>
        {buildings.map((b) => (
          <BuildingRow
            key={b.poi.id}
            building={b}
            isSelected={selectedPoiId === b.poi.id}
            isOpen={isOpen(b.poi.id)}
            activePlanId={activePlanId}
            activeRoomId={activeRoomId}
            onToggle={() => toggle(b.poi.id)}
            onSelectBuilding={() => onSelectBuilding(b.poi.id)}
            onSelectFloor={(planId) => onSelectFloor(b.poi.id, planId)}
            onSelectRoom={onSelectRoom}
            onEditRoom={onEditRoom}
            onAddFloor={() => onAddFloor(b.poi.id)}
            onEditFloor={onEditFloor}
            onRemoveFloor={onRemoveFloor}
            onDrawRoom={(floor, planId) => onDrawRoom(b.poi.id, floor, planId)}
          />
        ))}
      </Stack>
    </Box>
  );
}

function BuildingRow({
  building,
  isSelected,
  isOpen,
  activePlanId,
  activeRoomId,
  onToggle,
  onSelectBuilding,
  onSelectFloor,
  onSelectRoom,
  onEditRoom,
  onAddFloor,
  onEditFloor,
  onRemoveFloor,
  onDrawRoom,
}: {
  building: BuildingNode;
  isSelected: boolean;
  isOpen: boolean;
  activePlanId: string | null;
  activeRoomId: string | null;
  onToggle: () => void;
  onSelectBuilding: () => void;
  onSelectFloor: (planId: string | null) => void;
  onSelectRoom: (roomId: string) => void;
  onEditRoom: (roomId: string) => void;
  onAddFloor: () => void;
  onEditFloor: (planId: string) => void;
  onRemoveFloor: (planId: string) => void;
  onDrawRoom: (floor: number, planId: string | null) => void;
}) {
  const totalRooms = building.floors.reduce((n, f) => n + f.rooms.length, 0);

  return (
    <Box
      sx={(t) => ({
        borderRadius: 1,
        border: "1px solid",
        borderColor: isSelected ? alpha(t.palette.primary.main, 0.4) : "divider",
        bgcolor: isSelected ? alpha(t.palette.primary.main, 0.06) : "transparent",
        overflow: "hidden",
      })}
    >
      <Box
        role="button"
        onClick={() => {
          onToggle();
          onSelectBuilding();
        }}
        sx={(t) => ({
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.75,
          cursor: "pointer",
          "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.06) },
        })}
      >
        {isOpen ? (
          <ExpandMoreIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        )}
        <ApartmentIcon sx={{ fontSize: 16, color: "primary.main" }} />
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            fontWeight: isSelected ? 600 : 500,
            fontSize: "0.8125rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {building.poi.name}
        </Typography>
        <Tooltip title={`${building.floors.length} floors · ${totalRooms} rooms`}>
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            {building.floors.length > 0 && (
              <Chip
                label={building.floors.length}
                size="small"
                sx={{ height: 18, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            )}
            {totalRooms > 0 && (
              <Chip
                label={`${totalRooms} rm`}
                size="small"
                sx={{ height: 18, fontSize: "0.65rem", "& .MuiChip-label": { px: 0.75 } }}
              />
            )}
          </Stack>
        </Tooltip>
      </Box>
      {isOpen && building.floors.length === 0 && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.7rem", display: "block", mb: 1 }}
          >
            No floor plans yet.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onAddFloor();
            }}
            sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
          >
            Add floor
          </Button>
        </Box>
      )}
      {isOpen &&
        building.floors.map((f) => (
          <FloorRow
            key={f.floor}
            floor={f}
            buildingPoiId={building.poi.id}
            isActive={f.plan ? activePlanId === f.plan.id : false}
            activeRoomId={activeRoomId}
            onSelectFloor={() => onSelectFloor(f.plan?.id ?? null)}
            onSelectRoom={onSelectRoom}
            onEditRoom={onEditRoom}
            onEditFloor={() => f.plan && onEditFloor(f.plan.id)}
            onRemoveFloor={() => f.plan && onRemoveFloor(f.plan.id)}
            onDrawRoom={() => onDrawRoom(f.floor, f.plan?.id ?? null)}
          />
        ))}
      {isOpen && building.floors.length > 0 && (
        <Box sx={{ px: 2, py: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onAddFloor();
            }}
            sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
          >
            Add floor
          </Button>
        </Box>
      )}
    </Box>
  );
}

function FloorRow({
  floor,
  buildingPoiId: _buildingPoiId,
  isActive,
  activeRoomId,
  onSelectFloor,
  onSelectRoom,
  onEditRoom,
  onEditFloor,
  onRemoveFloor,
  onDrawRoom,
}: {
  floor: Floor;
  buildingPoiId: string;
  isActive: boolean;
  activeRoomId: string | null;
  onSelectFloor: () => void;
  onSelectRoom: (roomId: string) => void;
  onEditRoom: (roomId: string) => void;
  onEditFloor: () => void;
  onRemoveFloor: () => void;
  onDrawRoom: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Box
      sx={(t) => ({
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: isActive ? alpha(t.palette.primary.main, 0.08) : "transparent",
      })}
    >
      <Box
        role="button"
        onClick={() => {
          setOpen((o) => !o);
          onSelectFloor();
        }}
        sx={(t) => ({
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 3.5,
          pr: 1,
          py: 0.5,
          cursor: "pointer",
          "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.06) },
        })}
      >
        {open ? (
          <ExpandMoreIcon sx={{ fontSize: 14, color: "text.secondary" }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 14, color: "text.secondary" }} />
        )}
        <LayersIcon sx={{ fontSize: 14, color: "text.secondary" }} />
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            fontSize: "0.75rem",
            fontWeight: isActive ? 600 : 400,
            color: isActive ? "primary.main" : "text.primary",
          }}
        >
          {floor.plan?.name?.trim() || floorLabel(floor.floor)}
        </Typography>
        {floor.plan && (
          <Tooltip title="Floor plan uploaded">
            <Chip
              label="plan"
              size="small"
              sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.5 } }}
            />
          </Tooltip>
        )}
        {floor.rooms.length > 0 && (
          <Chip
            label={floor.rooms.length}
            size="small"
            sx={(t) => ({
              height: 16,
              fontSize: "0.6rem",
              "& .MuiChip-label": { px: 0.5 },
              bgcolor: alpha(t.palette.primary.main, 0.16),
              color: "primary.main",
            })}
          />
        )}
        <Tooltip title="Draw room on this floor">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDrawRoom();
            }}
            sx={{ p: 0.25 }}
          >
            <AddIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
        {floor.plan && (
          <>
            <Tooltip title="Edit floor plan">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditFloor();
                }}
                sx={{ p: 0.25 }}
              >
                <EditOutlinedIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove floor">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFloor();
                }}
                sx={{ p: 0.25 }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
      {open &&
        floor.rooms.map((r) => (
          <RoomRow
            key={r.id}
            room={r}
            isSelected={activeRoomId === r.id}
            onSelect={() => onSelectRoom(r.id)}
            onEdit={() => onEditRoom(r.id)}
          />
        ))}
    </Box>
  );
}

function RoomRow({
  room,
  isSelected,
  onSelect,
  onEdit,
}: {
  room: Room;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const tpl = getRoomTemplate(room.type);
  return (
    <Box
      role="button"
      onClick={onSelect}
      sx={(t) => ({
        display: "flex",
        alignItems: "center",
        gap: 1,
        pl: 6,
        pr: 1,
        py: 0.5,
        cursor: "pointer",
        bgcolor: isSelected ? alpha(t.palette.primary.main, 0.12) : "transparent",
        "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.06) },
      })}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: tpl.color,
          flexShrink: 0,
        }}
      />
      <MeetingRoomIcon sx={{ fontSize: 12, color: "text.secondary" }} />
      <Typography
        variant="caption"
        sx={{
          flex: 1,
          fontSize: "0.75rem",
          fontWeight: isSelected ? 600 : 400,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {room.name}
      </Typography>
      {room.roomNumber && (
        <Typography
          variant="caption"
          sx={{ fontSize: "0.7rem", color: "text.secondary", flexShrink: 0 }}
        >
          {room.roomNumber}
        </Typography>
      )}
      <Tooltip title="Edit room">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          sx={{ p: 0.25 }}
        >
          <EditOutlinedIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
