import { createSceneAPI } from "@klorad/api";
import type { CampusAPI } from "@klorad/api";
import type { PostPlace } from "./posts";

/**
 * Campus places — the buildings, floors and rooms a news post can be
 * connected to. Read from the campus `sceneData` via the campus API
 * (the canonical accessor, so this needn't know the raw JSON shape).
 */
export interface PlaceOption extends PostPlace {
  /** Picker label — floors / rooms include their building for context. */
  label: string;
}

/** Extract a campus's buildings, floors and rooms from its sceneData. */
export function readCampusPlaces(sceneData: unknown): PlaceOption[] {
  let api: CampusAPI;
  try {
    api = createSceneAPI("mapbox", "campus") as CampusAPI;
    api.load((sceneData ?? {}) as Parameters<CampusAPI["load"]>[0]);
  } catch {
    return [];
  }

  // Buildings are POIs carrying a `linkedBuilding`.
  const buildings = api.poi.getAll().filter((p) => p.linkedBuilding);
  const buildingName = new Map(
    buildings.map((b) => [b.id, b.name || "Building"]),
  );
  const places: PlaceOption[] = [];

  for (const b of buildings) {
    const name = b.name || "Building";
    places.push({ id: b.id, kind: "building", name, label: name });
  }
  for (const f of api.floorPlans.getAll()) {
    const name =
      f.name ||
      (typeof f.floor === "number" ? `Floor ${f.floor}` : "Floor");
    const ctx = f.buildingId ? buildingName.get(f.buildingId) : undefined;
    places.push({
      id: f.id,
      kind: "floor",
      name,
      label: ctx ? `${name} — ${ctx}` : name,
    });
  }
  for (const r of api.rooms.getAll()) {
    const name = r.name || "Room";
    const ctx = r.buildingId ? buildingName.get(r.buildingId) : undefined;
    places.push({
      id: r.id,
      kind: "room",
      name,
      label: ctx ? `${name} — ${ctx}` : name,
    });
  }
  return places;
}
