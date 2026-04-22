# Topos Campus — Product Spec

> **Customer-facing name:** Topos Campus (Τόπος — "place").
> **Internal / repo name:** `apps/campus` (Klorad vertical).
> **Mission:** Become the default digital-campus product for Greek
> higher education. Launch faster, update easier, and cost less than
> the US incumbents — while solving the pain points they don't
> (indoor, accessibility, Greek-native, EU data residency).

---

## 1. Vision (in one paragraph)

Greek universities currently run on PDF maps, outdated Google My Maps,
and occasional Concept3D deployments paid for by US-affiliated private
colleges. We ship a web-based, mobile-friendly, 3D campus platform
with a self-service CMS. A university signs a contract on Monday and
has a working campus map live by Friday. Every feature — POIs,
wayfinding, indoor maps, events, accessibility — is editable by a
non-technical marketing coordinator in under five minutes.

---

## 2. Who We Serve

**Primary buyers (the ones who sign the PO):**
- Private Greek colleges with international student recruitment
  (ACG, DEREE, Perrotis, Mediterranean College, IST, New York College).
  Budget, speed, English/Greek bilingual needs.
- University marketing / international-office teams at state
  universities (EKPA, AUTh, NTUA, UoP). Slower procurement but bigger
  scale once in.

**Primary users (who use it daily):**
- **Prospective students + parents** (on campus tour pages, open days).
- **Current students** (daily wayfinding, classroom lookup, events).
- **Faculty + staff** (room booking, parking, deliveries).
- **Visitors** (conferences, sports events, open days).
- **Accessibility-first users** (elevators, ramps, step-free routes).

**The person who *touches* the product in the client org:**
A marketing assistant, communications officer, or a student worker.
If they need IT to update a building name, we've lost.

---

## 3. Positioning vs. Concept3D

| Axis                       | Concept3D                    | Klorad Campus                              |
| -------------------------- | ---------------------------- | ------------------------------------------ |
| Time to launch             | 3–6 months                   | **1–4 weeks**                              |
| Custom 3D per campus       | Hand-modeled signatures      | **Procedural (Mapbox Standard v3) + optional signatures** |
| Content edits              | Support ticket, days         | **Self-service, seconds**                  |
| Price model                | Flat annual, $25–60k USD     | **Setup + ARR (€5k+€2k → €25k+custom)**    |
| Indoor / floorplan         | Weak, rarely used            | **First-class**                            |
| Accessibility layer        | Optional afterthought        | **First-class, EU-compliance ready**       |
| Language                   | English-first                | **Greek + English native**                 |
| Events integration         | Localist (US)                | **Outlook / Google / ICS / Facebook**      |
| Embed in existing site     | Yes                          | **Yes — single-line `<iframe>`**           |

**Our core wedge:** speed + self-service + indoor + accessibility +
Greek-native — as a package. Concept3D can't match all five without a
full re-platform.

---

## 4. The Product: Four Pillars

### Pillar 1 — The Map (daily utility)
A 3D, web-based interactive campus map. Mapbox Standard v3 for the
base layer (procedural 3D buildings, trees, landmarks, terrain). POIs
rendered as colored pins + labels on top. Every user click answers the
question *"where is this, and how do I get there?"*.

- **POIs by category** — building, department, library, dining,
  parking, sports, medical, admin, housing, amenity, custom.
  Color-coded pins + labels visible on the map.
- **Layer toggles** — user-side filters for POI categories +
  built-in layers (Accessibility, Parking, Safety, Services).
  Admin-side: environment layers (3D buildings, trees, labels, terrain,
  lighting preset).
- **Search** — instant results across POIs: building names,
  department names, faculty names (if wired up), room numbers.
- **Share + embed** — every map has a public URL + an `<iframe>`
  snippet. The iframe is the primary distribution channel for clients
  embedding on their existing site.
- **Category-colored pins**, each with name label, category, optional
  description, media, hours, floor, accessibility info, and a **linked
  Mapbox building** so clicking the pin highlights the actual building.

### Pillar 2 — Wayfinding (the daily killer feature)
*Prioritized over 360° tours. Current students use wayfinding weekly;
prospective students use tours once.*

- **Point A → Point B** routing along sidewalks / pedestrian paths.
  Base data from OpenStreetMap; editable overrides per campus.
- **Three modes:** Walking, Accessible (step-free), Cycling.
- **Accessible mode** avoids stairs, routes through ramps / elevators,
  and prefers well-lit paths where we have data.
- **Shareable** deep-link with `?from=<POI>&to=<POI>` so buildings can
  link directly to "how to get here."

### Pillar 3 — Indoor Maps (our differentiator)
Greek buildings have Κτίριο Γ, 2ος όροφος, πτέρυγα βορρά layouts. A
photo of the lobby sign is not good enough.

