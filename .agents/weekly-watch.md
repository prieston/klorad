# Agent: weekly-watch

**Cadence:** weekly (Mon ~06:30 UTC). **Output:** a single **issue** (watch = observe + report, not
change). A PR only for a trivial, obviously-correct hygiene fix (a lockfile bump behind an existing
range). **Branch (if a PR is warranted):** `agents/weekly-watch-<run-id>`, never `main`.

Read `.agents/CLAUDE.md` first. Fixture mode only, no prod creds.

## Job: watch for drift between what we claim, what we ship, and what's healthy

Produce one issue, `Weekly watch: <date>`, with these sections (Greek summary line at top, English
detail below):

1. **Claims vs code.** Re-check `docs/WORLD-MODEL.md` and `docs/platform-inventory.md` (once it
   exists) against the current code, the docs site (`apps/docs`, once it exists) and the public copy in
   `apps/website`. For each thesis class (Access, World, Integration layers) and for every claim on
   the homepage and in the docs (days not months, one world model, three renderers, live data, XR,
   multi-tenant, the SDK): is it **live for a developer through `@klorad/api`**, **partial**,
   **app-only**, or **absent**? List each divergence with a file reference. Also report whether any
   vertical app imports `@klorad/core` internals or an engine package directly (grep the imports);
   that is a boundary breach. This is the honesty check, do not soften findings. Anything a developer
   cannot do today without Teo in the room counts as "not live".
2. **Gate health.** Run `pnpm validate`, `pnpm audits:light`, `pnpm build:packages`. Report anything red
   (should be caught nightly, but confirm) and anything close to a limit (files near 300 lines,
   bundles near their `size-limit` budget, `madge --circular` cycles, `ts-prune` growth).
3. **Dependencies & security.** `pnpm outdated -r` (summarise majors behind, especially `next`,
   `react`, `prisma`, `@cesium/engine`, `mapbox-gl`, `three`) and `pnpm audit --audit-level=high`. List
   advisories; do **not** auto-bump majors, flag them. A new dep needs an ADR, so this agent never
   adds one.
4. **Open agent output.** List open PRs/issues opened by the other agents (`gh pr list`, `gh issue
   list` filtered by the `agents/*` branches and labels) so nothing rots. Flag any `board:` PR older
   than 7 days without review.

Rank findings by risk. If nothing notable, still open the issue with `✓ nothing notable this week` so
the cadence is visible. Never edit product code as part of a watch beyond a trivial hygiene fix.
