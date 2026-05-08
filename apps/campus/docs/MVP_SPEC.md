# Klorad Campus — v1 MVP Spec

Polish pass to ship Campus as a confident v1. The feature set is in place
(buildings, floors, rooms, sharing). What's missing is a coherent
**workflow** in the studio and a **single, seamless panel** in the public
viewer. This spec defines both.

The spec is opinionated — its job is to remove decisions, not list them.

---

## 1. Goals

- **One mental model**, top-to-bottom: Location → Buildings → POIs → Share → Save.
- **One interaction pattern** per surface — breadcrumbs in the studio, an
  inner-navigated panel in the viewer. No drawers, no modals, no popovers
  that float on top of one of the panels we already own.
- **Mobile from day one**. The viewer must read like a real app on a
  phone, not a desktop site shoved into 360px.
- **No empty states** that look unfinished. If a panel has nothing to
  show, it shows the *next action*, not a blank list.

## 2. Non-goals

- New layer types (heatmaps, traffic, transit overlays).
- Editing on the public viewer.
- Vertical circulation (stairs / lifts / pathfinding inside a building).
- Multi-language content authoring (UI is bilingual; content is single-language).

These are v2 concerns. Ship v1 without them.

---

## 3. Studio — right panel: workflow

Keep today's five `ActionButton` icons across the top of the right
panel. The only chrome change is the **order** — they read left-to-right
as the user's actual workflow:

```
Location · Buildings · POIs · Share · Save
```

(Today they're `Location · POI · Buildings · Share · Save` — POI and
Buildings are swapped.)

What each step covers:

1. **Location** — pick the campus's centre + bounding camera view.
2. **Buildings** — draw / link building footprints, then floors, then
   rooms. Most of the work happens here.