- **Floor plans per building** — georeferenced image overlays aligned
  to the 3D building footprint. (Mapbox supports image sources with
  corner coordinates — we already wire this in `mapboxSceneData.floorPlanRasters`.)
- **Floor switcher** — UI to toggle floors of a selected building.
- **Indoor POIs** — room numbers, offices, labs pinned on the floor
  plan with (x, y, floor) coordinates.
- **Indoor search** finds "Room B-207" or "Professor Papadopoulos'
  office" and flies the camera to the right floor.
- **CAD import (Phase 3)** — accept DWG/PDF floor plans from the
  facilities department and convert to web-ready overlays.

### Pillar 4 — Events + Accessibility (stickiness + EU tailwind)

**Events:**
- Feed sources: Google Calendar, Outlook/M365, ICS feeds,
  Facebook Events pages.
- Calendar sidebar: "Happening now" + "Today" + full month view.
- **Spatial pinning** — clicking an event flies to its venue; pulsing
  icons on the map show live/upcoming events.
- Events can be attached to a POI (venue) so the POI shows upcoming
  events inline.

**Accessibility:**
- First-class layer, not a checkbox. POIs carry structured
  accessibility data: wheelchair accessible, elevator available,
  tactile paving, notes.
- **Accessibility score per building**, surfaced publicly.
- **Accessible wayfinding** (see Pillar 2) — visually distinct path
  (purple) vs. standard (blue), routes via elevators not stairs.
- **Compliance export** — generate a PDF / CSV of the campus
  accessibility inventory for EU reporting.
- **Regulatory tailwind:** the European Accessibility Act (Directive
  2019/882) is binding on public sector bodies from June 2025. State
  universities have to comply; most don't have this data digitized
  today. We're the off-the-shelf answer. Sales line: "Turn compliance
  from a project into a purchase."

### (Pillar 5 — 360° tours, deferred)

Good marketing tool but expensive to produce. **We will build the CMS
hooks now** (hotspot placement, tour sequencing) but ship production
support only when a paying customer commits. Partner with local 360°
photography studios rather than producing in-house.

---

## 5. The Studio (Admin CMS)

This is already the builder we've been scaffolding in `apps/campus`.
Polish, don't rebuild. The studio is the differentiator — if the
marketing assistant can do it alone, we win.

**Current state (shipped):**
- Glass-panel left nav (logo + Campus / Environment tabs).
- Floating CAD-style scene toolbar (Select, Link-to-Building).
- Right panel action bar: Location, POI, Share, Save.
- POI placement by map click (captures lng/lat + current camera framing).
- POI edit form: name, description, category chips, position numeric,
  view (zoom/pitch/bearing) with "Capture current view," linked building.
- Map location: Saved Location card + Fly to + Set camera, Nominatim
  search to recenter.
- Environment controls: base style, 3D toggles, lighting, terrain.
- Share URL + embed snippet.
- Every pin has a visible name label on the map.

**Next up (near-term):**
- Multi-select + bulk edit POIs.
- Import POIs from CSV / KML / GeoJSON.
- Drag a pin on the map to reposition it.
- Tours: an ordered list of POI stops with narration + media; play
  mode auto-flies through the sequence.
- Floor plan upload + georeferencing UI (drag corners onto the map).
- Indoor POI placement on a selected floor plan.
- Wayfinding editor: draw sidewalks, mark stairs/ramps, tag accessibility.
- Publish vs. Draft state (currently auto-saves directly to public).
- Per-org branding: logo + primary color applied to the public viewer.
- Analytics: top-viewed POIs, top searches, share clicks, per-month.

---

## 6. Public Viewer (what visitors see)

Embedded on university sites via `<iframe>` or hosted at
`campus.klorad.com/campus/<mapId>`.

- Full-screen map with the same POI layer the admin sees.
- **Search bar** (top) — POI names, room numbers, departments.
- **Category chips** — toggle visibility of POI categories.
- **Tour filmstrip** (bottom) — horizontal scroll of published tours.
  Click a tour → auto-fly through stops with narration.
- **Events sidebar** — optional; shows upcoming events with click-to-fly.
- **Accessibility toggle** — switch wayfinding to accessible mode,
  highlight accessible routes + entrances.
- **Per-map branding** — university logo top-left; primary color from
  org settings.
- **Language switcher** — Greek / English at minimum; extensible.
- **Mobile-first** — bottom sheet instead of left drawer; tap-friendly
  controls; GPS "where am I on campus" dot.

---

## 7. Roadmap — By Customer Milestone, Not Calendar

Phases are gated on customer signal, not on time. We don't build a
feature without a paying customer asking for it.

