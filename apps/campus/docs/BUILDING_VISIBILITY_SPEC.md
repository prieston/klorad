# Building Visibility Spec

Status: in progress (Phase 1)
Owner: campus team

## Problem

Today the 3D building extrusion is only rendered when its POI is selected,
and floor slabs only show when the user drills in. Two consequences:

1. The map looks empty when nothing is selected — you can't tell at a
   glance which buildings the customer has built.
2. When a floor *is* selected, the full building shell still renders on
   top, so you have to peek through it to see the rooms inside.

## Goals

- Always render every drawn building so the campus reads as a city.
- Cheap idle render — no per-floor detail when nothing is selected.
- When a floor is selected: clip the building to that floor and show
  the floor's room interior through transparent walls. Floors below
  show their outer walls only; floors above are hidden.

## States

### A — Idle (no floor selected)

Every drawn building renders as a single solid extrusion.

| Layer | Behaviour |
|---|---|
| `building-shells` | One feature per building. Height = `Σ floor.heightM` (or `linkedBuilding.heightM` when no floors yet). Opacity 0.85. Klorad neutral grey. |
| `floor-slabs` | Hidden. |
| `rooms` | Hidden. |

### B — Building selected (no specific floor)

Same as A, but the selected building tints to Klorad blue. The Buildings
tab tree has the building expanded; clicking a floor row moves to state C.

### C — Floor selected

The building shells are now rendered **per floor**. The fill-extrusion
data source emits one feature per (building × floor) pair, with
`base = floor × heightM` and `height = (floor + 1) × heightM`.

| Layer | Behaviour |
|---|---|
| `building-shells` | Filter: `floor <= activeFloor`. Selected floor opacity = 0.15 (x-ray). Floors below = 0.6 (outer walls visible). Floors above = hidden by filter. Selected building only — other buildings keep state A. |
| `floor-slabs` | Visible for the selected building. Selected floor's slab tinted blue; below floors' slabs in neutral. |
| `rooms` | Filter to `room.floor === activeFloor` (already implemented). Sit at `floor × heightM + 0.2` so they rest on the slab. |

### D — Drawing a room

Same as C plus the user is in `drawRoom` mode. The selected building's
shell remains x-ray (0.15). Crosshair cursor; existing rooms on the
active floor stay visible to give context.

## Layer model

Replace the current single-extrusion `useMapboxDrawnBuildingsLayer` with
a per-floor data source so the geometry is the same regardless of state.

```
campus-building-shells
├─ source: GeoJSON FeatureCollection of (building × floor) polygons
├─ fill-extrusion layer: per-feature base/height + filter + opacity
└─ line layer: outline (always visible for active floors)
```

When a building has zero floors, synthesise one "virtual floor" with
height = `linkedBuilding.heightM ?? 12` so the user sees a block from
the moment they finish drawing.

When floors exist, the synthesised floor is dropped — the shell is the
sum of real floors.

## Floor heights

- Default per-floor height: `FLOOR_HEIGHT_M = 3`.
- Each `FloorPlan` may override: `FloorPlan.heightM?` (added as part of
  this work).
- Sum-of-floor-heights drives the building's total height in state A.

## Public viewer

Same rules with one exception: there is no "no floor selected" idle
state — when a building is selected, default to its lowest floor so
the user sees rooms immediately.

## Out of scope (next pass)

- Per-floor polygon override (each floor inherits the building polygon
  for now).
- Vertical circulation (stairs / elevators) connecting floors.
- Door / window placement on rooms.
- Snap-to-edge on draw.
- Wall thickness.

## Implementation checklist

- [ ] `FloorPlan.heightM?` field on `@klorad/api`.
- [ ] `useMapboxBuildingShellsLayer` (refactor of
  `useMapboxDrawnBuildingsLayer`) — emits per-floor features, applies
  filter + opacity case-expressions based on active floor.
- [ ] Update `useMapboxFloorSlabsLayer` to render only when a floor is
  active, highlighting the selected one.
- [ ] BuilderClient passes `activeFloor: number | null` (derived from
  `activePlan?.floor ?? pendingRoomFloor`) to both layers.
- [ ] PublicViewerClient: same wiring with the "default to lowest
  floor" tweak.