3. **POIs** — drop wayfinding pins (cafés, entrances, parking,
   landmarks). POIs that *belong* to a building (e.g. "Library
   entrance") attach to the building rather than living at the top
   level.
4. **Share** — visibility, branding, public URL.
5. **Save** — explicit save; shows last-saved timestamp + a "Saving…"
   spinner while in flight.

### Step content — Buildings (the only complex one)

This is where the breadcrumb navigation lives.

```
Buildings  /  Block A  /  Floor 1  /  Room 204
```

- **Buildings (root)**: list of cards with thumbnail (auto from polygon
  + colour swatch), name, room count, "Edit"/"Delete" affordances. CTA
  card "+ Draw building" at the top.
- **Building**: details strip at top (name, polygon edit, height,
  description, delete) + "Floors" list below. "+ Add floor" at top of
  the list. Click a floor → drills in.
- **Floor**: details strip (name, floor index, optional plan image
  upload, delete) + "Rooms" list below. "+ Draw room" CTA.
- **Room**: details (name, type, room number, occupants, **search
  keywords** — NEW), polygon edit, delete.

Breadcrumbs are clickable and the only way to go up. **No accordions.
No tree.** The current `BuildingsTree.tsx` is replaced with four small
view components driven by a single `selectedBuildingId / selectedFloorId
/ selectedRoomId` triplet.

### Step content — Location, POIs, Share, Save

- **Location** — keep the current map-pick + camera capture. Add a
  one-line readout of the chosen lat/lng and the basemap config that
  was saved. Empty state: "Pick a centre on the map to start."
- **POIs** — flat list. Detail view (selected POI) shows form inline.
  A POI that's attached to a building shows a chip linking back to that
  building's breadcrumb.
- **Share** — public toggle, copy URL, brand colour, logo upload, locale
  default, og-image preview. Today this is spread across the studio;
  pull it all here.
- **Save** — last-saved timestamp + save button. Also surface "Unsaved
  changes" inline above the button so the state is unambiguous.

## 4. Studio — left panel: project health

Today there's no left panel content; the map fills it. Add a slim
(280px) **Project Health** rail that's always visible on desktop and
collapses to an icon strip on tablet/mobile.

Sections, top to bottom:

1. **Completeness** — checklist with green ticks:
   - Location set
   - At least one building drawn
   - All buildings have ≥ 1 floor
   - All floors with rooms have a name
   - Brand colour + logo set
   - Public URL has a name (not "Untitled map")

2. **Counts** — "12 buildings · 47 floors · 184 rooms · 23 POIs". One
   line, monospace, no chrome.

3. **Issues** — orphans + lints. Examples:
   - Rooms whose `buildingId` no longer points to a building.
   - Buildings with 0 floors.
   - POIs outside the campus bounding box.
   - Floors with the same number on the same building.

   Each issue is a one-line row with a "Fix →" affordance that jumps
   the right panel to the offending entity.

4. **Tips** — a single rotating tip referencing the user's current
   step ("Tip: hold ⇧ while dragging a polygon vertex to lock to the
   adjacent edge"). One sentence; no carousel.

The left panel is a *passive* surface. No editing happens here; it
points at problems and at the right panel.

---

## 5. Public viewer — single panel, no drawers

Replace the MUI `<Drawer>` in `PublicViewerClient.tsx` with the same
glass `RightPanelContainer` pattern the studio uses (or a thin wrapper
in `@klorad/ui` if it's not already public).

### Layout

- **Desktop (≥ 1024px)**: panel docked **left**, 360px, full height,
  always visible. The map fills the rest.
- **Tablet (768–1023px)**: panel docked left, 320px. Same as desktop.
- **Mobile (< 768px)**: panel is a **bottom sheet** that snaps to two
  positions — "peek" (header + ~88px body) and "full" (covers ~80% of
  the viewport). Drag handle at the top. The map stays usable in peek
  mode. *No modal scrim*; the map is never locked.

### Inner navigation

Four states, identical to today's logic but rendered inside the panel
instead of a drawer:

1. **Home** — search field + tabs `Places · Rooms · Tour`. Tabs only
   show when content exists (no empty Tour tab on a campus with no
   tour). The search box is the primary affordance — it's always
   focused on desktop.
2. **Building** — name, hero (auto-rendered from polygon top-down),
   floors list, "Get directions here" button.
3. **Floor** — floors strip across the top (so the user can swipe
   between floors without going up), rooms list below.
4. **Room** — type pill, occupants, schedule, "Get directions here",
   keywords as small chips.

Back arrow in the header walks one level up. Closing the panel returns
to home (mobile collapses to peek).

### Floating UI to remove

- The right-side floor switcher (already removed; keep it removed).
- The floating "active room" card on the bottom-left (already gone).
- The toolbar pill at the top — fold those four icons (search,
  directions, tour, layers) into the panel header so the map is
  uncluttered. *Search, Directions, Layers* become tabs/sections inside
  the panel; *Tour* lives under Home → Tour tab.
- The bottom-right "Where am I" FAB stays — it's the one map-level
  control that earns its spot.

### Bilingual

Greek/English toggle moves into the panel footer. Hidden on the map
itself. The current top-right pill is decoration.

---

## 6. Data model change — room.searchKeywords

Today: rooms are searched by `name`, `roomNumber`, and occupant names.

Add a freeform `searchKeywords: string[]` field on `Room` (api package
+ store). Studio room form gets a "Keywords" chip-input row directly
under the name. Public viewer's search now also matches this field, and
the room detail panel renders the keywords as muted chips so visitors
see *why* their query landed on this room ("Bio 101 → matched: bio,
microbiology, lab-A"). This is the single biggest discoverability win
and costs ~20 lines of code.

---

## 7. Things to hide / deprecate

These are visible in the current build and should be hidden behind a
feature flag (or removed) before v1:

- **Studio**:
  - The "Layers" floating card on the bottom-right of the studio canvas
    (rooms / labels / floor plan toggles). Move into Project Health
    left panel as a "Display" section, or remove for v1.
  - Multi-select + bulk delete for POIs (task #24, still pending). Hide
    the multi-select toggle until it's done; the half-finished state
    reads as unpolished.
  - Any leftover "Assets" tab references in the empty-state copy
    (e.g. *"Upload a floor plan in the Assets tab — it shows up here as
    a floor"*). The Assets tab no longer exists.
  - The legacy POI "type" categories that don't render any meaningful
    differentiation on the map. Audit the list, keep ~6, retire the
    rest.

- **Public viewer**:
  - The wayfinding "A11y" mode toggle if no campus has set up
    accessible routes. Show only when the data exists.
  - The "Tour" pill if `tourStops.length === 0`. Already gated; verify.

## 8. Phasing

Ship in three short PRs, each independently mergeable:

**Phase 1 — viewer panel rewrite** *(highest user-visible payoff)*
- Replace `<Drawer>` with the docked panel + bottom-sheet on mobile.
- Move toolbar pill icons into the panel header.
- Hide locale toggle's top-right pill; move into panel footer.

**Phase 2 — studio breadcrumb navigation**
- Replace `BuildingsTree.tsx` with four small view components and a
  breadcrumb header.
- Add `searchKeywords` to the `Room` model + form + viewer search.
- Stepper-styled segmented control across right panel.

**Phase 3 — left-panel project health**
- Add `ProjectHealthPanel` driven by a `useProjectHealth()` hook that
  reads the scene store and produces the checklist + issues list.
- Each issue links to the right panel with the offending entity
  pre-selected (router-style — push `{view, id}` onto a small nav
  store).

Each phase is roughly a day. Phase 1 alone makes the campus feel
significantly more polished to a public visitor.

---

## 9. Out of scope, but worth a sentence

- **Auto-save**: tempting, but explicit Save fits the workflow story
  ("now that you're done, save"). Revisit in v1.1 once the workflow is
  internalised.
- **Versioning / undo across sessions**: undo within session works
  today (task #25). Cross-session is v2.
- **Custom polygon editing handles**: today vertices snap; full
  affordance (insert/delete vertex, drag mid-edge) is v2.

---

## Appendix A — files touched per phase

Phase 1:
- `apps/campus/app/(public)/campus/[token]/PublicViewerClient.tsx`
  (rewrite drawer → docked panel; move toolbar)
- `apps/campus/app/components/CampusViewerPanel.tsx` *(new)* — the
  inner-navigated panel with `home | building | floor | room` states.
- `packages/ui/src/components/panels/BottomSheet.tsx` *(new)* — minimal
  bottom-sheet primitive (no library dependency).

Phase 2:
- `apps/campus/app/(dashboard)/org/[orgId]/maps/[mapId]/builder/BuilderClient.tsx`
  (reorder action buttons to Location · Buildings · POIs · Share · Save;
  swap buildings view body for the new breadcrumb stack)
- `apps/campus/app/(dashboard)/org/[orgId]/maps/[mapId]/builder/BuildingsTree.tsx`
  *(deleted)*
- `apps/campus/app/(dashboard)/org/[orgId]/maps/[mapId]/builder/buildings/`
  *(new directory)* — `BuildingsRoot.tsx`, `BuildingDetail.tsx`,
  `FloorDetail.tsx`, `RoomDetail.tsx`, `Breadcrumbs.tsx`.
- `packages/api/src/types/campus.ts` — add `searchKeywords?: string[]`
  to `Room`.
- `packages/api/src/extensions/campus.ts` — read/write `searchKeywords`.

Phase 3:
- `apps/campus/app/(dashboard)/org/[orgId]/maps/[mapId]/builder/health/ProjectHealthPanel.tsx`
  *(new)*
- `apps/campus/app/hooks/useProjectHealth.ts` *(new)* — derives the
  completeness + issues lists from the scene store.
- `apps/campus/app/(dashboard)/org/[orgId]/maps/[mapId]/builder/BuilderClient.tsx`
  (mount the left panel; wire issue → right-panel jumps).
