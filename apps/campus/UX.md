# Topos Campus — UX Spec

> Companion to `PRODUCT.md`. This doc defines **layout intent,
> interaction flows, and mobile behavior** for Phase 1 screens —
> tight enough to implement from, loose enough to iterate without
> a Figma round-trip.

---

## 0. UX Principles (recap)

1. **Self-service or it didn't ship.** Every flow must be doable by a
   non-technical marketing assistant.
2. **Instant-on.** No splash screen. Map renders in <2s, even if scene
   data is still loading.
3. **Spline / Figma / Framer mental model.** LEFT = project/scene
   scope. RIGHT = selected-object scope. Canvas in the middle. Tool
   icons float over the canvas.
4. **Thumb-zone on mobile.** Anything actionable sits in the bottom
   40% of the screen. Top half is for content / map.
5. **Deep-linkable by default.** Every important state (selected POI,
   active floor, wayfinding route) survives a URL copy/paste.
6. **Anonymous analytics only on the public viewer.** Never a login
   wall for visitors; capture behavior, not identity.

---

## 1. Route Map

```
/                                                   → redirect
/auth/signin                                        → OAuthSignInCard

[DASHBOARD — AppSidebar visible]
/org/[orgId]/maps                                   → Master Dashboard (maps list)
/org/[orgId]/maps/[mapId]                           → Campus Profile (NEW)
  ?tab=overview      (default)
  ?tab=settings
  ?tab=assets
  ?tab=integrations
  ?tab=analytics     (later)

[STUDIO — AppSidebar hidden, BuilderLeftPanel visible]
/org/[orgId]/maps/[mapId]/builder                   → Studio (editor)

[PUBLIC — no auth]
/campus/[mapId]                                     → Public Viewer
  ?poi=<id>                                         → auto-select + fly
  ?floor=<n>                                        → auto-switch floor
  ?from=<poi>&to=<poi>&mode=walk|a11y               → auto-route
  ?lang=el|en                                       → language override
```

### Navigation hierarchy

```
Master Dashboard (all campuses)
  ↓
Campus Profile (overview / settings / assets / integrations)
  ↓
Studio (spatial editor)            ← "Enter Studio" CTA from Profile
```

Reverse navigation: every Studio page has a back link to its Campus
Profile; every Profile has a back link to Master Dashboard.

---

## 2. Master Dashboard (`/org/[orgId]/maps`)

**Purpose:** list of all campuses in the org, status at a glance.

**Layout** (desktop, 1280+):
- AppSidebar on left (360px glass panel, already built)
- Page content uses `Page` → `PageHeader("Campus Maps")` → `PageContent`
- `DashboardCreateProjectCard` + grid of `DashboardProjectCard` (already built)

**Additions for Phase 1:**
- **Status badge** top-right of each card: `● Live` (primary blue), `○ Draft`
  (muted), `⚠ Sync Error` (warning amber).
- **Stats row** under title: "3 maps · 147 POIs · 12.4k views this month"
  (if org has any analytics).

**Empty state:**
- Folder-with-plus illustration + "Create your first campus map" + CTA.

---

## 3. Campus Profile (`/org/[orgId]/maps/[mapId]`) — NEW

**Purpose:** administrative home for a single campus, before entering
the Studio. This is where marketing teams, integration owners, and
the Studio editor converge.

**Layout** (desktop):
- AppSidebar on left (360px glass panel, Maps + Settings nav).
- `Page` wrapper (sidebarOffset=392), `PageHeader` with breadcrumbs:
  `Maps › {Campus Name}`.
- Subheader row: campus name (h5), Live/Draft toggle, **"Enter Studio"**
  primary button on the right.
- Tabs bar (MUI Tabs, underline indicator): Overview · Settings · Assets
  · Integrations · Analytics.
- Tab content in `PageContent`.

### Tab: Overview (default)

Four `MetricCard`s in a row (reuse `@klorad/ui/MetricCard`):
- POIs (total + by category pie)
- Views this month (+ delta vs. last month)
- Top searches (top 5 as a list with counts)
- Compliance score (accessibility completeness %)

