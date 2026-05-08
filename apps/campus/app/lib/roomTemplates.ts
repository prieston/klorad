import type { RoomType } from "@klorad/api";

export interface RoomTemplate {
  id: RoomType;
  label: string;
  /** Default extrusion height in metres for this room type. */
  heightM: number;
  /** Colour used when the room has no explicit override. */
  color: string;
  /** Short description shown in the template picker. */
  description: string;
}

/**
 * Starter room templates — the admin can still override colour/height
 * per-room, but these defaults cover ~90% of campus use cases.
 */
export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "office",
    label: "Office",
    heightM: 3,
    color: "#6B9CD8",
    description: "Professor, administrative, or meeting office.",
  },
  {
    id: "classroom",
    label: "Classroom",
    heightM: 3,
    color: "#10b981",
    description: "General-purpose teaching room.",
  },
  {
    id: "lab",
    label: "Lab",
    heightM: 3.5,
    color: "#a78bfa",
    description: "Computing, science, or research lab.",
  },
  {
    id: "amphitheatre",
    label: "Amphitheatre",
    heightM: 6,
    color: "#f59e0b",
    description: "Lecture hall with stepped seating.",
  },
  {
    id: "library",
    label: "Library",
    heightM: 4,
    color: "#f97316",
    description: "Study rooms, reading rooms, stacks.",
  },
  {
    id: "cafe",
    label: "Café / Cantina",
    heightM: 3,
    color: "#ec4899",
    description: "Food service and common rooms.",
  },
  {
    id: "wc",
    label: "WC",
    heightM: 3,
    color: "#94a3b8",
    description: "Restrooms and showers.",
  },
  {
    id: "utility",
    label: "Utility",
    heightM: 3,
    color: "#64748b",
    description: "Server, storage, maintenance.",
  },
  {
    id: "corridor",
    label: "Corridor",
    heightM: 3,
    color: "#cbd5e1",
    description: "Hallways and non-bookable circulation.",
  },
  {
    id: "other",
    label: "Other",
    heightM: 3,
    color: "#9ca3af",
    description: "Anything that doesn't fit the other buckets.",
  },
];

const TEMPLATE_MAP: Record<string, RoomTemplate> = ROOM_TEMPLATES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<string, RoomTemplate>
);

export function getRoomTemplate(type: string | null | undefined): RoomTemplate {
  if (!type) return TEMPLATE_MAP.other;
  return TEMPLATE_MAP[type] ?? TEMPLATE_MAP.other;
}

/** Resolved colour for a room — explicit override > template colour > fallback. */
export function roomColor(room: {
  type?: string;
  color?: string;
}): string {
  if (room.color) return room.color;
  return getRoomTemplate(room.type).color;
}

/** Resolved extrusion height for a room. */
export function roomHeightM(room: {
  type?: string;
  heightM?: number;
}): number {
  if (typeof room.heightM === "number" && room.heightM > 0) return room.heightM;
  return getRoomTemplate(room.type).heightM;
}
