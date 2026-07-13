# @klorad/mock-inet

Mock Parsons/iNET ATMS API that mirrors the shape the Klorad Mobility
connector expects, plus a demo surface for the three PSMdt-iNET pitch
scenarios (Response-to-Incident, O&M VMS Inspection, Active Traffic
Management).

Lives inside the Klorad monorepo (`apps/mock-inet`). Deploys as its
own Vercel project — Mobility sources point their `host` at that
URL and the existing sync flow runs untouched.

## Quick start (local)

```bash
# from the repo root:
pnpm --filter @klorad/mock-inet seed   # rebuilds seed/devices.json from the CSVs
pnpm dev:mock-inet                     # http://localhost:3005
```

Auth: HTTP Basic, defaults `demo` / `demo`. Override via
`MOCK_USER` / `MOCK_PASS` env vars in Vercel (or `.env.local`).

## Deploy

Create a new Vercel project against the Klorad repo with the root
directory set to `apps/mock-inet`. Vercel picks up `vercel.json` from
the app dir automatically. Set `MOCK_USER` and `MOCK_PASS` on the
Vercel project (defaults are `demo` / `demo`).

Then in Klorad Mobility, create a new source:

- Connector: `Parsons iNET ATMS`
- Host: `https://<your-vercel-domain>`
- Username / Password: whatever you set on Vercel
- Subsystems: enable any of `cctv aid vms dms vsls radar` (the mock
  serves all six)

Run **Sync** — devices flow in.

## Endpoints

### Layer 1 — iNET drop-in

Byte-compatible with the Parsons ATMS REST. Bare JSON array on list.

- `GET /atms/{subsystem}-rest/rest/{subsystem}/` — list, cursor-paginated via `start_id`
- `GET /atms/{subsystem}-rest/rest/{subsystem}/{externalId}` — single
- `GET /atms/dms-rest/rest/dms/{externalId}/status` — DMS/VMS/VSLS status snapshot

Subsystems: `cctv aid vms dms vsls radar`.

### Layer 2 — Demo surface

- `POST/GET /api/incidents`, `GET/PATCH /api/incidents/:id`
- `POST/GET /api/worlds`, `GET /api/worlds/:id`, `GET /api/worlds/:id/devices`
- `GET /api/vds/live`
- `GET /api/stream` (SSE) — `?events=incident.status_changed,vds.tick` to filter
- `POST/GET /api/webhooks`, `DELETE /api/webhooks/:id` — HMAC-SHA256 in `X-PSMdt-Signature`
- `POST /api/demo/scenario/{incident|vms-inspection|traffic}` — scripted runs

## Scenarios

### 1. Response to Incident

```bash
curl -u demo:demo -X POST https://<mock>/api/demo/scenario/incident
```

Creates an incident anchored at a random AID camera and advances it
through `posted → acknowledged → en_route → on_scene → resolved` on a
6-second cadence. Every transition emits `incident.status_changed` on
`/api/stream` and to registered webhooks.

### 2. O&M VMS Inspection

```bash
curl -u demo:demo -X POST https://<mock>/api/demo/scenario/vms-inspection
```

Creates a world scoped to `WEST` direction + `vms` subsystem, returns
an install URL. Point the PSMdt-iNET mobile app at that URL and it
sees only the Western Ring VMS signs.

### 3. Active Traffic Management

```bash
curl -u demo:demo -X POST https://<mock>/api/demo/scenario/traffic
```

Starts a 1 Hz VDS tick loop across every radar with valid lat/lon.
Stages a 30-second slowdown on a random radar 15s in — demonstrates
how a downstream event propagates through the traffic-management
chain. Poll `/api/vds/live` or subscribe to `/api/stream` for `vds.tick`.

## Consuming the SSE stream

```js
const es = new EventSource("/api/stream?events=incident.posted,incident.status_changed", {
  withCredentials: false,
});
es.addEventListener("incident.status_changed", (e) => {
  const evt = JSON.parse(e.data);
  console.log("incident is now", evt.payload.status);
});
```

`EventSource` doesn't support custom headers, so for auth in the
browser either serve behind Vercel's password protection at the
project level, or fetch through your own backend that strips Basic.

## Registering a webhook

```bash
curl -u demo:demo -X POST https://<mock>/api/webhooks \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://your-app.example.com/hooks","events":["incident.status_changed","vds.tick"]}'
```

Response includes a one-time `secret`. Every delivery carries
`X-PSMdt-Signature: sha256=<hex>` computed over the request body.

## Regenerating the seed

Drop new CSVs in `seed/csv/`, then:

```bash
pnpm seed
```

The builder drops rows with missing/invalid lat/lon. Look at the
console output for `kept` / `dropped` counts per file.
