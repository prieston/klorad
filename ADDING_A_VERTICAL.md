# Adding a Klorad Vertical

How to build the next vertical (Heritage, Urban, anything else) on the platform packages Campus and Mobility already share.

> This is the "happy-path" guide. Edge cases (multi-engine renderers, BYO Anthropic key, custom RBAC) are linked to the deeper docs.

---

## 1. The platform packages you reuse

| Package | What it gives you | Touched by Heritage day-1? |
|---|---|---|
| `@klorad/prisma` | Postgres schema + client + Accelerate. Add vertical-specific models to the same schema; tenancy already lives in `Organization` + `Project` + `OrganizationMember` + `ProjectMember`. | Yes — add your relation tables |
| `@klorad/secrets` | AES-256-GCM at-rest secret helpers. Store every external-system credential as ciphertext on a row, never plaintext. | Yes — if you talk to a credentialled API |
| `@klorad/connectors` | Domain-agnostic data-source framework. `KloradConnector<TConfig, TEntity, TStatus>` + `ConnectorRegistry`. | Yes — if your vertical pulls from an external system |
| `@klorad/design-system` | Tokens, Tailwind preset, Panel/Button/Input primitives, **and** `derivePalette` + `paletteToCssVars` for white-label theming. | Yes |
| `@klorad/ui` | `OrganizationSwitcher`, `UserAccountMenu`, `ThemeModeProvider`, `AppShell`. | Yes — for dashboard chrome |
| `@klorad/storage` | DigitalOcean Spaces (S3-compatible) presigner. Per-tenant key prefixes. | Yes — for tenant logos / uploads |
| `@klorad/engine-mapbox` / `engine-cesium` / `engine-three` | Renderer-as-package. Pick by `Project.engine`. | Pick one |
| `@klorad/crawler` | Firecrawl + Claude tool-use structured extractor. Reuse if your vertical curates content from the web. | Optional |

---

## 2. Decisions you make once, up front

These mirror the Mobility plan in `MOBILITY_PLAN.md` §6.

1. **Tenant model.** Reuse `Project` (recommended). Keep config in `sceneData.<verticalKey>` — small, stable. Put data in dedicated relation tables. Credentials go to `@klorad/secrets`, never `sceneData`.
2. **URL shape.** Mirror Campus + Mobility: `<vertical>.klorad.com/<token>` for the public surface; `<vertical>.klorad.com/org/<orgId>/...` for the operator dashboard.
3. **Renderer.** Pick one of `engine-mapbox` / `engine-cesium` / `engine-three`. You can swap later without touching feature code.
4. **Adapter strategy.** If your vertical pulls live data from one source type, ship the adapter inside `@klorad/connectors/<adapter-id>`. Same pattern as `inet-atms`. Multiple source types → multiple sub-exports under the same package.

---

## 3. Scaffolding step-by-step

### 3.1 Add the Prisma models

In `packages/prisma/schema.prisma`, add your relation tables hanging off `Project`. The minimum for a sourced vertical:

```prisma
// vertical relation on Project
model Project {
  // ...existing fields...
  heritageSources   HeritageDataSource[]
  heritageItems     HeritageItem[]
}

model HeritageDataSource {
  id                    String   @id @default(cuid())
  projectId             String
  connectorId           String
  label                 String
  config                Json     @default("{}")
  credentialsEncrypted  String?  @db.Text
  enabled               Boolean  @default(true)
  lastSyncedAt          DateTime?
  lastError             String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  items   HeritageItem[]
  @@index([projectId])
}

model HeritageItem {
  id           String   @id @default(cuid())
  projectId    String
  sourceId     String
  externalId   String
  // ... domain-specific fields ...
  payload      Json     @default("{}")
  included     Boolean  @default(false)
  isPublic     Boolean  @default(false)
  needsReview  Boolean  @default(true)
  lastSeenAt   DateTime @default(now())
  project Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  source  HeritageDataSource   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  @@unique([sourceId, externalId])
  @@index([projectId, included, isPublic])
}
```

Add a migration under `packages/prisma/migrations/<timestamp>_add_heritage/`.

### 3.2 Add the connector adapter (if applicable)

If your vertical talks to an external system, write the adapter inside `@klorad/connectors`:

```ts
// packages/connectors/src/adapters/europeana/index.ts
import type { ConnectorFactory } from "../../types.js";
import { EuropeanaConfigSchema, type EuropeanaConfig } from "./types.js";
import { createEuropeanaConnector } from "./adapter.js";

export const europeanaFactory: ConnectorFactory<EuropeanaConfig, EuropeanaItem> = {
  id: "europeana",
  label: "Europeana Collections",
  authType: "api-key",
  configSchema: EuropeanaConfigSchema,
  create: createEuropeanaConnector,
};
```

Wire the sub-export in `packages/connectors/package.json` + `tsup.config.ts` next to `./inet-atms`. The `KloradConnector` contract (`configure`, `testConnection`, `listEntities`, `getEntity`, `getStatus`) is what the runner expects — fixture mode, Zod validation of external payloads, cursor pagination via `AsyncIterable`, all the same conventions as iNET.

### 3.3 Scaffold the app

Copy `apps/mobility/` to `apps/heritage/` and rename. The pieces you can leave verbatim:

- `lib/prisma.ts` — Accelerate-aware singleton.
- `lib/env.ts` — adjust the optional feature flags to what your vertical needs.
- `lib/authz.ts` — `requireProjectAccess` works across every vertical; the resolver is generic on `Project`.
- `auth.ts` + `auth.config.ts` — same User / Session tables as everyone else.
- `app/providers.tsx`, `app/layout.tsx`, `app/global.css` — chrome.
- `app/(dashboard)/layout.tsx` — auth gate.

The pieces you change:

- `package.json` `name`, `scripts.dev` port.
- `lib/connectors.ts` — register your factory:
  ```ts
  import { ConnectorRegistry } from "@klorad/connectors";
  import { europeanaFactory } from "@klorad/connectors/europeana";
  export const heritageConnectors = new ConnectorRegistry();
  heritageConnectors.register(europeanaFactory);
  ```
- `lib/<vertical>/data-source.ts` and `lib/<vertical>/sync.ts` — copy from `apps/mobility/lib/mobility/` and rename. The encrypt / decrypt / build-connector flow is unchanged; only the Prisma model names differ.
- `app/(dashboard)/org/[orgId]/projects/[projectId]/sources/` — the Sources screen template works as-is.
- `app/api/projects/[projectId]/sources/` + `app/api/sources/[sourceId]/...` — same.
- Your operator screen at `app/(dashboard)/org/[orgId]/projects/[projectId]/page.tsx` — pick the renderer that fits.
- Your public surface at `app/(public)/<token>/page.tsx` — gated by the publish-gate helper (`lib/<vertical>/publish-gate.ts`).

### 3.4 Wire the renderer

Pick the engine package and use its `Viewer` component. For Mobility we used `mapbox-gl` directly in a client component because the operator surface is a simple "markers + clicks" affair; Heritage might use `@klorad/engine-cesium` for 3D ruins, in which case import its `CesiumViewer`.

### 3.5 White-label the tenant

`@klorad/design-system/palette`:

```tsx
import { derivePalette, paletteToCssVars } from "@klorad/design-system/palette";

const palette = derivePalette(branding.primaryColor);
const themeStyle = paletteToCssVars(palette);
<div style={themeStyle}>{children}</div>
```

CSS variables (`--brand-primary`, `--brand-accent-warm`, etc.) cascade down to every component the design system ships.

---

## 4. The seven-PR sequence (template)

| PR | Subject | What it ships | Risk |
|---|---|---|---|
| 1 | `feat(prisma): <vertical> models + migration` | Schema + relation tables only | None |
| 2 | `feat(connectors): <adapter> adapter` | New `KloradConnector` sub-export. Fixture mode first. | None |
| 3 | `feat(<vertical>): apps/<vertical> scaffold` | New Next.js app — auth, prisma, theming, no features | None |
| 4 | `feat(<vertical>): data sources end-to-end` | Sources screen + Test connection + Sync runner | Low |
| 5 | `feat(<vertical>): operator console` | Map / list / drawer / curation flags | Medium |
| 6 | `feat(<vertical>): public surface (publish-gated)` | Anonymous read-only surface | Low |
| 7 | `feat(<vertical>): PWA + push (optional)` | Per-tenant manifest + web-push broadcast | Low |

Same shape as the Mobility arc in `MOBILITY_PLAN.md` — that arc is the worked example.

---

## 5. Patterns to copy

- **Re-export shims** for cross-vertical helpers (`apps/<vertical>/lib/secrets.ts` is `export * from "@klorad/secrets"` so existing import paths don't break).
- **Curation rule**: re-syncs refresh source-supplied fields (name, location, type) but **never override operator flags** (`included`, `isPublic`, `customLabel`, `customRoute`, `groupKey`). Operator decisions survive re-syncs.
- **First curation auto-clears `needsReview`** unless the operator explicitly opts back in — drops the row out of the inbox without an extra click.
- **Live data stays at the source.** Status / video / live messages are proxied through a small-TTL server cache, never persisted as source-of-truth. Time-series cache (`<Vertical>DeviceStatus`) only exists for analytics + alerts; the upstream API stays the truth.
- **Credentials are server-only.** The browser never sees plaintext; the encrypted blob travels DB ↔ runner only. Test-connection endpoints decrypt on the server, call the connector, return the result; never echo creds.
- **Adapter Zod schemas tolerate placeholder fields.** Demo deployments leave `state`, `county`, etc. empty — `.passthrough()` on the raw schema keeps those rows from blocking the renderer.
- **One Mobility-style fixture per adapter.** Lets the full vertical run before credentials arrive; flipping to live needs only valid creds, no code change.

---

## 6. What you do *not* have to build

- Auth / sessions / org / member RBAC — `requireProjectAccess` covers every vertical.
- Encryption at rest — `@klorad/secrets` is the one path.
- Dark mode + theming — `ThemeModeProvider` + design tokens.
- Org switcher / account menu — `@klorad/ui` components.
- Workspace tooling — pnpm auto-discovers packages under `packages/*`; turbo (if added) likewise picks up apps under `apps/*`.

That's the whole game. The Mobility arc is the worked example; the Campus arc is its older sibling. New verticals are configuration + a thin connector + a renderer choice on top of the same platform.