### Phase 0 — Platform foundation (done)
- `@klorad/api` unified SDK over the scene store.
- Shared `@klorad/ui` design system (theme, sidebar, panels, inputs,
  dashboard primitives, scene toolbar).
- Mapbox engine integrated. Auth + org model. Deploy pipeline on
  Vercel.

### Phase 1 — Pitch-ready demo (1–2 weeks from today)
*Goal: close the first paid pilot (target: ACG / Deree-Pierce).*

**The three flagship demo moments** — these are what we show in the
pitch:

1. **The Level Switcher.** Zoom into any multi-storey building → a
   vertical stack of floor buttons (Γ, 1, 2, 3) appears docked to the
   right of the map. Clicking a floor dissolves to that floor's plan
   with its indoor POIs. Lands the "Greek buildings actually work
   here" moment.
2. **The Accessibility Path.** User picks A→B wayfinding. A toggle
   flips the route from **blue (standard)** to **purple (step-free)**;
   the step-free route visibly goes around stairs and through elevators.
   Lands the EAA compliance pitch.
3. **Search-to-Event.** User types `Bio 101`. Result: "Biology —
   Building Γ, 2nd floor, Room 207 · **Lecture at 10:30** (Intro to
   Molecular Biology, Prof. Papadopoulos)." Click → camera flies to
   Building Γ, switches to floor 2, pins Room 207, overlays the
   current event card. Lands the "students will actually use this
   daily" pitch.

**Phase 1 feature list (what makes the three demos work):**
- Wayfinding MVP: OSM-based A→B routing along pedestrian ways.
  Accessible mode as a toggle (avoids stairs, routes through known
  elevators/ramps).
- Indoor MVP: upload a floor plan image, georeference corners, place
  indoor POIs with (floor, x, y), floor switcher UI.
- Google Calendar event feed attached to POIs + rooms.
- Search ranks across: POIs, rooms, departments, current/upcoming
  events. Typing a room code or course code as a first-class path.
- Per-org branding on the public viewer (logo + primary color).
- Greek language pass on the public viewer (EL + EN toggle, Greek
  first).
- Studio polish (drag-to-reposition, bulk delete, undo).

### Phase 2 — First paying customer live (4 weeks from signed PO)
- Accessibility layer end-to-end (data model, editor, public toggle,
  accessible routing).
- Event feeds: Google + Outlook + ICS.
- Tour builder (no-code, ordered POI sequence with narration).
- Custom "signature" 3D buildings — paid add-on, hand-modeled for 3–5
  iconic campus structures.
- Basic analytics (POI views, top searches).

### Phase 3 — Greek market default (6 months)
- Floor plan CAD import.
- Facebook Events integration.
- Multi-campus orgs (universities with multiple sites).
- Public API for universities to push POI updates from their own CMS.
- SSO (SAML / OIDC) for admin login.
- 360° tour support — when a customer commits.

---

## 8. Design Principles

1. **Self-service or it didn't ship.** If the marketing assistant
   needs a developer, we failed.
2. **Sensible defaults.** A new map should look good and work without
   any configuration. Every setting has a sane default.
3. **Greek-native.** Bilingual UI, EUR pricing, Greek calendar, Greek
   accessibility standards, GDPR-compliant hosting in the EU.
4. **Design system everywhere.** Campus, editor, and any future
   vertical share `@klorad/ui` primitives. A new vertical is a new
   configuration, not a new theme.
5. **Mobile-first for visitors, desktop-first for admins.** Visitors
   use phones on campus tours. Admins use laptops at their desk. Don't
   compromise either.
6. **Fail quietly in the admin, loudly in the console.** A bad POI
   should still save and show. The admin should see a soft warning,
   not a red error blocking their flow.
7. **Don't build 360°, indoor CAD, or custom 3D until asked.** These
   are expensive. Say yes when a customer signs, not before.

---

## 9. Technical Foundation

- **Monorepo** — pnpm workspaces. `apps/campus`, `apps/editor`,
  `packages/*` (api, core, ui, engine-mapbox, engine-three,
  engine-cesium, prisma).
- **Next.js 15** App Router, React 19, TypeScript strict.
- **Mapbox GL JS** with Standard v3 for base maps; Threebox for
  extruded 3D overlays where needed.
- **`@klorad/api`** — vertical-agnostic SceneAPI. Campus uses
  `createSceneAPI("mapbox", "campus")` → `CampusAPI` with `poi`,
  `layers`, `setLocation`, plus the common `camera`, `tour`, `assets`,
  `environment`, `events`, `load`, `export`.
