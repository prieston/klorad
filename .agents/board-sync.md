# Agent: board-sync

**Cadence:** daily (~04:30 UTC, after nightly-build 02:30 and before morning-digest 05:15). **Output:**
moves merged board items to `Done`, then tops up the `Ready for agent` queue from the backlog, all on
monday, no repo changes, no PR. **Branch:** none.

Read `.agents/CLAUDE.md` first. This job only reads git/GitHub and writes to the monday board
(`MONDAY_API_TOKEN`). Never touches production, never merges, never changes code.

## Job: reflect merged work back onto the board

When a PR titled `board: <item name>` (the ones nightly-build opens) gets **merged**, the matching
monday item should move to **`Done`** with the merge commit recorded on it.

1. **Find merged board PRs** from the last ~24h:
   `gh pr list --state merged --search 'board: in:title' --json number,title,mergeCommit,mergedAt,url`
   Keep those merged since the last run (roughly the last day). For each, the item name is the title
   with the `board: ` prefix stripped (and a trailing ` (partial)` stripped too, a partial merge does
   **not** move the item to Done; it only gets the merge update and stays in `In review`).

2. **Board (id `5104329450`)**: API pattern from `.agents/CLAUDE.md`. `Done` is **`group_mm78th70`**;
   resolve by title and create it if it is ever missing.

3. For each merged item, **find the monday item by exact name** (scan the board's items and match
   `name`), then:
   - **move it to `Done`** (non-partial only):
     `mutation($i:ID!,$g:String!){move_item_to_group(item_id:$i,group_id:$g){id}}`
   - **post the merge commit as an update** (Greek, one/two lines): the short SHA + PR link + merge
     date, e.g. `✓ Merged: <sha> (PR #<n>), <date>`.
     `mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}`

## Then: keep the queue filled (auto-promote)

**After** the Done step, top up the `Ready for agent` queue so nightly-build always has work. Group
ids are fixed: `Ready for agent` = **`group_mm78egm3`**, `Backlog to launch (…)` = **`group_mm78da4d`**.

1. **Count** items currently in `Ready for agent`. If it already has **≥ 3**, stop: nothing to promote.

2. Otherwise **promote from the backlog** until `Ready for agent` has **3**. Read the backlog items
   with their **Status** (`color_mm783d13`) and **Target** (`date_mm78fek9`) columns and their **updates**:
   - **Eligible = Status is exactly `Not started`.** Never `Blocked`, never `Waiting on Teo` (those never
     auto-promote, a human moves them).
   - **Order eligible ascending by Target**; items with no date go last.

   ```graphql
   query($b:ID!){ boards(ids:[$b]){ groups(ids:["group_mm78da4d"]){ items_page(limit:200){
     items{ id name updates{ id }
       st: column_values(ids:["color_mm783d13"]){ text }
       dt: column_values(ids:["date_mm78fek9"]){ text } } } } } }
   ```

3. Walk the ordered eligible list and, for each, until `Ready for agent` reaches 3:
   - **No update (no spec) → do NOT promote.** Post **once** (only if not already posted)
     `Λείπει spec, δεν προωθείται` on the item and **skip** it.
   - Otherwise `move_item_to_group($id, "group_mm78egm3")` and post
     `Προωθήθηκε αυτόματα στην ουρά, <YYYY-MM-DD>` on it. That item now counts toward the 3.

   If the backlog runs out of eligible spec'd items before reaching 3, stop, a partly-filled queue is
   fine.

## Rules

- **Idempotent:** if an item is already in `Done` (or already has a "Merged: <sha>" update for this PR),
  skip it, don't post a duplicate. Likewise never re-post `Προωθήθηκε…` / `Λείπει spec…` on an item
  that already carries it.
- **No match on the board?** Don't create a new item; note it in the run log (the item may have been
  renamed or the PR title edited), a human reconciles.
- If a monday call fails (non-200 or GraphQL `errors`), stop for that item and leave it where it is;
  the next run retries. Never put a token or a tenant hostname in an update.
- Read-only on the repo, this agent makes no branch, no PR, no commit.
