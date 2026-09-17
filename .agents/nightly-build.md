# Agent: nightly-build

**Cadence:** nightly (~02:30 UTC, after regression 01:00). **Output:** one **draft PR** for the top
board item, **or** a question posted back on that item, **or** nothing (empty queue). **Branch:**
`agents/nightly-build-<run-id>`, never `main`.

Read `.agents/CLAUDE.md` first and honour every gate. Turn the **board queue** into code, one small
step per night, safe, reviewable, never a big bang. The Development board is the work queue;
`docs/PLAN.md` is the direction document.

## 0. The board (monday, `MONDAY_API_TOKEN`)

Development board id **`5104329450`**. Work flows through four groups:
`Ready for agent` (`group_mm78egm3`) → `In review` (`group_mm78t200`) → (`Needs decision`
`group_mm78t090`) → `Done` (`group_mm78th70`). Ids are fixed; if a group is missing, resolve by title
and **create any of `Ready for agent`, `In review`, `Needs decision` that is absent** (`Done` is
handled by board-sync). API pattern as in `.agents/CLAUDE.md`.

```bash
# list groups (→ verify ids / resolve titles)
Q='query($b:ID!){boards(ids:[$b]){groups{id title}}}'
curl -sS https://api.monday.com/v2 -H "Authorization: $MONDAY_API_TOKEN" -H 'Content-Type: application/json' -H 'API-Version: 2024-10' \
  -d "$(python3 -c 'import json,sys;print(json.dumps({"query":sys.argv[1],"variables":{"b":"5104329450"}}))' "$Q")"
# create a missing group:      mutation($b:ID!,$n:String!){create_group(board_id:$b,group_name:$n){id}}
# top item + its updates:      query($b:ID!,$g:[String!]){boards(ids:[$b]){groups(ids:$g){items_page(limit:1){items{id name updates{body} column_values(ids:["color_mm782njw","color_mm78ha8m"]){id text}}}}}}
# post an update:              mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}
# move item to a group:        mutation($i:ID!,$g:String!){move_item_to_group(item_id:$i,group_id:$g){id}}
```

## 1. Pick the item

Read the **first** item (top) of `Ready for agent`, with its **updates** and its **Vertical** column.
The item **name + its updates are the spec**, updates are the detail/acceptance notes. The Vertical
tells you which app/package the slice belongs to (`Platform` = packages, `Website` = `apps/website`).

- **Empty group → stop.** Exit cleanly: no PR, no issue, no board change.
- **Gate column says `Needs my approval`** → still build the slice, but the PR body must start with
  `NEEDS TEO APPROVAL:` and the reason; never mark it ready for review.

## 2. Slice it

Break the item into the **smallest shippable slice** that stands alone and leaves the tree green:

- **≤ 300 lines changed** total. If the smallest honest slice is bigger, slice smaller and say what's next.
- **Tests or checks included** where the repo has them (`check:units` for Heritage, audits for all).
- **No new dependency without an ADR**, needing a dep is itself a decision (§4).
- Stay inside the item, no drive-by refactors, no second slice, no touching another vertical.

Prefer the slice that unblocks the rest (a Prisma model + migration, a connector adapter in fixture
mode, a typed helper in a package) over UI. Follow `ADDING_A_VERTICAL.md` for anything vertical-shaped.

## 3. Implement + verify, and **push early**

On `agents/nightly-build-<run-id>`, implement exactly one slice. **A run must never end silently.**

- **Push early.** Create the branch and `git push` it **after the FIRST meaningful commit**, do not
  wait for the slice to be finished. Push again as you go.
- **Draft the PR as soon as `pnpm validate` is green**, even if the slice isn't polished. Then keep
  refining on the same branch.
- **Watch the turn budget.** If you've used **more than ~100 turns**, stop implementing now: commit
  whatever is green, push, open the draft PR **titled with `(partial)`** (`board: <item> (partial)`),
  say in the body what's done and what remains, post the board update, and move the item to `In review`.
- **If nothing is green** by the time you must stop: do **not** open a PR. Post an update on the item
  (Greek) saying what you tried and where it got stuck, and **leave it in `Ready for agent`** so the
  next run retries. Still never silent.

Verification, in this order, **skip work the slice doesn't need**:

- While iterating, run only the affected app/package: `pnpm --filter @klorad/<pkg> typecheck` / `lint`.
- Then one final **`pnpm validate`**, must pass.
- **`pnpm audits:light`**: must pass. **`pnpm build:packages`** if `packages/` changed.
- **Only if you changed the schema:** a migration folder + `pnpm prisma:generate` + a one-page ADR
  for structural changes. **Never migrate any database.**

If you cannot get green, do not open a non-partial PR, reduce the slice until green, ship it as
`(partial)`, or treat the blocker as a decision (§4).

## 4. Ship: one of these outcomes (exactly one per run, never none)

**A. Slice done →** open a **DRAFT PR** titled exactly `board: <item name>`. Then on the monday item:
post an **update** with the PR link + a **3-line Greek summary** (τι έφτιαξες / τι μένει / validate +
audits πράσινα), and **move the item to `In review`**.

**A-partial. Budget ran out but something is green →** same as A, but title `board: <item name> (partial)`
and say in the body + the board update what remains. Still move the item to `In review`.

**B. Ambiguous / needs a product decision →** do **NOT** guess. Post the question as an **update on the
item** (Greek, ending with a **recommended answer**, «Προτείνω: …»), **move the item to `Needs
decision`**, and stop. No PR that night. This covers: anything in PLAN.md's *Decisions open*, any
product-behaviour question the item/updates don't answer (what a screen shows, copy wording, a rule at
an edge, a threshold, anything the website claims), a needed new dependency, a schema change that
touches tenancy, or anything requiring production data/creds.

**D. Nothing green in time →** no PR; post an update on the item (Greek) with what was tried and where it
stuck, and **leave it in `Ready for agent`** for the next run.

**E. Blocked by pre-existing red gates →** if the item cannot go green for reasons that predate it
(CI already red on `main`, a typecheck error elsewhere, a missing env var), open an **issue** with the
exact failures, then still do the board step: post an update on the item (Greek) linking the issue
and saying what you did and did not ship, and **move the item to `Needs decision`**. If you shipped a
partial slice, open the draft PR as A-partial as well. An issue without a board update is a silent
run from the board's point of view (run #4 did exactly this).

**C. Empty queue →** stop, touch nothing (from §1).

There is no silent outcome: every run ends in a PR + board move (A/A-partial), a `Needs decision` note
(B or E), a `Ready for agent` note (D), or a clean empty-queue exit (C). Push the branch only once
there is a commit on it; an empty pushed branch is noise.

**Never** merge, never migrate, never publish a world, never send a push, never change prices, never
message a customer or partner. If a monday call fails (non-200 or a GraphQL `errors` field), don't
retry blindly, leave the item where it is and note the failure in the PR body (or, if no PR, open an
issue) so the work is never lost.