- **Prisma + Postgres** (Neon on Vercel).
- **NextAuth v5** (Google + GitHub today; SAML/OIDC for Phase 3).
- **Hosted on Vercel** per app; one Vercel project per vertical.
- **`campus.klorad.com`** — subdomain per vertical.

---

## 10. Decisions (locked in)

1. **Name.** Customer-facing: **Topos Campus** (Τόπος — "place").
   Short, professional, pronounceable in English, implies "mapping
   the place, not just buildings." Repo / internal: `apps/campus`.

2. **Pricing — Setup + ARR model.** Greek market responds well to
   visible implementation work paired with lower recurring. Tiers:

   | Tier | Setup | Recurring | Scope |
   | --- | --- | --- | --- |
   | **Starter** | €5k | €2k/yr | Standard 3D base, outdoor wayfinding, Google Calendar feed, single-language. *Acquisition tier — margin-thin, reference customers.* |
   | **Pro** | €12k | €5k/yr | + Indoor mapping for 5 buildings, Accessibility pillar end-to-end, EL+EN bilingual, custom branding. *Primary tier — where we make margin.* |
   | **Enterprise** | €25k+ | Custom | + Full campus indoor mapping, IoT / security / parking layers, multi-language, SSO, SLA, on-prem or dedicated EU region. *State universities, multi-campus orgs.* |

   Tier 1 is explicitly a loss-leader to get the first 3 names on the
   customer list. Push clients toward Tier 2 once validation is done.

3. **EU data residency — non-negotiable.** Backend and data must
   remain in EU region. Vercel Functions: `fra1` (Frankfurt). Database:
   Neon AWS `eu-central-1`. Any state university sale requires this in
   the contract. Privacy policy explicitly cites GDPR + EU hosting.
   Architecture keeps region-switching cheap so we can host in-country
   (Greece / AWS Athens when it lands) for bids that demand it.

4. **360° tours — deferred.** CMS hooks built (hotspot placement,
   tour sequencing); production support only when a paying customer
   commits. Partner with a Greek 360° photography studio rather than
   producing in-house.

5. **Event feeds — Google + ICS for MVP.** Outlook/M365 added when the
   first state university signs (they all run M365). Facebook Events
   in Phase 3.

6. **First pilot — ACG (Deree / Pierce).** Private, English-speaking
   decision-makers, international student recruitment budget, existing
   familiarity with US-style campus tech, complex multi-storey campus
   that shows off Indoor + Accessibility. Target: signed pilot in 4
   weeks from first pitch. *Ellinikon Experience Park is a tempting
   showcase but it's real estate, not higher-ed — defer to a
   post-ACG showcase vertical so it doesn't dilute positioning.*

7. **OSM contribution — yes, for outdoor base only.** We contribute
   outdoor footprints, sidewalks, and building outlines to
   OpenStreetMap; indoor floor plans and accessibility data stay
   proprietary. Narrative: *"Topos doesn't just sell software — it
   upgrades Greece's digital public infrastructure."* Useful for
   EU research grants, public-sector tenders, and goodwill with the
   open-source / civic-tech community.

---

## 11. Product Moats (why this is defensible)

- **Indoor accessibility data is our proprietary moat.** Outdoor maps
  commoditize via OSM; nobody has structured indoor accessibility data
  for Greek campuses. Once we own it for 5 universities, switching is
  hard.
- **The Studio is the lock-in.** Once a marketing team has their
  workflow in our CMS, the export to competitors is expensive (and
  their data model probably can't import it).
- **Regulatory timing.** EAA compliance deadline drives purchasing —
  the market is *buying this year*. First-mover advantage matters.
- **Greek language + Greek hosting + Greek support** beats US
  competitors even at price parity.

---

## 12. What's in this Repo Right Now

*Status as of commit 8e4ebba on `feature/platform-api-layer`:*

**Shipped (`apps/campus/`):**
- Auth (Google + GitHub OAuth, Prisma adapter).
- Maps list dashboard + create / delete flow.
- Builder with floating right panel, glass left panel, CAD scene
  toolbar.
- POI placement + edit (name, description, category, position, view,
  linked building).
- Location tab: Saved Location info + Fly to + Set camera +
  Nominatim search.
- Environment tab: base style picker, 3D toggles, lighting preset,
  terrain.
- POIs rendered on map as colored pins + name labels.
- Link-to-building tool with visual highlight on POI select.
- Public viewer (`/campus/[mapId]`) with search, tours, layers panel.
- Share URL + embed snippet.
- Deploy config for `campus.klorad.com`.

**Next on deck (Phase 1 of this spec):**
- Wayfinding MVP.
- Indoor MVP (floor plan overlay + indoor POIs).
- Per-org branding on public viewer.
- Greek-language pass.
- Studio polish (drag-to-reposition, undo, bulk operations).
