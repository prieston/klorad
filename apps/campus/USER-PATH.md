# Klorad Campus — User Path Blueprint

> **Purpose.** The intended end-to-end journey for the two audiences this app
> serves — rector / org admin and student / public visitor — mapped against
> what's actually implemented today. Each step is marked:
>
> - ✅ shipped
> - ⚠️ partial (works, but missing a real piece)
> - ❌ missing (no UI / no model)
> - 🗑 orphaned (still in repo, no longer used — flagged for removal)
>
> File paths are anchors; jump to them to see the real code.
> Punch list lives at the bottom — that's where unfinished work gets queued.

---

## A. Rector journey — set up & operate a campus

### A1. Sign in

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Visit `/auth/signin`, pick Google or GitHub OAuth | ✅ | `app/auth/signin/page.tsx` |
| 2 | First sign-in lands on `/onboarding` (welcome screen w/ contact-us CTA if no org) | ✅ | `app/onboarding/page.tsx` |
| 3 | Email/password sign-in (alternative to OAuth) | ⚠️ | Auth model has `password` column but no UI; OAuth-only in practice |
| 4 | Invite by email + accept invite → land in org | ⚠️ | Invite *row* is created, but no email is sent. Rector copy-pastes the link manually. See `app/api/organizations/[orgId]/invites/route.ts:17` ("TODO: port Resend integration") |

### A2. Create an organisation

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Auto-create personal org on sign-up | ✅ | Personal orgs are tagged `isPersonal: true` |
| 2 | Create new shared org via UI | ❌ | No UI; orgs are seeded server-side or created via DB. Add an "Org → New organisation" form |
| 3 | Set org slug, name, plan | ✅ for name; ⚠️ slug | `/org/[orgId]/settings/general` lets you edit name. Slug is auto-generated; no UI to rename |
| 4 | Enable the `campus` app on the org | ❌ | Today: `organization.apps` array set in DB only. Should be a per-app toggle in org settings |

### A3. Create a campus (the `Project` row)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Open `/org/[orgId]/maps` → "New campus" | ✅ | `MapsPageClient.tsx` |
| 2 | Type a name → campus is created with empty `sceneData` | ✅ | `POST /api/maps` |
| 3 | New campus lands on its dashboard with the first-run welcome | ✅ | #193 — `WelcomeFirstRunCard` shows when fresh |
| 4 | Auto-redirect to `/onboarding` on first visit | ❌ | Decided against auto-redirect in #193; the welcome card opts in via Guided setup CTA |

### A4. First-run setup (4 things in any order)

| # | Step | Status | Where |
|---|---|---|---|
| 1 | Try with sample data (seed news/events/clubs/dining) | ✅ | `OnboardingClient` → `POST /api/maps/[mapId]/seed-sample` |
| 2 | Brand the campus (logo, name, primary colour, hero image) | ✅ | `/identity` |
| 3 | Connect MappedIn (paste venue id) | ✅ | `/map` → `IndoorMapIdCard` |
| 4 | Publish + share | ✅ | `/reach` |

### A5. Set the campus's geographic location

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Rector picks campus location (address or map pin) | ✅ | Location panel on `/identity` — Mapbox geocoder + draggable pin + click-to-set. Writes `sceneData.mapboxScene.center` |
| 2 | Location appears as a pin on the org-tier world map | ✅ | `OrgWorldMap.tsx` (org dashboard) |
| 3 | Empty state for "no location yet" with CTA to set it | ❌ | World map silently drops campuses with no location — next pass |
| 4 | Location used by the public viewer for "near me" / outdoor map default centre | ✅ | Public map reads the same `sceneData` |

### A6. Set the campus thumbnail (used by the campus list + world map tooltip)

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Rector uploads a campus thumbnail / card image | ✅ | "Card image" field on `/identity` (next to Logo + Hero). Writes `Project.thumbnail` |
| 2 | Thumbnail shown on the campus list card | ✅ | `MapsPageClient` reads it |
| 3 | Thumbnail shown on the world map pin tooltip | ❌ | Tooltip is text-only today — next pass |
| 4 | Fallback to hero image when no dedicated card image is set | ✅ | Preview in the Identity form mirrors this behaviour |

