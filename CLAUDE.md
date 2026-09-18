# CLAUDE.md: Klorad AI Rulebook

You are building Klorad: a platform for building digital twins. The product is the SDK (`@klorad/api`, the three renderers, the connectors, the components) and its documentation. The public API is being aligned with the system model of Teo's doctoral thesis (three layers: Access, World, Integration; four pillars: Space, Time, Physical correspondence, Interaction and actuation); `docs/WORLD-MODEL.md` maps the thesis to the code and every API decision is checked against it. The verticals (Campus, Mobility, Virtual Heritage, Urban) are demonstration apps that prove the SDK; they never bypass the public API to change world state.

Stack: pnpm workspaces, Next.js 15 App Router, TypeScript strict, Prisma + Postgres (DigitalOcean, via Accelerate), NextAuth, DO Spaces, Vercel. Renderers: `@klorad/engine-mapbox`, `@klorad/engine-cesium`, `@klorad/engine-three`. Data sources: `@klorad/connectors`. Secrets: `@klorad/secrets`.

**Read `docs/PLAN.md` first, every session.** It is the plan of record: direction, phases, what is in and out of scope, and the open decisions. Do not build anything that is not on it or that it marks deferred; if a task conflicts with it, stop and say so in the PR. Read `docs/WORLD-MODEL.md` before touching `packages/api` or `packages/core`. Read `ADDING_A_VERTICAL.md` before touching a vertical, and `MOBILITY_PLAN.md` as the worked example. Read the README of any package you touch.

## Gates (run them yourself before you say "done")

- `pnpm check` = `pnpm validate` (`syncpack:check` + `typecheck` + `lint`) + `pnpm audits:light` (the CI-shaped audit pack from `packages/dev-audits`) + `pnpm build:packages`. Must pass.
- `pnpm --filter @klorad/heritage check:units` if you touched Heritage.
- Bundle budgets (`size-limit`) apply to editor, website and admin; do not raise a budget to make a build pass.

If you did not run them, you are not done. CI runs the same set on every PR to `main`.

## Conventions (design for them; the audits catch most of them)

- **Small files, small functions.** Aim for files under 300 lines, functions under 50, components under 150. Approaching a limit means the module wants to be split.
- **No `any`, no `@ts-ignore`** without a one-line comment explaining why and an issue reference.
- **No duplicated helpers.** Search before writing: `grep -rn "functionName" packages/ apps/`. Extend, do not re-create. Cross-vertical helpers live in a package, not copied between apps (re-export shims are fine for compatibility).
- **No dead code.** `ts-prune` is in the toolchain; delete, do not comment out.
- **No new dependency without a one-page ADR** under `docs/adr/`. Prefer the platform and existing packages. `syncpack` keeps versions aligned across the workspace; do not pin a package to a different version to dodge it.
- **No 3D libraries in server files.** Client/server boundaries are enforced by the audits.

## Boundaries

- Apps depend on packages; packages never import from apps; verticals never import from each other. **Apps must not bypass the public API to manipulate world state**: scenes, objects, correspondence, actions and behaviours are read and changed only through `@klorad/api`, never through `@klorad/core` internals or an engine package directly. If the app needs a world capability the API does not expose, grow the API (with a thesis class or an ADR behind it) rather than reaching in. Application infrastructure (auth UI, persistence, Prisma, secrets, analytics, workflows) legitimately stays in the app or in server packages and is not forced into the world API. Mobility is the first app held to this rule (Phase 2); the others follow per `docs/PLAN.md`.
- **World owns meaning, engines own execution.** `@klorad/api/world` is pure TypeScript: no React, no renderer imports, no Prisma. Renderers implement it. Access and Integration may depend on World, never the reverse. The Action → Entitlement → Behaviour chain runs in that direction; Behaviours never trigger Actions.
- Public API surfaces are a compatibility promise. No new export without a thesis class or an ADR behind it; breaking changes need a deprecation note and a migration line in the docs.
- Tenancy is `Organization` → `Project` → vertical tables. Every query on vertical data is scoped by `projectId`; an unscoped query is a data-leak bug, not a style issue. Use `requireProjectAccess` (or the vertical's equivalent) on every operator route.
- Credentials are server-only and encrypted at rest through `@klorad/secrets`. The browser never sees plaintext, and no endpoint ever echoes a credential.
- External payloads are validated with Zod at the connector boundary. Never trust outside data.
- Live status stays at the source (small-TTL server cache); only catalogs and operator decisions are persisted. Re-syncs never override operator flags (`included`, `isPublic`, `customLabel`, `customRoute`, `groupKey`).
- Config lives in `Project.sceneData.<vertical>`; data lives in relation tables. Never grow `sceneData` into a god-object.

## Database changes: the strict path

1. Edit `packages/prisma/schema.prisma` (never raw SQL in app code).
2. Add a migration under `packages/prisma/migrations/<timestamp>_<name>/`.
3. Structural change (new table, changed relation)? Add a one-page ADR.
4. `pnpm prisma:generate`, then `pnpm typecheck`.
5. Never run `prisma migrate deploy` against production from a session or an agent. Production migrations run only from the Vercel build scripts.

## Product rules

- **Honesty over polish.** The website and the docs may only claim what a developer can do with the SDK today. A fixture-mode adapter is a demo, not a feature; a stub that returns null is not an API. When a claim and the code disagree, say so in the PR; never quietly soften the code or the claim.
- **The quickstart is the product.** Any change that makes the documented quickstart longer or adds a step that needs Teo is a regression, whatever else it improves.
- **Operator/visitor split.** Every surface ships as an operator console and a light public PWA. Never one interface trying to be both.
- **White-label first.** Two colours in, a full palette out (`derivePalette`). No per-tenant theme rebuilds.
- **Push, do not poll.** Real-time signal flows webhook → verified receiver → alert engine → web push.
- **Publish-gated public surfaces.** Nothing anonymous is reachable until the operator publishes it.
- Website copy is English. Campus marketing material for the Greek market is Greek. Never use em dashes or en dashes in any user-facing text.

## How to work (per session)

1. State the plan in 3 to 5 lines before editing. If a file will exceed the limits, plan the split now.
2. Small PRs: one feature or one fix. Refactors separate from features. Follow the PR template in `.github/`.
3. When you finish, update the package README if behaviour changed.
4. When you make a non-obvious choice, leave a one-line `// why:` comment, not an essay.
5. If you are unsure where something belongs, it belongs in a package until proven otherwise.

## Scheduled agents

Recurring jobs live in `.agents/` and run from `.github/workflows/agents.yml`. Their gate list is `.agents/CLAUDE.md` and it applies to interactive sessions too: open PRs, never merge to `main`; no production credentials; nothing sent to a customer or partner; no price changes; no spending.

## Known AI failure modes this file exists to prevent

Giant files. Re-implemented helpers copied between verticals. Drive-by refactors inside feature PRs. Unscoped queries. Credentials in `sceneData`. Claims on the website that the code does not back. Skipped `pnpm validate`. Answers in prose instead of code.
When in doubt: smaller file, existing package, one-page ADR, ask in the PR description.
