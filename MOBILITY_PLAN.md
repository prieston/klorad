# Klorad Mobility — Build Plan

Step 0 deliverable per the build brief. Produced after a survey of the current monorepo; lists what gets reused as-is, what gets extracted into shared packages, what is net-new, and the proposed PR sequence. Calls out three decisions that need an answer before code starts.

> Status: PLAN ONLY. No feature code yet. Awaiting review.

---

## 1. Survey findings worth fixing into the plan up front

These changed the shape of the plan vs. the brief's assumptions. The brief should be read with these in mind.

1. **The renderer registry already exists.** `Project.engine: three | cesium | mapbox`, plus `@klorad/engine-mapbox`, `@klorad/engine-cesium`, `@klorad/engine-three` packages. So Step 1's "introduce a renderer abstraction" is *use the existing engine packages*, not invent a new interface. We will use `@klorad/engine-mapbox` directly for Mobility v1.
2. **Service worker is hand-written, not Serwist.** `apps/campus/public/sw.js` is 247 lines of bespoke push + cache logic, scoped to `/campus/[token]/`. Mobility gets its own SW (different scope), copying the same pattern. Step 8 needs a small adjustment: no Serwist.
3. **`@klorad/crawler` is in main.** Package + Prisma models (`CrawlJob`, `DiscoveredItem`) + Campus extractor profile + approval mapper + Discovered page all shipped via PR #215. The "generalise the sync inbox" extraction (§3.3) has a real concrete instance to refactor from — no blocker.
4. **`Project` is Campus-shaped.** `sceneData` JSON + `NewsPost`, `EventPost`, `Club`, `DiningLocation` relations hang off it. Mobility reuses `Project` per Decision 1, with a strict split: `sceneData.mobility` holds **light config only** (which subsystems are enabled, default map centre/zoom). Devices, sources, and status live in **dedicated relation tables** with FKs on `Project.id` — never JSON columns. Credentials live in `@klorad/secrets`. This is the same discipline Campus already follows (config in sceneData; content in relations) and is what keeps `Project` from drifting into a god-model.
5. **No `@klorad/connectors` exists.** This is net-new per the brief.

---

## 2. Reuse as-is (do not touch)

| Concern | Source | Why reusable |
|---|---|---|
| Tenancy | `Organization`, `Project`, `OrganizationMember`, `ProjectMember` in `packages/prisma/schema.prisma` | Generic; Mobility is just another `Project` under an `Organization`. |
| Auth + RBAC | `next-auth`, `apps/campus/lib/authz.ts` (`requireCampusAccess`, owner exemption, ProjectMember override) | The same resolver fits Mobility verbatim: copy to `apps/mobility/lib/authz.ts` with the same logic, swap "Campus" naming. (Or extract — see §3.) |
| Per-tenant secrets (BYOK) | `apps/campus/lib/secrets.ts` (AES-256-GCM, `SECRETS_KEY`, `${iv}.${tag}.${ciphertext}`) | Already generic. Extract into `@klorad/secrets` (§3) so both apps share. |
| Per-tenant white-label theming | `deriveCampusPalette()` + `paletteToCssVars()` + sceneData.branding.primaryColor → CSS vars | Copy the pattern; "deriveMobilityPalette" can reuse the same `derivePalette()` helper. Extract palette utility into `@klorad/design-system/palette` (§3). |
| PWA shell pattern | `apps/campus/public/sw.js` + per-tenant `manifest.webmanifest` route | Copy + scope to `/mobility/[token]/`. Not a package extraction — the file is small, scoped, and clearer copied than abstracted. |
| Push pipeline | `apps/campus/lib/push.ts` + `PushSubscription` + `Broadcast` Prisma models + `/api/broadcasts` + click-token + `sw.js push event` | Models are projectId-scoped, so Mobility can reuse rows. The send loop is generic. Copy and configure. (Extraction is possible but premature.) |
| Storage | `@klorad/storage` (S3-compatible DO Spaces) | Already a package, already per-tenant. |
| Design system | `@klorad/design-system` (Panel, Button, Input, Select, etc.) | Already a package. Use as-is. |
| UI shell | `@klorad/ui` (OrganizationSwitcher, UserAccountMenu, AppShell) | Already a package. Mobility's dashboard reuses. |
| Map renderers | `@klorad/engine-mapbox`, `@klorad/engine-cesium`, `@klorad/engine-three` | The engine abstraction already exists per `Project.engine`. Use `@klorad/engine-mapbox` for Mobility v1. |
| Prisma client | `@klorad/prisma` | Use as-is; add new models in the same schema. |