### A7. Author content — news / events / clubs / dining

| # | Step | Status | Where |
|---|---|---|---|
| 1 | News authoring (bilingual EN/EL, image, category, anchor to building/room) | ✅ | `/news` |
| 2 | Events authoring (manual entry, banner colour + icon, anchor) | ✅ | `/events` |
| 3 | Events ICS feed sync (paste a Google Calendar feed URL) | ✅ | `IcsFeedsManager` + `/api/maps/[mapId]/sync-ics` |
| 4 | Clubs authoring (initials, avatar colour, member count, meets cadence) | ✅ | `/clubs` |
| 5 | Dining authoring (hours as free text, cuisine, menu URL) | ✅ | `/dining` |
| 6 | Structured "open now" hours (parse hoursText into a weekly schema) | ❌ | Today the public page can't tell a student whether dining is open right now |
| 7 | Bulk-edit / re-order / tagging | ❌ | One-at-a-time only |
| 8 | Drafts vs. published per content item | ❌ | Everything is live the moment it's saved |

### A8. Author the campus map (POIs, buildings, accessibility)

| # | Step | Status | Where |
|---|---|---|---|
| 1 | Open the Workbench (3D outdoor + indoor scene editor) | ✅ | `/workbench` |
| 2 | Place buildings, rooms, POIs | ✅ | Workbench operations (`lib/workbench/operations/*`) |
| 3 | Reshape a room (geometry edit) | ❌ | Op `room.reshape` deferred — see `lib/workbench/operations/edit-room.tsx:124` |
| 4 | Reposition a floor-plan image | ❌ | Op `floor-plan.reposition` deferred — see `lib/workbench/operations/upload-floor-plan.tsx:57` |
| 5 | Replace floor-plan image | ❌ | Op `floor-plan.replace-image` deferred — see `lib/workbench/operations/edit-floor-plan.tsx:115` |
| 6 | Tag POIs as wheelchair-accessible | ✅ | Workbench inspector |
| 7 | Saved routes editor (predefined walking directions) | ❌ | Mentioned in the public viewer's wayfinding panel but no authoring UI |

### A9. Configure Klio (the AI assistant)

| # | Step | Status | Where |
|---|---|---|---|
| 1 | Use the platform's Anthropic key (zero config) | ✅ | Server falls back to `ANTHROPIC_API_KEY` env var |
| 2 | Bring your own key per-campus, encrypted at rest | ✅ | `/klio` → `AiKeyPanel` (AES-256-GCM via `lib/secrets.ts`) |
| 3 | Toggle individual tools (search, wayfinding, etc.) | ❌ | All tools on or none |
| 4 | Persona sliders (formal ↔ casual; verbose ↔ concise) | ❌ | Single fixed persona |
| 5 | Suggestion-chip editor (custom starter prompts on the chat screen) | ❌ | Hardcoded chips |

### A10. Publish + share

