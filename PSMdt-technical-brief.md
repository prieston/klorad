# Klorad Mobility (PSMdt) — Technical Brief

_Prepared for the Parsons presentation. Covers architecture, data model, integration points (iNET connector + webhook), AI assistant, and anticipated questions._

---

## 1. What it is, in one sentence

An operator dashboard + per-tenant public PWA on top of iNET's ATMS surface: rectors/operators curate devices from an iNET source, publish branded stakeholder apps ("worlds") that push real-time alerts to visitors, all backed by web-push, a rule engine, and an on-request AI concierge (Paris).

## 2. Platform philosophy

- **One platform, many verticals.** Klorad is a monorepo hosting several products (Mobility, Campus, Virtual Heritage, Urban). They share a design-system + Prisma layer; each vertical has its own Next.js app so deploys, envs, and cadences stay independent.
- **Operator/visitor split.** Everything that matters ships in two forms: a heavy admin console (for the ATMS operator) and a light PWA (for the traveller/stakeholder). Never one interface trying to be both.
- **White-label first.** The operator picks two colours (background + primary). Every surface derives a full palette from them (`apps/mobility/lib/mobility/world-palette.ts`) via CSS custom properties. No per-tenant Tailwind theme rebuild.
- **Push, don't poll.** Real-time signal flows via webhook → HMAC-verified receiver → alert engine → web push. Polling exists only where a live read is user-triggered (e.g. Paris asking for current device status).
- **Real-time-safe defaults on serverless.** Anything shared across processes lives in Postgres. In-memory maps are ephemeral (event bus SSE, ring buffers for debug), never authoritative.

## 3. Architecture at a glance

**Monorepo** (pnpm workspaces):

```
apps/
  mobility/       Next.js 15 App Router — operator dashboard + public PWA
  mock-inet/      Fake iNET server + demo control panel
  campus/         Sibling vertical (out of scope here)
  website/        Marketing
packages/
  prisma/         Shared Postgres schema + client
  design-system/  Headless primitives + brand tokens
  connectors/     Data-source adapters (iNET + future)
  secrets/        AES-256-GCM encrypted at-rest secrets
```

**Deployment**: Vercel serverless (Node runtime). DigitalOcean managed Postgres (Frankfurt region, `fra1`), accessed via Prisma Accelerate for connection pooling. DO Spaces (S3-compatible) for user-uploaded custom icons.

**One route surface = two audiences:**
- `apps/mobility/app/(dashboard)/…` — the operator console (RBAC, session auth)
- `apps/mobility/app/(public)/w/[slug]/…` — the per-world PWA

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC) | Server components for admin data-density, streaming for the PWA |
| Language | TypeScript strict | Type-safe from Prisma model → API → UI |
| Data | Prisma 5.22 + Postgres via Accelerate | Type-safe queries; pooled at the edge |
| Auth | NextAuth (session cookies) | Operator side only; the PWA is anonymous or principal-gated |
| Map | Mapbox GL JS 3.x | Same lib operator + PWA use; clustering, custom Three.js layer for 3D devices |
| Push | Web Push (VAPID) via `web-push` | Cross-browser, no app store |
| AI | Anthropic Claude Sonnet 4.6 via `@anthropic-ai/sdk` | Tool-use for grounded answers |
| Styling | Tailwind + CSS custom properties | Palette derived per world at runtime |
| Realtime | HTTP webhooks + SSE (dev only) | Simple, HMAC-signed, retryable |

## 5. Database & data model — what we store, why

Everything below is in `packages/prisma/schema.prisma`.

### Tenancy hierarchy
- `Organization` → `Project` → `MobilityDataSource`. Every mobility row belongs to a project. Multi-tenancy isolation on every query.

