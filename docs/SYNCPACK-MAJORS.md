# Dependencies with two majors in use

Written 21 September 2026, alongside the syncpack alignment pass that made `pnpm syncpack:check` exit 0 for the first time (#286 point 2).

Every other mismatch in the workspace was aligned to the highest range within the major already in use. Four dependencies could not be, because two different majors are genuinely installed side by side. Aligning those is a version bump, not an alignment, and `docs/PLAN.md` calls 2026 a stabilization year, so none of them were touched.

They are excluded in `.syncpackrc.json` by the version group labelled "Two majors genuinely in use". **The exclusion is a hold, not a decision.** Take each one below, decide, then remove it from that group so syncpack enforces the outcome.

Two of the four turn out not to be real conflicts at all. They are dependencies declared by a package that never imports them, and deleting the declaration ends the split without upgrading anything.

## Summary

| Dependency | Majors | Real conflict | Cheapest resolution |
|---|---|---|---|
| `uuid` | 9 and 11 | **No** | Delete 2 unused declarations |
| `@mui/icons-material` | 5 and 6 | **No** | Delete 1 unused declaration, which also fixes an unmet peer warning |
| `zustand` | 4 and 5 | Yes | Decide whether `@klorad/core` moves to 5 |
| `zod` | 3 and 4 | Yes | Decide whether `apps/website` moves back to 3, or everything moves to 4 |

Import counts below are files that reference the package, counted with `grep -rl` over `*.ts` and `*.tsx`, excluding `node_modules`, `.next` and `dist`.

## uuid: 9 and 11, not a real conflict

| Package | Declared | Type | Files importing it |
|---|---|---|---|
| `packages/api` | `^9.0.1` | dependency | 2 |
| `packages/core` | `^9.0.1` | dependency | 2 |
| `apps/campus` | `^11.1.0` | dependency | **0** |
| `apps/editor` | `^11.1.0` | dependency | **0** |

Nothing in the workspace imports uuid 11. The only two declarations that ask for it never use it, and they are what drags syncpack's target to `^11.1.0` and puts the two packages that do use uuid permanently in mismatch.

**What resolving it requires:** delete `uuid` from `apps/campus/package.json` and `apps/editor/package.json`, then remove `uuid` from the exclusion group. Nothing upgrades, nothing is rewritten. Worth one `pnpm install` and a build of both apps to confirm neither was relying on it transitively through a bundler alias.

## @mui/icons-material: 5 and 6, not a real conflict

| Package | Declared | Type | Files importing it |
|---|---|---|---|
| `packages/config` | `^5.18.0` | dependency | **0** |
| `packages/ui` | `^6.4.2` | dependency | 26 |
| `apps/editor` | `^6.4.2` | dependency | 9 |
| `apps/admin` | `^6.4.2` | dependency | 3 |
| `apps/campus` | `^6.4.2` | dependency | 0 |
| `packages/engine-cesium` | `>=5` | peer | 0 |

Everything that actually imports icons is on 6. The single declaration holding major 5 alive is in `packages/config`, which imports nothing from it.

It is also actively broken today. `pnpm install` on this branch prints:

```
packages/config
└─┬ @mui/icons-material 5.18.0
  └── ✕ unmet peer @mui/material@^5.0.0: found 6.5.0
```

So `packages/config` pulls in an icons package built against MUI 5 while the workspace resolves MUI 6. That is pre-existing and unrelated to this PR, and it is a second reason to delete the declaration rather than keep pinning around it.

**What resolving it requires:** delete `@mui/icons-material` from `packages/config/package.json`, then remove it from the exclusion group. The peer warning goes with it.

## zustand: 4 and 5, a real conflict

| Package | Declared | Type | Files importing it | Resolved |
|---|---|---|---|---|
| `packages/core` | `^4.5.2` | dependency | 4 | 4.5.7 |
| `packages/api` | `^4.5.2` | **peer** | 0 | 4.5.7 |
| `apps/editor` | `^5.0.3` | dependency | 1 | 5.0.8 |
| `apps/campus` | `^5.0.3` | dependency | **0** | 5.0.8 |

`apps/campus` is another unused declaration and can go. What is left is real: `@klorad/core` holds the scene store on zustand 4, `apps/editor` is on zustand 5, and both are loaded in the same browser page, so two copies of zustand ship today.

The constraint that decides this is `packages/api`'s **peer** dependency on `zustand ^4.5.2`. Peer ranges are ignored by `.syncpackrc.json`, so syncpack never reports it, but it is the thing that actually pins the answer: any consumer of `@klorad/api` that installs zustand 5 is already outside the declared peer range, which is exactly what `apps/editor` does.

**What resolving it requires**, in order:

1. Delete the unused `apps/campus` declaration.
2. Decide the direction. `@klorad/core` is the scene store, `docs/PLAN.md` Phase 1 has "`@klorad/core` split: pure model out of stores and React" due 31 October, so this may want to wait for that split rather than be done twice.
3. If `core` moves to 5: read the four importing files in `packages/core/src/state`, check the store creation calls against zustand 5's API, and bump `packages/api`'s peer range in the same PR. The peer range is a published compatibility promise under `docs/WORLD-MODEL.md`, so widening or moving it needs a line in the ADR-0001 policy.
4. If `editor` moves back to 4: one file, and `apps/editor` is the app `docs/PLAN.md` says may be frozen entirely at the 15 October decision, so check that decision first.

Either way this is one PR of its own with a real test pass behind it, not part of an alignment sweep.

## zod: 3 and 4, a real conflict

| Package | Declared | Type | Files importing it |
|---|---|---|---|
| `apps/heritage` | `^3.24.2` | dependency | 26 |
| `apps/mobility` | `^3.24.2` | dependency | 25 |
| `packages/connectors` | `^3.0.0` | **peer** | 2 |
| `apps/editor` | `^3.24.2` | dependency | 2 |
| `apps/campus` | `^3.24.2` | dependency | 1 |
| `apps/mock-inet` | `^3.23.8` | dependency | 1 |
| `apps/website` | `^4.1.13` | dependency | 1 |
| `apps/admin` | `^3.24.2` | dependency | **0** |
| `packages/dev-audits` | `^3.23.8` | dependency | **0** |

Everything resolves to 3.25.76 except `apps/website`, which resolves to 4.1.13.

This is the most lopsided of the four and the easiest to get wrong. 57 of the 58 importing files are on zod 3, and 51 of those sit in `apps/heritage` and `apps/mobility`, the two verticals with the most schema code. A single file in `apps/website` is why the workspace target reads `^4.1.13`.

`packages/connectors` declares a **peer** on `zod ^3.0.0`, and `CLAUDE.md` makes connectors the place where external payloads are validated. Any move to zod 4 has to move that peer range too, and that range is part of a published package surface.

**What resolving it requires:**

- First, delete the two unused declarations (`apps/admin`, `packages/dev-audits`). That does not end the conflict, but it stops two packages carrying a dependency they do not use.
- Then decide the direction, and it is worth deciding deliberately rather than by inertia. Moving one file in `apps/website` down to zod 3 ends the split today, at the cost of that file. Moving 57 files up to zod 4 is a real migration: read every `z.*` call in `apps/heritage` and `apps/mobility` against zod 4's API (the error shape in particular, since heritage and mobility both surface validation errors to operators), plus the `packages/connectors` peer range and the connector boundary schemas behind it.
- Do not do it as a sweep. Whichever direction is chosen, it is its own board item with the verticals built and their unit checks run.

## How to close one out

1. Decide, in a board item or an ADR if it touches a published surface (the `zustand` and `zod` peer ranges do).
2. Do the work in its own PR.
3. Remove that dependency from the "Two majors genuinely in use" group in `.syncpackrc.json`.
4. `pnpm syncpack:check` must still exit 0. If it does not, the split was not actually closed.