---

## 3. Extract into shared packages (additive, no Campus risk)

Each one of these is a *new* package or new export. None require rewriting Campus surface code; they get pulled into Campus afterwards as a small follow-up.

### 3.1 `@klorad/secrets` — extract from `apps/campus/lib/secrets.ts`
Pure utility, AES-256-GCM, no Campus references. Move file to `packages/secrets/src/index.ts`. Replace `apps/campus/lib/secrets.ts` with a one-line re-export to avoid touching imports. Mobility imports directly.
**Risk**: zero. **PR**: small.

### 3.2 `@klorad/connectors` — new
The platform-side data-source framework the brief asks for. Per the brief:
```ts
interface KloradConnector<TConfig, TEntity> {
  configure(authConfig: TConfig): Promise<void>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
  listEntities(params: ListParams): AsyncIterable<TEntity>;
  getEntity(id: string): Promise<TEntity | null>;
  getStatus(ids: string[]): Promise<Record<string, EntityStatus>>;
  normalize(external: unknown): SceneObject; // → @klorad/core
}
```
- Cursor-paginated `listEntities` (yields pages, not arrays).
- Per-connector Zod schema for `authConfig` + per-entity-type Zod schemas for the external shape (never trust outside data).
- A `ConnectorRegistry` so apps register their adapters by id.
- No Prisma dep; persistence is the caller's concern.
- iNET ATMS adapter is the first implementation, lives in `@klorad/connectors/inet-atms` (sub-export). Framework itself stays ATMS-agnostic.

**Risk**: zero. **PR**: medium.

### 3.3 `@klorad/sync` — new (generalize the crawler inbox pattern)
The brief asks for the Campus "Discovered" curation flow generalized: discover → inbox → approve → publish. After studying `@klorad/crawler`, the clean split is:
- `@klorad/crawler` — *content extraction* domain (Firecrawl + Claude tool-use), kept as-is, no rename.
- `@klorad/sync` — *sync inbox* domain. Provides the Prisma-agnostic types + helpers for: a discovered-items table abstraction, status enum (`pending|approved|rejected`), a generic approval mapper signature, demo-limit constants, and a publish-gate helper (§3.5).
- The Campus crawler adopts `@klorad/sync` (its DiscoveredItem becomes one instance; existing Prisma model + API stays the same; only types are re-exported).
- The Mobility device-sync inbox uses `@klorad/sync` for the same shape: discovered devices land as `pending`, the operator clicks include/public, rows become live in the operator console + traveller map.

**Design rule** — `@klorad/sync` must be co-designed against **both** consumers before any extraction commit:
- Campus Discovered (`DiscoveredItem` content rows from a web crawl)
- Mobility device-sync (`Device` rows from an ATMS GET-all)

If a type or helper only makes sense for the crawler (e.g. `markdown`, `htmlSnippet`), it doesn't belong in `@klorad/sync` — it belongs back in `@klorad/crawler`. The `@klorad/sync` surface stays the intersection: the discovered-row lifecycle (`pending|approved|rejected`), the bulk-approval helpers, the publish-gate util, and the demo-limit constants pattern. ATMS-specific shapes stay in `@klorad/connectors/inet-atms`; crawler-specific shapes stay in `@klorad/crawler`.

**Risk**: low — refactor inside `@klorad/crawler` to delegate to `@klorad/sync`, but its public API stays identical. **PR**: medium.