### Source & catalog
- `MobilityDataSource` — one row per iNET tenant. Stores `host`, HTTP Basic creds (encrypted), `webhookSecret` (HMAC key), `pollIntervalSeconds`, `syncStatus`, `syncProgress` (per-page cursor + count).
- `MobilityDevice` — the synced device catalog. Fields: `externalDeviceId`, `subsystem` (radar/dms/vms/cctv/aid/vsls), `name`, `lat/lng`, `primaryRoad`, `crossRoad`, `direction`, `payload` (full JSON blob from iNET for later re-reads), curation flags (`included`, `customLabel`, `isPublic`, `needsReview`).
- **We don't store live device status.** Status is polled at read time via the connector. Device catalog is durable; state is ephemeral.

### Worlds (the per-tenant PWA)
- `MobilityWorld` — one row per publishable PWA. `slug`, `name`, `description`, `visibility` (`public` | `linkOnly` | `authenticated`), `theme` JSON blob (colours, logo, tagline), `isPublished`.
- `MobilityWorldDevice` — join table: which devices appear in which world.
- `MobilityWorldPrincipal` — access grants (user | team) for authenticated worlds.
- `MobilityWorldPushSubscription` — anonymous browser subscriptions (`endpoint`, `p256dh`, `auth`, `userAgent`). No PII.
- `MobilityWorldEvent` — audit stream (broadcast_sent, world_viewed, subscribe, etc.).

### Alerts
- `MobilityAlertRule` — rule definitions. `kind: threshold | event`, `config` JSON (subsystem/field/op/value for threshold; eventType for event), `targets: {worldIds[]}`.
- `MobilityAlert` — durable alert rows. `deviceId`, `kind: offline | alarmed`, `openedAt`, `closedAt`, `acknowledgedAt`.
- `Broadcast` — push history. Stores what was actually sent (title, body, deep-link path, counts). Powers both the operator's Reach tab and the visitor's Notifications feed.

### Custom styling
- `MobilityCustomIcon` — per-project uploaded icons (SVG/PNG, stored in DO Spaces).
- `MobilityDeviceStyle` — per-subsystem → icon + 3D model mapping.

### Mock persistence (for the demo)
- `MockWebhook`, `MockStatusOverride` — isolated tables in the same DB. Only the mock reads/writes them. **Not part of the domain**; kept in the shared schema because provisioning a second DB per deploy was more friction than isolation.

## 6. iNET connector — how it talks to the ATMS

Adapter: `packages/connectors/src/adapters/inet-atms/`.

**REST envelope it consumes** (the mock re-implements the same shape):
- `GET /atms/{subsystem}-rest/rest/{subsystem}/` — paginated list
- `GET /atms/{subsystem}-rest/rest/{subsystem}/{externalId}` — single device
- `GET /atms/dms-rest/rest/dms/{externalId}/status` — live status

**Auth**: HTTP Basic (username + password from source config, both encrypted at rest).

**Interface exposed to sync + Paris:**
```
listEntities(subsystem, cursor?) → { devices[], nextCursor? }
getStatus(subsystem, externalId) → status JSON
```

Six subsystems the connector knows: `cctv`, `aid`, `vms`, `dms`, `vsls`, `radar`. Each has its own status shape (radar has volume/speed/occupancy; DMS has NTCIP MULTI message + brightness; CCTV has stream URL; etc.) — the connector returns them verbatim as JSON; the operator drawer + PWA renderer know how to display each.

**To extend to another vendor**: implement a new adapter in `packages/connectors`, register it in `apps/mobility/lib/mobility/data-source.ts`'s `buildConnector()` factory. Zero mobility-side changes.

## 7. Sync engine — how data lands in the DB

`apps/mobility/lib/mobility/sync.ts`.

**Trigger**: manual button on the Sources page (`POST /api/sources/[id]/sync`) or scheduled via each source's `pollIntervalSeconds`.

**Flow per page:**
1. Read `syncProgress` (cursor + counts) from the source row
2. `connector.listEntities(subsystem, cursor)` — one API call
3. Bulk-upsert into `MobilityDevice` by `(sourceId, externalDeviceId)` unique key
4. Preserve operator overrides: `included`, `customLabel` are never overwritten
5. Write updated `syncProgress` back to the source row
6. Loop until `nextCursor` is null

