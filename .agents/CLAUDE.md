# .agents: operating rules for the scheduled agents

Every agent under `.agents/` runs headless from `.github/workflows/agents.yml` (cron), via
`anthropics/claude-code-action`, with `CLAUDE_CODE_OAUTH_TOKEN` from repo secrets. Follow the root
`CLAUDE.md` (the Klorad rulebook) **and** the gates below. If a gate cannot be met, stop and open an
issue that says why, never silently substitute.

## The gate list

- **No production credentials of any kind** in any environment these agents can reach. No production
  `DATABASE_URL`, no tenant iNET credentials, no Mapbox/Cesium production tokens, no VAPID private keys.
  Connectors run in **fixture mode** (`apps/mock-inet` for Mobility). If a job would need a prod read,
  it does not run here; it opens an issue describing the gap.
- **Never migrate a database.** Agents never run `prisma migrate deploy`. `prisma generate` is fine.
- **Never publish a world, send a push, or message a tenant, customer or partner.**
- **Never change prices, plans, or anything on the public website that states a capability** without
  the item on the board saying so explicitly.
- **Anything you cannot do behind these gates: list it** in the PR/issue with the reason.
- **Stop and ask (open an issue, or move the board item to `Needs decision`) if a decision turns out
  to be impossible; do not silently substitute.**

## Gates every change must clear (run them yourself before you say done)

- `pnpm validate`: syncpack + typecheck + lint.
- `pnpm audits:light`: the CI-shaped audit pack.
- `pnpm build:packages`: if anything under `packages/` changed.
- `pnpm --filter @klorad/heritage check:units`: if Heritage changed.
- Conventions from the root `CLAUDE.md`: small files, no `any`, no duplicated helpers, no dead code,
  **no new dependency without an ADR**, no 3D libraries in server files, every vertical query scoped
  by `projectId`, **no new public API export without a thesis class (`docs/WORLD-MODEL.md`) or an
  ADR behind it**, World layer free of React and renderer imports.

## Output rules

- **Never commit to `main`.** Work on `agents/<job>-<run-id>` and open a PR (or an issue for
  watch/report jobs). Draft PRs for anything a human must review before it ships.
- Website copy in English; Greek-market Campus material in Greek. No em dashes or en dashes anywhere.
- Keep each run scoped to its one job. No drive-by refactors.
- Board updates are written in Greek (they are for Teo). PR titles and bodies in English.

## Board-driven build (nightly-build + board-sync)

The work queue is the **monday Development board `5104329450`**, group **`Ready for agent`**
(`docs/PLAN.md` stays the *direction* document, not the queue). `nightly-build` takes the top item,
ships **one small slice** (≤300 lines, gates green, no new dep without an ADR) as a **draft PR** titled
`board: <item name>`, then moves the item to **`In review`**. If an item needs a product decision or a
guess, it does **not** guess, it posts the question (Greek, with a recommended answer) back on the
item, moves it to **`Needs decision`**, and stops. `board-sync` moves items whose `board:` PR merged to
**`Done`** and records the merge commit. Both are gated exactly like every other agent above.

**Auto-promotion (board-sync).** After the Done step, `board-sync` keeps `Ready for agent` topped up to
**3** items: when it's short, it promotes from **`Backlog to launch`**, taking items whose **Status is
`Not started`** (never `Blocked`, never `Waiting on Teo`, those only a human promotes), **ordered by
Target ascending** (undated last). It **never promotes an item with no update (no spec)**, it posts
«Λείπει spec, δεν προωθείται» once and skips it. Promoted items get «Προωθήθηκε αυτόματα στην ουρά,
<date>». So: to feed the agents, put well-specified backlog items with a Target date and Status
`Not started`; to hold one back, set it `Blocked`/`Waiting on Teo` or leave it spec-less.

## Board and group ids (fixed; resolve titles at runtime as a fallback)

| Board | Id | Groups |
|---|---|---|
| Klorad Command | `5104329444` | Human only tasks `group_mm78ej4f`, Decisions waiting on me `topics`, Agent log `group_mm78tte7` |
| Klorad Development | `5104329450` | Ready for agent `group_mm78egm3`, In review `group_mm78t200`, Needs decision `group_mm78t090`, Done `group_mm78th70`, Backlog to launch `group_mm78da4d`, Phase 1 `topics`, Phase 2 `group_mm78egx4`, Phase 3 `group_mm78chz6` |
| Klorad Marketing & Content | `5104329453` | Content pipeline `topics`, Launch assets `group_mm78ksfy`, Competitor watch `group_mm78t8nj`, Outbound `group_mm78z32n` |
| Klorad Customers & Pipeline | `5104329457` | Reference deployments `group_mm78mdw8`, Pilot prospects `topics`, Partners `group_mm78vd1p`, Not now `group_mm7816a` |

Development board columns: Owner `color_mm78wp9p`, GitHub `text_mm78y413`, Status `color_mm783d13`,
Gate `color_mm78ha8m`, Vertical `color_mm782njw`, Target `date_mm78fek9`.

## The monday API pattern (all agents)

GraphQL over curl, headers `Authorization: $MONDAY_API_TOKEN`, `Content-Type: application/json`,
`API-Version: 2024-10`, endpoint `https://api.monday.com/v2`. Build the body with `python3 -c
'import json,sys;print(json.dumps({"query":sys.argv[1],"variables":json.loads(sys.argv[2])}))'` so
quoting never breaks. Treat a non-200 or a GraphQL `errors` field as failure: do not retry blindly,
leave the item where it is, and record the failure in the PR body or an issue so nothing is lost.
Never put a token, a credential, or a tenant hostname in an update.