### 3.4 `@klorad/design-system/palette` — extract from `apps/campus/lib/palette.ts`
Tiny extraction: `derivePalette(hex)` + `paletteToCssVars()` are generic; only `--brand-*` variable names differ per app. Move to `@klorad/design-system`, parameterise the prefix.
**Risk**: zero. **PR**: small.

### 3.5 `@klorad/sync/publish-gate` — new (lives inside `@klorad/sync`)
Per the brief: `isPublished/isPublic` at app level, plus a per-entity public flag (Mobility device-level), reused by both verticals. One utility:
```ts
isPubliclyVisible(project: { isPublished; isPublic }, entity?: { public })
```
Campus today only uses project-level. Mobility needs both: a device is shown publicly only when (a) the project is published, (b) the project is public, and (c) the device's per-row `public` flag is true. Same util fits both.
**Risk**: zero. **PR**: small.

### 3.6 `apps/mobility` — new Next.js app
Mirrors `apps/campus/` structure. Same `(public)` + `(dashboard)` route groups. Reuses everything in the list above.
**Risk**: zero. **PR**: every Mobility feature lands here.

---

## 4. Net-new (only in `apps/mobility` and `@klorad/connectors/inet-atms`)

The brief's Steps 2-8 are all net-new and self-contained:

- **Data Source settings UI** (Step 2): an admin page in the Mobility back office to declare ATMS host/auth/subsystems/poll-interval. Persists via `@klorad/secrets`; server-side test-connection.
- **iNET ATMS adapter** (Step 3): the first `@klorad/connectors` adapter. Endpoint shapes per the brief. NTCIP 1203 MULTI parser. HLS/MP4 media proxy.
- **Fixture mode** (Step 4): a `KLORAD_MOBILITY_DATA_SOURCE_MODE=fixture|live` switch the connector reads. Fixture serves the two seeded Thessaloniki devices + a handful of synthetic neighbours.
- **Discovered devices inbox** (Step 5): same UX shape as Campus Discovered — table + map preview + bulk include/public toggles + needs-review on re-sync. Built on `@klorad/sync`.
- **Two surfaces** (Step 6): operator console (auth) + traveller map (public). Per-device public flag (§3.5).
- **Map + drawer + alert feed** (Step 7): Mapbox via `@klorad/engine-mapbox`. Cluster + colour-by-health + heat-layer toggle slot. Device drawer with HLS video player (hls.js) + DMS face rendered from NTCIP. Health/alert feed surfacing offline + alarmed devices.
- **PWA + push** (Step 8): mobility-scoped `/public/sw.js` + per-tenant `manifest.webmanifest`. Reuse push pipeline keyed by `projectId`. Optional NOC kiosk mode (no chrome, large targets) by config flag.

---

## 5. Proposed PR sequence

Each PR is small enough to review in one sitting; nothing is staged on top of unreviewed work; Campus is green after each one.

| PR | Title | Scope | Risk |
|---|---|---|---|
| 1 | `feat(secrets): extract @klorad/secrets from apps/campus` | New package + one-line re-export shim in campus | None |
| 2 | `feat(design-system): extract palette utility` | New export, no behavioural change | None |
| 3 | `feat(connectors): @klorad/connectors framework` | New package, framework only, no adapter yet | None |
| 4 | `feat(connectors): iNET ATMS adapter + Zod schemas + NTCIP MULTI parser` | New sub-export, fixture-mode compatible | None |
| 5 | `feat(sync): generalise @klorad/crawler discovery pattern into @klorad/sync` | Refactor inside `@klorad/crawler`, public API unchanged | Low |
| 6 | `feat(prisma): Mobility models — MobilityDataSource, MobilityDevice, MobilityDeviceStatus, MobilityAlert` | Schema + migration; no UI | None |
| 7 | `feat(mobility): apps/mobility scaffold + dashboard shell + auth + theming` | New Next.js app, no features yet, AppShell reused | None |
| 8 | `feat(mobility): Data Source settings + test-connection + fixture mode` | First end-to-end slice; only the settings screen + a "Run sync" button | Low |
| 9 | `feat(mobility): Discovered devices inbox + bulk curate (include + public)` | The inbox UX, built on @klorad/sync | Low |
| 10 | `feat(mobility): operator console — map, clusters, drawer, HLS + DMS face` | The map-first dashboard | Medium (most code) |
| 11 | `feat(mobility): public traveller map (publish-gate enforced)` | Anonymous read-only view | Low |
| 12 | `feat(mobility): health/alert feed + push broadcast for offline + alarm thresholds` | Alerts surface + push hookup | Low |
| 13 | `feat(mobility): PWA shell + per-tenant manifest + optional NOC kiosk mode` | Service worker + manifest route | Low |
| 14 | `feat(mobility): Klio-style assistant stub over device tools (feature-flagged)` | Optional; reuse Campus assistant runtime | Low |
| 15 | `docs: ADDING_A_VERTICAL.md` | The how-to-add-a-vertical guide | None |

