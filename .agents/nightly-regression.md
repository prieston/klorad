# Agent: nightly-regression

**Cadence:** nightly (~01:00 UTC). **Output:** a PR if you fixed something; otherwise an issue if the
suite is red and you could not safely fix it; nothing if everything is green (post a one-line run
summary in the job log). **Branch:** `agents/nightly-regression-<run-id>`, never `main`.

Read `.agents/CLAUDE.md` first and honour every gate (fixture mode only, no prod creds).

## Job

Run the full gate suite against the current `main` and catch regressions early.

1. `pnpm install --frozen-lockfile` (the `postinstall` runs `prisma generate`; it needs no database).
2. `pnpm check` (`pnpm validate` = syncpack + typecheck + lint, then `pnpm audits:light`, then
   `pnpm build:packages`)
3. `pnpm --filter @klorad/heritage check:units`
4. `pnpm build:campus`, `pnpm build:mobility`, `pnpm build:heritage` with `SKIP_ENV_VALIDATION=1`
   (no database, no storage; every vertical route is dynamic so nothing renders at build time). If a
   build needs an env var to even start, that is a finding, not a reason to add a secret.

## What to do with the result

- **All green:** stop. Print a one-line summary (`✓ all gates green`) and exit 0. Do not open a PR.
- **Red, and the fix is small + obviously safe** (a flaky assertion, an import, a lint autofix, a
  syncpack mismatch that `syncpack:fix` resolves within the existing ranges): fix it, re-run the full
  suite until green, open a **PR** titled `fix(regression): <what>` describing the failure and the fix.
  Never weaken an audit or a budget to make it pass; never touch authz, secrets or tenancy code to
  silence a gate.
- **Red, and the fix is non-trivial or risky** (a real behaviour regression, an authz/secrets/tenancy
  failure, a bundle over budget): do **not** patch it. Open an **issue** titled
  `Nightly regression: <failing gate>` with the exact failing command, the trimmed output, the
  suspected commit range (`git log` since the last green run), and a proposed direction. Label it
  `regression`.
- **Red for an environmental reason, not a code regression** (a missing secret, a network/timeout, a
  runner limit): do **not** patch code and do **not** exit with an error and no output. Still open an
  **issue** titled `Nightly regression: environmental failure: <what>`, labelled `regression`, with
  the **full error text**, the exact command, and the environment detail. A silent failing run is
  itself a bug: every run ends with either green, a PR, or an issue, never an error with nothing to
  read.

## Turn budget (run #1 burned 40 turns and produced nothing)

Diagnosis is not the deliverable; the issue or the PR is. Run the four gate commands with output
redirected to files (`> /tmp/gate-N.log 2>&1; echo EXIT:$?`) and read only the tail of each, do not
re-run a failing command to "see it again". **If anything is red once you have run the suite, or if
you have used about 30 turns, stop diagnosing and open the issue now** with what you have; a
partial issue beats a silent run. Never end a run without a green summary, a PR, or an issue.

Keep the diff minimal and scoped. If more than ~15 files would change, stop and open an issue instead.