**Guarantees**: idempotent (safe to re-run), resumable (progress written per page), cheap (only current-page rows touch the DB per call). A cold-started sync doesn't re-fetch what's already stored.

## 8. Webhook implementation — the mock as reference for Parsons

**The mock's implementation** (`apps/mock-inet/lib/webhooks.ts`) is what Parsons should mirror on their production iNET. It's short and idiomatic.

### Registration endpoint (`POST /api/webhooks`)

```json
Request:  { "url": "https://.../api/webhooks/inet-atms/<sourceId>",
            "events": ["device.status_changed", "incident.posted", ...],
            "secret": "<hex>" }
Response: { "id": "<uuid>", "url": ..., "secret": ..., "active": true }
```

We generate the `secret` client-side (mobility does) and pass it in; iNET can accept or reject.

### Fire path (whenever an event happens on iNET's side)

1. Look up all active webhooks whose `events` filter includes this event type
2. For each: HMAC-SHA256 the request body with the webhook's secret
3. POST to the webhook URL with headers:
   - `Content-Type: application/json`
   - `X-PSMdt-Event: device.status_changed` (or the event type)
   - `X-PSMdt-Signature: sha256=<hex>` (over the raw JSON body)
   - `X-PSMdt-Delivery: <webhook-id>` (audit trail)
4. Retry 3× with exponential backoff (1s / 5s / 30s) on network error or 5xx
5. On HTTP 410 Gone → deactivate the webhook (subscriber semantically dropped)

### Event envelope (canonical shape)

```json
{
  "type": "device.status_changed",
  "at": "2026-07-22T09:15:22.183Z",
  "payload": {
    "externalId": "E-RDR-4.01",
    "subsystem": "radar",
    "name": "...",
    "latitude": 40.68,
    "longitude": 22.93,
    "status": {
      "occupancy": 0.85,
      "speed": 18,
      "volume": 105,
      "timestamp": 1751...
    }
  }
}
```

**Critical for Parsons to know**: **the `status` field must be present on the payload**. Our threshold evaluator reads `payload.status[field]` directly; a missing/null status silently drops every threshold rule (this bit us during dev). The mock recently learned to include it; production iNET must do the same.

### Supported event types today (extend as needed)

- `device.status_changed` — any device state update
- `incident.posted` — new AID incident
- `incident.status_changed` — incident lifecycle transition
- `vds.tick` — VDS traffic sample (radars, 1 Hz)

**Cross-instance persistence**: on Vercel serverless, in-memory registries silently drop events when scenarios and registrations land on different instances. The mock persists its registry to Postgres for this reason. Real iNET running on a stateful VM doesn't have this problem, but the pattern (persistent subscriber table + HMAC) is what we recommend either way.

## 9. Alert engine — from webhook to push

`apps/mobility/app/api/webhooks/inet-atms/[sourceId]/route.ts`.

**Receive path**:
1. Look up source by `sourceId` in URL. Reject if unknown (404) or webhook not registered (400) or source disabled (200 ignored).
2. Verify HMAC signature against `source.webhookSecret` using constant-time compare (`timingSafeEqual`). Reject 401 on mismatch.
3. Parse the event JSON; validate shape.
4. Query enabled rules for the project: `WHERE projectId AND (sourceId=null OR sourceId=source.id)`. Project-wide + source-scoped rules coexist.
5. `evaluateRules(event, rules)` (`apps/mobility/lib/mobility/alert-rules.ts`) walks each rule. Threshold: numeric compare of `event.payload.status[field]` vs config value. Event: match `event.type` exactly.
6. For each match: `openAlertAndDispatch()`:
   - Insert `MobilityAlert` (durable audit row)
   - For each target world: `sendPushToWorld()` fans push out to every world subscriber
   - Create a `Broadcast` row for the visitor Notifications feed (so alert history shows up there too)
   - Record a `MobilityWorldEvent` for the operator audit stream