Estimated 4-6 weeks of focused work end-to-end. PRs 1-7 can land in week 1.

---

## 6. Decisions — resolved

### Decision 1 — Mobility tenant model: **reuse `Project` with a strict split**

- **`sceneData.mobility`** holds light, stable **config only**: enabled subsystems, default map centre/zoom, render engine choice. Small, low-churn.
- **Relation tables** (FK on `Project.id`) hold the heavy / queryable / mutable data: `MobilityDataSource`, `MobilityDevice`, `MobilityDeviceStatus`, `MobilityAlert`. Per-device flags (`included`, `public`, `label`, `group`) live on the `MobilityDevice` row.
- **Credentials** live in `@klorad/secrets` (AES-256-GCM at rest). **Never** in `sceneData`. The `MobilityDataSource` row stores ciphertext, not plaintext.

This mirrors how Campus already works (config in sceneData, content in relations) and keeps `Project` from drifting into a god-model.

**Why tables and not pure API pass-through:** the live status/video stream stays on the ATMS as source of truth (proxied through a small-TTL server cache). The tables hold what the ATMS does *not*: per-tenant curation flags, the discovered/needs-review inbox, time-series history for "offline N minutes" / heatmaps / trends, alert acknowledgements, and a cached catalog so the public traveller map serves anonymous visitors without burning ATMS rate limits.

### Decision 2 — URL shape: **`mobility.klorad.com/<token>`** (mirror Campus)

- `mobility.klorad.com/<token>` for the public traveller surface.
- `mobility.klorad.com/org/<orgId>/...` for the operator dashboard.
- Per-tenant subdomains and custom domains are an enterprise feature for later, not v1.

---

## 7. Out of scope for v1

Flagged so they don't creep in:

- **Control plane** (PTZ, post-DMS-message). `controlType: "status and command"` exists on the API but write paths are deferred. Read-only v1.
- **MapLibre / Cesium swap**. v1 ships on Mapbox. The renderer is already pluggable via `@klorad/engine-*` packages, so this is just choosing not to ship a second engine package for Mobility.
- **deck.gl heat layer**. The drawer interface includes a heat slot but the implementation is a follow-up.
- **MUI removal in `@klorad/ui`**. Pre-existing platform concern; Mobility avoids touching it by using `@klorad/design-system` primitives (already MUI-free).
- **Real-time WebSocket pushes from ATMS**. Polling is enough for v1; WebSocket subscriptions are a Phase 2 ATMS adapter concern.

---

## 8. Working agreement

- **Branch:** `feature/mobility-vertical` (single arc branch per memory `pr-workflow-one-branch`). All PRs in §5 land as progressive commits on this branch; we open scoped sub-PRs only if you explicitly ask for early review of a phase. Default is one PR at the end.
- **Decisions in §6 are resolved.** Proceeding to PR 1 (`@klorad/secrets` extraction) now.

PR 1 is ~30 minutes, zero behavioural change for Campus (re-export shim keeps existing imports working).
PR 2-3 follow same day.
PR 4 (iNET adapter) is the first substantive piece; ~1 day.
A running fixture-mode dashboard (PRs 1-8) ships in week 1.
The full set (1-15) is 4-6 weeks of focused work.