| # | Step | Status | Where |
|---|---|---|---|
| 1 | Toggle publish on/off | ✅ | `/reach` |
| 2 | Copy the public URL | ✅ | `/reach` |
| 3 | Download an SVG QR code (sized for print) | ✅ | `/reach` (#192) |
| 4 | Send a push broadcast with deep-link target | ✅ | `/reach` → `POST /api/maps/[mapId]/notify` |
| 5 | Broadcast history with delivered / opened / CTR | ❌ | Placeholder card. Needs a `Broadcast` model |

### A11. Day-to-day operations — dashboard glance

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Open `/org/[orgId]/maps/[mapId]` and see the morning glance | ✅ | `CampusProfileClient.tsx` |
| 2 | Stat: Public views (last 30 days) | ❌ | "—" placeholder; needs an analytics pipeline |
| 3 | Stat: Push subscribers | ⚠️ → ✅ | Wired in **this** PR using existing `/push-stats` |
| 4 | Stat: POIs across N buildings | ✅ | From `campus-health` |
| 5 | Stat: Accessibility % | ✅ | From `campus-health` |
| 6 | What Changed feed (audit timeline) | ❌ | Empty state; needs Activity log surfaced |
| 7 | Jump-back tiles to recent CRUD | ✅ | `JumpBackInTiles` |

### A12. Manage organisation members

| # | Step | Status | Where |
|---|---|---|---|
| 1 | List members, change role, remove | ✅ | `/org/[orgId]/settings/members` |
| 2 | Send invite email | ⚠️ | Invite row created; email never sent (see A1.4) |
| 3 | Per-campus member assignment (some campuses for some members) | ❌ | Role is org-wide today |

### A13. Organisation tier

| # | Step | Status | Where |
|---|---|---|---|
| 1 | Org overview (campuses list + world map + KPIs) | ✅ | `/org/[orgId]/dashboard` |
| 2 | Org settings — name, slug, billing plan | ⚠️ | `/org/[orgId]/settings/general` — slug edit + plan upgrade UI missing |
| 3 | Org usage — storage / bandwidth / seats vs. plan | ✅ | `/org/[orgId]/settings/usage` |
| 4 | Profile (current user) — name, email, avatar | ⚠️ | `/org/[orgId]/profile` — "Preferences" section is a placeholder |
| 5 | Enable / disable the Campus app on this org | ❌ | DB-only |

### A14. Production hardening

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Typed env + boot-blocking validation | ✅ | `lib/env.ts` (#194) |
| 2 | `/api/health` probe (DB ping + features) | ✅ | (#194) |
| 3 | Remove `SKIP_ENV_VALIDATION=1` from `vercel.json` once runtime env verified | ❌ | Health endpoint reports `envValidationSkipped: true` — flip when ready |
| 4 | Sentry server + client + edge | ❌ | Next PR |
| 5 | Uptime monitor pointed at `/api/health` | ❌ | External (Better Uptime / Pingdom) |

---

## B. Student / public visitor journey

### B1. Land on a campus

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Open `/campus/<token>` via URL or QR | ✅ | Token = `Project.id` |
| 2 | Unpublished → "Coming soon" placeholder | ✅ | `NotPublishedPlaceholder.tsx` |
| 3 | Branded hero (logo, primary colour, headline, tagline) | ✅ | Localised via `?lang=en|el` |
| 4 | News rail (DB + legacy sceneData posts) | ✅ | |
| 5 | Events rail (DB + ICS-merged) | ✅ | |
| 6 | Clubs "most active" rail | ✅ | |
| 7 | Dining "now open" rail | ⚠️ | "Open now" is a heuristic on free-text hours; structured hours not yet (A7.6) |

### B2. Install as a PWA & receive push

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Install prompt (Add to Home Screen) | ✅ | Per-tenant manifest |
| 2 | Subscribe to push from the bottom-nav prompt | ✅ | `lib/push.ts` |
| 3 | Receive broadcast → tap → deep-link to target page | ✅ | Wired in #192 |
| 4 | Offline fallback for the home shell | ✅ | Serwist SW |

### B3. Explore

| # | Step | Status | Where |
|---|---|---|---|
| 1 | News list + detail | ✅ | `/campus/<token>/news` |
| 2 | Events list + detail | ✅ | `/campus/<token>/events` |
| 3 | Clubs grid + detail | ✅ | `/campus/<token>/clubs` |
| 4 | Dining grid (no detail) | ✅ | `/campus/<token>/dining` |
| 5 | `/explore` page | 🗑 | Empty placeholder — nothing linked to it. Remove or replace with the consolidated explore from #46 |

### B4. Use the map

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Indoor 3D map (MappedIn) when venue id is set | ✅ | `/campus/<token>/map` |
| 2 | Search any room / building, animate to it | ✅ | MappedIn labels + search |
| 3 | Wayfinding (start → destination route, accessible toggle) | ✅ | |
| 4 | Virtual tour playback (story-driven sequence) | ❌ | Phase 3 of indoor immersion — authoring + playback both missing |
| 5 | Deep-link via `?space=<id>` from news/events/club anchors | ✅ | |

### B5. Ask Klio

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | Open the assistant from the bottom nav | ✅ | `/campus/<token>/klio` |
| 2 | Tool use: search news, find a room, plan a route | ✅ | Wired via `/api/assistant` |
| 3 | Source cards linking back to the answer's grounding | ✅ | |
| 4 | Custom persona / suggestion chips per campus | ❌ | (A9.4, A9.5) |

---

## C. Orphans flagged for removal (this PR)

Files imported nowhere live — left over from the pre-Phase-3 tab-based IA.

| Path | Reason |
|---|---|
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/OverviewTab.tsx` | Tab IA replaced by `CampusProfileClient` (#54) |
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/SettingsTab.tsx` | Replaced by `/identity` (#191) |
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/NewsTab.tsx` | Replaced by `/news` |
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/IntegrationsTab.tsx` | Sub-pieces folded into individual screens |
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/IndoorTab.tsx` | Replaced by `/map` |
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/MembersPanel.tsx` | Org-tier `/settings/members` covers it |
| `app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/PalettePreview.tsx` | Only used by dead `SettingsTab` |
| `app/(dashboard)/components/ComingSoonScreen.tsx` | Last user (Reach) went live in #192 |

The `lib/mappedin/` directory's `ExploreTab` / `NavigateTab` / `AssistantChat` / `SearchControls` look orphaned by simple grep, but they're transitively wired through `SidePanel` → `MappedinViewer` → the public `/map` route. Kept in place.

The two live files in `tabs/` — `HomePagePanel.tsx` and `AiKeyPanel.tsx` (plus `LangToggle.tsx` they import) — stay in place; renaming the folder is more churn than the misleading name is worth.

---

## D. Punch list — what's left, ranked

Roughly in shipping order; "S" = size (S/M/L), "U" = user impact (low/med/high).

### V1 MVP blockers
| S | U | Item | Pointer |
|---|---|---|---|
| S | High | Wire push-subscribers stat card | A11.3 — shipped |
| S | High | Add a "Card image" (campus thumbnail) field to `/identity` | A6 — shipped |
| M | High | Add a "Location" panel to `/identity` (Mapbox preview + geocoder + pin) | A5 — shipped |
| M | Med | Empty-state CTA on the org world map for campuses with no location | A5.3 |
| S | Med | World map pin tooltips that show the campus card image | A6.3 |
| S | Med | Remove `SKIP_ENV_VALIDATION=1` from `apps/campus/vercel.json` | A14.3 |
| M | Med | Sentry: server + client + edge config, DSN-gated | A14.4 |
| S | Med | Wire Resend so org invites send a real email | A1.4 / A12.2 |

### Post-MVP, useful
| S | U | Item | Pointer |
|---|---|---|---|
| S | Low | Delete `/campus/<token>/explore` page (orphan) | B3.5 |
| M | Med | Campus-tier "Members" screen (per-campus access) | A12.3 |
| M | Med | Campus-tier "Settings" screen (publish + danger zone) | A13.2 |
| M | Med | "Open now" structured hours for dining | A7.6 |
| L | Med | Audit log / What Changed feed | A11.6 |
| M | Med | Broadcast model + history with CTR on `/reach` | A10.5 |
| S | Med | Org-level "New organisation" form | A2.2 |
| S | Med | Org-level "Enable Campus app" toggle | A2.4 |
| M | Low | Klio: tool toggles, persona sliders, suggestion chip editor | A9.3–5 |
| L | Med | Virtual tour authoring + playback | B4.4 |
| M | Med | Workbench: room.reshape, floor-plan.reposition, floor-plan.replace-image | A8.3–5 |
| M | Med | Saved routes authoring UI | A8.7 |
| S | Low | Backoffice MUI retirement (still-pending Phase 6) | tech debt |