**Debug visibility**: every receipt (matched or not) lands in a ring buffer read by the "Recent webhook activity" panel on the Alert Rules page. Shows per-rule outcome + reason (`no match: subsystem mismatch`, `no match: field not present`, etc.). Operator diagnosis without tail-ing Vercel logs.

**Seed rules** paired with mock scenarios:
- `radar.occupancy >= 0.7` → matches radar spike
- `radar.speed <= 30` → matches traffic slowdown
- `dms.shortStatus > 0` → matches DMS fault
- `incident.posted` event rule → matches incident scenario

## 10. Push notifications — web push flow

`apps/mobility/lib/mobility/world-push.ts`.

**Setup**: three env vars — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:).

**Subscribe** (browser, on the visitor PWA):
1. Register the world's service worker with scope `/w/<slug>/`
2. Call `pushManager.subscribe({userVisibleOnly: true, applicationServerKey: <VAPID public>})`
3. POST the subscription to `/api/public/worlds/[slug]/subscribe`
4. Store as `MobilityWorldPushSubscription` (no PII, just `endpoint`/`p256dh`/`auth`/`userAgent`)

**Fire**:
1. `sendPushToWorld(worldId, {title, body, url, tag})`
2. Loads all subs for the world
3. `webpush.sendNotification` for each with the payload JSON
4. On HTTP 404/410 → prune the sub (dead endpoint)
5. On success → stamp `lastNotifiedAt` (used by operator analytics)

**Click**: SW's `notificationclick` handler opens the payload's `url`. The `url` includes `?device=<id>` on alert pushes, so the map lands on the exact pin that fired (auto fly-to + drawer open + halo visible).

## 11. Paris — how the AI works and where its data comes from

`apps/mobility/app/api/paris/route.ts` + `apps/mobility/lib/paris/tools.ts`.

**Model**: Claude Sonnet 4.6 via Anthropic SDK. Tool-use pattern, capped at 5 iterations per user turn (cost guard).

**API key resolution**: per-project encrypted key first (stored on `Project.anthropicApiKeyEncrypted` via `@klorad/secrets` AES-256-GCM), env-var fallback second. Operator can BYO key from the AI settings panel; failure to decrypt falls through to env instead of erroring.

### Four read-only tools

| Tool | Data source | Live or cached? |
|---|---|---|
| `get_open_alerts` | `prisma.mobilityAlert.findMany` | Cached (durable rows) |
| `list_devices_by_subsystem` | `prisma.mobilityDevice.findMany` | Cached (from last sync) |
| `list_alert_rules` | `prisma.mobilityAlertRule.findMany` | Cached |
| `get_device_status` | `connector.getStatus(externalId)` — hits iNET live | **Live** — no DB read |

**Answer to "how does Paris know device state"**: it does **not** poll for state on every request. It only calls iNET's `/status` endpoint when the tool `get_device_status` is invoked, which happens when the user asks about a specific device by name. Everything else (device catalog, alerts, rules) is read from Postgres.

### In-app links (how Paris turns answers into taps)

Each tool returns `{reply: <text>, actions?: [...]}`. Actions are typed structured objects — e.g. `{type: "focus_device", id: "<mobilityDeviceId>", label: "K7 Camera"}` or `{type: "open_alert", id: "<alertId>"}`. The UI (`apps/mobility/app/(public)/w/[slug]/paris/ParisPanel.tsx`) renders these below the response text as tap-cards. Tapping:

- `focus_device` → navigates to `/w/<slug>/devices?open=<id>` (opens the detail sheet with the video/message/telemetry)
- `open_alert` → routes to the operator alerts panel

Every reply is grounded — if Paris cites a device, it called `get_device_status` on it, so the value is real. It's instructed to never invent numbers.