Below the metrics:
- **"Enter Studio" primary CTA card** with screenshot thumbnail.
- **Recent activity feed** ("Alice added 'Library Main' · 2h ago").

### Tab: Settings

Reuses current `/settings` content (Share URL + embed) plus:
- **Campus name** editable.
- **Branding**: logo upload (SVG/PNG 240×60 target) + primary color
  picker.
- **Language defaults**: primary (EL) + secondary (EN) checkboxes.
- **Publishing**: Live/Draft toggle (same control as the header toggle),
  custom subdomain (later), password-protect (later).
- **Member permissions**: table of org members with role (Admin /
  Editor / Viewer).

### Tab: Assets

**Purpose:** pre-load media that the Studio will reference.

- **Floor Plans** section: grid of uploaded floor plan images, each
  with filename, associated building (or "Unassigned"), dimensions,
  and a "Georeference" button (opens modal → drag corners on the map).
- **360° Photos** (deferred — card with "Contact us to enable").
- **Media Library**: drag-drop upload for POI images.

**Empty state per section:** upload illustration + "Drop files here or
click to upload."

### Tab: Integrations

- **Google Calendar**: connect button → OAuth → list of calendars to
  sync. Per-calendar "Map to POI by venue name" config.
- **Outlook / M365**: same shape.
- **ICS feeds**: add-URL form, list of configured feeds.
- **Facebook Events** (Phase 3): placeholder card.
- **Webhooks** (Phase 3): placeholder.

Each integration card shows last sync time + success/error status.

### Tab: Analytics (Phase 2)

Placeholder now. Later: heatmap of POI views, search query log,
route-request breakdown, per-POI page views.

---

## 4. Studio (`/org/[orgId]/maps/[mapId]/builder`)

Mostly built. Phase 1 additions:

### Left panel — add "Layers" accordion

Current left panel has two tabs: **Campus** and **Environment**.

Add a third tab: **Layers**. Contents:
- Accordion: **POIs** (N) — scrollable list, click-to-select, eye icon
  to toggle visibility, color chip = category.
- Accordion: **Tours** (N) — list of published tours, click opens tour
  editor inline.
- Accordion: **Floor Plans** (N) — list per building, click switches
  the map to that floor (studio-side preview of public behavior).
- Accordion: **Data Layers** (N) — custom GeoJSON overlays.

Visible-in-viewport checkbox per item lets admins work on one category
at a time ("hide Parking while I place Housing pins").

### Scene toolbar — add Indoor tools

Current tools: Select, Link Building. Add:
- **Add Floor Plan** — enters floor-plan placement mode; user draws
  a bounding box on the map, uploads image, we auto-georeference.
- **Draw Path** — wayfinding path editor; clicks drop nodes, double-click
  to finish. Nodes can be tagged "stairs" or "ramp".
- **Measure** — click two points, show distance in meters.

### Right panel — stays the same

POI editor (when a POI is selected) with Name, Description, Category,
Position, View, Linked Building, plus new Indoor section when POI is
inside a building: Floor selector + (x, y) on the floor plan.

---

## 5. The Three Flagship Moments (Phase 1 demo)

### 5.1 Level Switcher + Roof Lift

**Trigger:** user clicks a multi-storey building on the map (public
viewer or studio preview).

**UI:**
- A vertical pill stack appears docked to the **right edge, 40% from
  top**, z-index above the map, glass-effect (reuse `SceneToolbar`
  styling). Pill buttons top-to-bottom: `3 · 2 · 1 · Γ` (Greek ground
  floor). Currently-active floor highlighted primary.
- When a floor is selected:
  1. Camera tilts down (pitch → 55°) and zooms to the building.
  2. **Roof Lift**: the Mapbox Standard-v3 building extrusion dims its
     opacity from 0.95 → 0.15 over 400ms via `fill-extrusion-opacity`
     + `feature-state`.
  3. The floor plan image (from Assets) fades in over the footprint
     at 85% opacity.
  4. Indoor POIs for that floor render as smaller pins (r=6) with
     their labels.
