# Agent: morning-digest

**Cadence:** every morning (05:41 UTC ≈ 08:41 Athens, after board-sync 04:23). **Primary output:** one
summary item posted to monday. **Secondary output:** a GitHub **issue** with the same digest (the
git-side record). **Branch:** none needed (no repo changes); if you ever change repo files, use
`agents/morning-digest-<run-id>`, never `main`.

Read `.agents/CLAUDE.md` first. Fixture mode only, no prod creds, so this is an **operational /
engineering** morning digest (gates, builds, agent activity), not a report of real tenant traffic
(that needs a prod-read path which is out of scope here, note that in the digest if relevant). The
Cowork daily brief reads this item; if it is missing, the brief has a hole in it, so **never skip**.

## Compose the digest (Greek first)

Gather, for the last 24h:

1. **Nightly regression**: **read the gate table out of the run's step summary, never the job's
   conclusion.** `.agents/nightly-regression.md` requires that run to append a table of command and
   exit code to `$GITHUB_STEP_SUMMARY`; that table is the only thing that says whether the gates
   passed. A job can conclude `success` with a gate inside it never reached, which is exactly how
   `main` stayed red for two and a half weeks without anyone noticing (#286), so a green tick here
   means four zeros in the table and nothing else.

   ```bash
   RUN_ID=$(gh run list --workflow agents.yml --json databaseId,name,conclusion,createdAt \
     --jq '[.[] | select(.name == "nightly-regression")] | first | .databaseId')
   gh run view "$RUN_ID" --job "$(gh run view "$RUN_ID" --json jobs --jq '.jobs[0].databaseId')"
   ```

   Report the table's own numbers: `✓` only when all four rows are `0`, otherwise name the failing
   gates and their exit codes. **If the table is missing entirely, that is a finding, not a pass.**
   Say so in the digest («λείπει ο πίνακας gates από το step summary») and treat the regression line
   as unknown, never as green.
2. **Nightly build**: did it open a `board:` PR, post a `Needs decision`, or find an empty queue? (Read
   the workflow run + `gh pr list --search 'board: in:title'`.)
3. **Board-sync**: items moved to Done, items promoted, any «Λείπει spec» flags (from the run log).
4. **Gate health on `main`**: is the latest `ci` run on `main` green? (`gh run list --workflow ci.yml
   --branch main --limit 1`.)
5. **Open agent output**: count of open PRs/issues from the agents (`gh pr list`, `gh issue list`,
   filter by `agents/*` branches and the `regression`, `digest`, `watch` labels).
6. **Deploys**: latest commit on `main` and its short message (`git log -1 --oneline origin/main`).

Write a tight Greek summary (2 to 6 lines) with a ✓/✗ per area. Lead with a red regression if there
is one. Keep the title short and dated, e.g. `Πρωινό digest Klorad: 2026-09-21`.

## Post ONE item to monday (board 5104329444, group group_mm78tte7)

Use the monday API with the `MONDAY_API_TOKEN` secret. Create the item, then attach the full digest as
an update on it. Set the `Source` column (`color_mm78cbz5`) to `GitHub Actions`.

```bash
# 1) create the item: its name is the dated title
ITEM_ID=$(curl -sS https://api.monday.com/v2 \
  -H "Authorization: $MONDAY_API_TOKEN" -H "Content-Type: application/json" -H "API-Version: 2024-10" \
  -d "$(python3 -c 'import json,os;print(json.dumps({"query":"mutation($b:ID!,$g:String!,$n:String!,$c:JSON!){create_item(board_id:$b,group_id:$g,item_name:$n,column_values:$c){id}}","variables":{"b":"5104329444","g":"group_mm78tte7","n":os.environ["TITLE"],"c":json.dumps({"color_mm78cbz5":{"label":"GitHub Actions"}})}}))')" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["create_item"]["id"])')

# 2) attach the full digest as an update (BODY is the multi-line Greek summary)
curl -sS https://api.monday.com/v2 \
  -H "Authorization: $MONDAY_API_TOKEN" -H "Content-Type: application/json" -H "API-Version: 2024-10" \
  -d "$(python3 -c 'import json,os;print(json.dumps({"query":"mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}","variables":{"i":os.environ["ITEM_ID"],"b":os.environ["BODY"]}}))')"
```

- Post **exactly one** item per run. If the monday call fails (non-200 or a GraphQL `errors` field), do
  **not** retry blindly, open the GitHub issue with the digest **and** the monday error, so the
  summary is never lost.
- Never put secrets, tokens, or tenant hostnames into the item or the issue.

## Also open the GitHub issue, and close yesterday's

Open an issue titled the same as the monday item, labelled `digest`, body = the same Greek summary.
This is the durable record and satisfies the workflow's "PR or issue as output" contract.

**Then close the previous day's digest issue.** One digest issue open at a time: today's. Otherwise
the issue list fills with a month of stale digests and the open-agent-output count in item 5 above
stops meaning anything.

```bash
# open the new one first, so a failure here never leaves the day with no record
NEW=$(gh issue create --title "$TITLE" --label digest --body "$BODY" | grep -oE '[0-9]+$')

# then close every older open digest issue, linking forward to the new one
gh issue list --label digest --state open --json number --jq '.[].number' \
  | grep -v "^${NEW}$" \
  | while read -r n; do
      gh issue close "$n" --comment "Κλείνει αυτόματα από το digest της επόμενης μέρας: #${NEW}"
    done
```

Order matters: create today's issue **before** closing yesterday's, so if the create fails the old
record is still standing. If a close fails, leave it open and note it in the digest; never drop the
new issue to make the cleanup work.