**Privacy**: only the user query + tool schema go to Anthropic. Tool call results (device values, alert messages) go up during the tool-use loop but per-project keys mean operators can point at their own Anthropic account.

## 12. In-app deep links

Every visitor surface reads URL params on mount so any state can be shared or linked to.

| URL pattern | What it does |
|---|---|
| `/w/<slug>` | Map tab, fit-to-all |
| `/w/<slug>?device=<id>` | Map, camera flies to device, drawer opens, halo lit |
| `/w/<slug>?devices=<id1>,<id2>` | Multiple pins highlighted, fit-to-bounds |
| `/w/<slug>?lng=&lat=&z=` | Map, camera at specific position |
| `/w/<slug>/devices?open=<id>` | Devices tab with detail sheet auto-opened |
| `/w/<slug>/notifications` | Visitor Notifications feed |
| `/w/<slug>/paris` | AI assistant |

Push notifications, Paris deep-links, and inbound alert-driven URLs all use this scheme. URL updates from within the map (pan, zoom) use `history.replaceState` so we don't re-invoke the server page on every mouse move.

## 13. PWA + world model

Per-world = per-tenant, but lightweight (no separate deploy, no separate DB — same schema).

- Each world has its own service worker registration scope (`/w/<slug>/`), so installing PWA `A` doesn't affect installed PWA `B`.
- Per-world web manifest generated on demand (`/w/<slug>/manifest.webmanifest`) — includes the world's logo, primary colour, name.
- iOS home-screen icon: pulled from the world's `theme.logoUrl` via `apple-touch-icon`.
- The palette derives everything from the operator's two colour picks (`deriveWorldPaletteFromTheme`) — CSS vars cascade to every tab: map, devices, notifications, Paris, settings.

**Four tabs** in the mobile bottom-nav: Map, Devices, Paris, Alerts (Notifications).

## 14. Security

- **Auth on operator side**: NextAuth session cookies. RBAC via `requireProjectAccess(projectId, "read"|"write")` at the top of every API route.
- **PWA side**: anonymous by default. For `visibility=authenticated` worlds, we resolve a `MobilityWorldPrincipal` (user or team grant) via `loadWorldForPushViewer`.
- **Webhook receive**: HMAC-SHA256 with constant-time compare. Bad signature = 401.
- **Webhook send** (mock): same HMAC using the shared secret. Recipients verify.
- **Secrets at rest**: `@klorad/secrets` AES-256-GCM. Anthropic keys, connector credentials, webhook secrets all encrypted.
- **iNET creds on the client**: never. Only server-side reads via connector.
- **Push subscriptions**: fully anonymous. No email, no user ID, no PII. Just `endpoint` + browser-provided public keys.

## 15. Scale + reliability

- **Vercel serverless functions** with auto-scale. Cold-start latency ~200-500ms for API routes; SSR pages stream from the edge.
- **Prisma Accelerate** for connection pooling — avoids the classic serverless "too many DB connections" problem.
- **Bulk upserts** in the sync path. One SQL statement per page, not per device.
- **Idempotency**: every write path is safe to retry. Sync progress checkpoints per page. Webhook receipts are ack'd once matches are dispatched; failure in dispatch is logged, not retried (upstream retries).
- **Debug tooling built in**: activity panel on Alert Rules, ring buffer for last 50 receipts per project, per-rule preview button that runs against live data.
- **Migration hygiene**: named migrations in `packages/prisma/migrations/`, `prisma migrate deploy` on release.

## 16. Anticipated questions from the Parsons room

**Q: How do we isolate our data from other operators using Klorad?**  
A: `Organization → Project → MobilityDataSource` hierarchy. Every read/write query filters by `projectId`. Webhook secrets are per-source. Operator's Anthropic key is per-project.

**Q: What's the sync throughput?**  
A: Page size configurable per connector. Bulk-upsert one SQL statement per page. On our current mock (few hundred devices) a full sync is 2-4 seconds. Real iNET at scale would be dominated by their pagination cost.