- Click the currently-active pill again → roof restores, plan fades
  out, outdoor POIs return.

**Mobile:** pill stack stays on the right edge, slightly wider for
thumbs (48px width).

### 5.2 Accessibility Path

**Trigger:** user opens wayfinding panel (public viewer, floating
bottom-left card), enters A and B, sees a toggle: `Standard ◄───►
Step-free`.

**UI:**
- Standard: route rendered as a **blue** line (primary `#6B9CD8`),
  5px wide, rounded caps, animated dash (flows A→B).
- Step-free: same line **purple** (`#a78bfa`), routes via tagged
  elevators / ramps, avoids stair-tagged nodes.
- Stair nodes render as a small ⛔ icon with tooltip "Stairs — switch
  to step-free" when a standard route crosses them.
- Step-free mode also highlights accessible entrances with a green
  ♿ icon.

**URL:** `?from=<poi>&to=<poi>&mode=walk|a11y` → deep link reopens
the same route.

### 5.3 Search-to-Event (nested reveal)

**Trigger:** user types `Bio 101` in the public viewer search.

**Flow (matches Concept3D's "magical" moment):**
1. **Query → Building Highlight**: search picks building → camera
   flies to Building Γ, building glows (outline + subtle pulse).
2. **Floor Reveal**: after 400ms, the Level Switcher auto-opens on
   floor 2, Roof Lift animates.
3. **Room Pin**: the specific room (Room 207) gets a pulsing primary
   dot + popup card.
4. **Event overlay**: bottom sheet slides up with:
   - Course title: "Introduction to Molecular Biology"
   - Time: "Now — 10:30 to 12:00" (or "Next: 14:00 Tomorrow")
   - Lecturer: "Prof. Παπαδόπουλος"
   - Actions: "Add to calendar" · "Directions from here"

**Each step is a URL state** — copy-paste the URL during the demo and
it reopens to the exact end state:

```
/campus/<mapId>?poi=<roomId>&floor=2&event=<eventId>
```

---

## 6. Public Viewer — Mobile Pass

Target: iPhone 13 mini (375×812) through iPad (1024×1366).

### Top (safe area + 16px)

- Hamburger icon (left) → opens drawer with categories & layers.
- Search bar (center-right, takes most of the row) → tap expands to
  full-screen search.
- Language pill (right) → `EL` / `EN` toggle.

### Map (full remaining viewport)

- POI pins stay 12px hit-target minimum (larger than desktop).
- Label truncation under 8 chars + ellipsis.

### Right edge (thumb-zone)

- **Level Switcher pill** (when a building is selected, vertical stack).

### Bottom FAB + Bottom Sheet (thumb-zone)

- **FAB — "Where am I"** (bottom-right, 16px from edge, 56px circle):
  uses browser Geolocation, drops a blue pulsing "you are here" dot,
  pans to it.
- **Bottom Sheet** (Google Maps / Apple Maps style):
  - Collapsed (peek 96px): search bar preview + "Near Me" chip.
  - Half-expanded (40% height): search results + category filters.
  - Full (90% height): POI detail when one is selected.
- Sheet is drag-handled (rounded bar at top), swipe-to-dismiss.

### Bottom nav (persistent, 56px)

Four icons, thumb-zone: **Search** · **Tours** · **Events** · **Layers**.
Active item gets primary tint.

---

## 7. Quick Filters (action-oriented search)

Beyond plain text query, the search bar shows chip filters:

- **Near Me** (uses geolocation → radius 200m)
- **Elevator Route** (forces step-free mode when routing)
- **Open Now** (filters POIs/events by current time)
- **This Week** (filters events)
- **Accessible** (only POIs with `accessibility.wheelchairAccessible === true`)

Chips render under the search input. Tapping toggles. Active chips
accumulate (AND logic).

---

## 8. Deep Linking

Every copyable URL state:

| Intent                           | URL                                             |
| -------------------------------- | ----------------------------------------------- |
| Map default                      | `/campus/<mapId>`                               |
| Select a POI                     | `?poi=<id>`                                     |
| Select indoor POI on floor N     | `?poi=<id>&floor=N`                             |
| Wayfinding route                 | `?from=<poi>&to=<poi>&mode=walk`                |
| Accessible wayfinding            | `?from=<poi>&to=<poi>&mode=a11y`                |
| Event in a room                  | `?poi=<roomId>&floor=2&event=<eventId>`         |
| Language                         | `?lang=el` (persisted to localStorage)          |
| Tour stop                        | `?tour=<tourId>&stop=N`                         |

URLs are **the ground truth** — on load, the viewer parses them and
reconstructs the state (fly to POI, lift roof, highlight route, etc.).
Breaks cleanly if the referenced POI no longer exists (fall back to
default map).

---

## 9. Anonymous Analytics — What We Capture

Every public viewer session emits events (batched, first-party, no
third-party cookies, no personal data):

- `map.view` — on load (mapId, referrer domain, device bucket, language)
- `poi.click` (poiId)
- `poi.fly` (poiId) — distinguishes a click-through from hover
- `search.query` (text, result count, result type: poi/room/event)
- `route.request` (from, to, mode)
- `floor.switch` (buildingId, floor)
- `tour.start` / `tour.complete` (tourId)
- `share.copy` — Share URL copied from the Studio
- `language.switch` (from, to)

Aggregated nightly. Surfaces in Campus Profile → Analytics:
- Top 10 POIs viewed
- Top 10 search queries (with "0-result" ones flagged — these reveal
  missing content)
- Most-requested routes (pain points)
- Device / language split

**No visitor identity is stored.** Sessions are hashed client-side by
rotating salt; we count uniques within a day, not across time.

---

## 10. Component States Matrix

For every screen, we define four states. No feature ships without all
four designed:

| State     | Convention                                                   |
| --------- | ------------------------------------------------------------ |
| Loading   | `LoadingScreen` centered; map shows `MapLoadingFallback`.    |
| Empty     | Illustration + headline + primary CTA.                       |
| Populated | The feature working normally.                                |
| Error     | Small toast for recoverable; full-page card for fatal.       |

Specific empty states:
- **Maps list empty** → "Create your first campus map" + CTA.
- **POI list empty** → "No points of interest yet. Click 'Add POI' then
  pick a spot." (already implemented).
- **Assets empty** → "Drop files here or click to upload."
- **Analytics empty** → "No data yet. Analytics start counting once
  your map goes Live."
- **Search no results** → "No match for '<query>'. Try a building
  code, department, or room number." (logs the empty query).

---

## 11. Out of Scope for Phase 1

- 360° tour hotspot editor (hooks only, no production UI).
- Facebook Events integration.
- Full indoor CAD import.
- SSO / SAML.
- Private / gated layers.
- Localization beyond EL + EN.

---

## 12. Implementation Order (Phase 1)

Aligned with the three flagship demo moments:

1. **Campus Profile** with Overview + Settings tabs (skeleton; Assets
   and Integrations can be placeholders first) — ~1 day.
2. **Layers accordion** in Studio left panel — ~½ day.
3. **Indoor MVP**: asset upload, floor-plan georeference modal, Level
   Switcher + **Roof Lift** animation — ~3–4 days. **← pitch closer.**
4. **Wayfinding MVP** with A→B routing + accessibility toggle (blue ↔
   purple) — ~3 days.
5. **Search-to-Event** combining indoor + Google Calendar feed —
   ~2 days.
6. **Mobile pass** on public viewer (bottom sheet, FAB, right-edge
   Level Switcher pill, bottom nav) — ~2 days.
7. **Greek-language pass** + **per-org branding** — ~1 day each.

**Critical path for the ACG pitch**: 1 → 3 → 5 (the three moments).
4, 6, 7 can slip to post-pitch if we're tight on time — but the
pitch is weaker without mobile working.