**Q: How real-time are alerts?**  
A: End-to-end latency from iNET fire to a visitor's phone: webhook POST → HMAC verify → rule eval → alert insert → web push fan-out → subscriber's browser → OS. Typically 200-800ms in local testing; adds their push service (FCM/APNS/Mozilla) hop for production.

**Q: What if a webhook fails to deliver?**  
A: Mock retries 3× with exponential backoff (1s / 5s / 30s). Production iNET should mirror. 410 Gone → subscription is dead, deactivate. 4xx other than 410 = keep retrying. Alerts that never arrive get logged in the activity panel with the failure reason.

**Q: What does Paris actually send to Anthropic?**  
A: The user's message, prior conversation history, and the four tool schemas. Tool call results (real device values, alert titles) flow through the loop but never contain PII. Operators can bring their own API key so device data doesn't leave their Anthropic contract.

**Q: What if we want to plug in a non-iNET data source (SCATS, KITS, PTV Optima)?**  
A: Add a new adapter in `packages/connectors`, implement `listEntities` + `getStatus`, register in the connector factory. Nothing else changes — rules, alerts, PWA, Paris all work off the same abstraction.

**Q: What if the operator wants their alerts sent somewhere other than push (email, SMS, Slack)?**  
A: Fan-out is a separate step from rule matching. `openAlertAndDispatch` currently calls `sendPushToWorld`. Adding SMS/email is a new dispatcher next to it; the rule engine doesn't change.

**Q: Data residency?**  
A: DB on DigitalOcean managed Postgres in `fra1` (Frankfurt). Vercel serves globally but DB reads/writes are pooled through Accelerate. Can host DB anywhere Postgres runs — DigitalOcean, AWS RDS, on-prem — the app doesn't care.

**Q: Do you support on-prem deploy?**  
A: Yes, though we haven't productionised it. The mobility app is a single Next.js binary + Postgres. Vercel is the easiest path but not required.

**Q: What happens when iNET doesn't send a webhook status field?**  
A: Threshold rules silently no-op. We surface this in the activity panel as `no match: field "X" not a number on payload.status (status missing/null)`. The mock docs make this required; production iNET should too.

**Q: How do you handle multiple worlds for one project (e.g. one PWA for tourists, another for commuters)?**  
A: `MobilityWorld` is a first-class row. Each has its own device curation, theme, subscriber pool, alerts feed. One project → many worlds, one world → many subscribers.

**Q: Offline?**  
A: PWA installs offer basic offline shell caching via the SW. Live status naturally needs connectivity; last-known values render if the fetch fails.

**Q: What's the AI's cost model?**  
A: Per-project Anthropic key means the operator pays their own bill. If they don't set one, we fall back to a platform key with a rate limit.

---

## 17. Files worth having open during Q&A

| Topic | File |
|---|---|
| Prisma schema (all models) | `packages/prisma/schema.prisma` |
| iNET connector | `packages/connectors/src/adapters/inet-atms/` |
| Sync engine | `apps/mobility/lib/mobility/sync.ts` |
| Webhook receiver | `apps/mobility/app/api/webhooks/inet-atms/[sourceId]/route.ts` |
| Alert rule eval | `apps/mobility/lib/mobility/alert-rules.ts` |
| Alert dispatch | `apps/mobility/lib/mobility/alert-dispatch.ts` |
| Push send | `apps/mobility/lib/mobility/world-push.ts` |
| Paris tools | `apps/mobility/lib/paris/tools.ts` |
| Paris orchestration | `apps/mobility/app/api/paris/route.ts` |
| Mock webhook fan-out (reference impl) | `apps/mock-inet/lib/webhooks.ts` |
| Mock scenario runners | `apps/mock-inet/lib/scenarios.ts` |
| Public map | `apps/mobility/app/(public)/w/[slug]/WorldViewer.tsx` |
| World palette | `apps/mobility/lib/mobility/world-palette.ts` |
