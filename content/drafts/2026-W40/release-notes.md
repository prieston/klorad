# Release notes: week of 21 to 27 September 2026

No vertical-facing changes. Nothing merged this week touched Campus, Mobility, Virtual
Heritage or Urban behaviour, so there is nothing to tell an operator of those apps
they need to know about this week.

What did merge was platform correctness, CI, and process work: engineering trail,
not product news.

## Platform & SDK

- Fixed a TypeScript error (`TS2559`) in the Campus extension of `@klorad/api`, so the
  package builds clean again. (#296)
- Fixed a WebXR typecheck failure in `@klorad/engine-three`. (#301)
- Fixed the `createSceneAPI` code sample on the public platform page: it showed an
  options object, `createSceneAPI({ engine: "cesium" })`, but the real function takes
  two positional arguments, `createSceneAPI(engine, mode)`. Anyone who copied the old
  line got a scene built for an undefined engine. (#306, see the Journal entry this
  week for the corrected signature.)

## Engineering process (CI and scheduled agents)

- `pnpm check` now builds packages before it validates or audits them; on a fresh
  checkout there was no `dist/` yet, so the old order failed before it could run.
  (#302)
- The environment audit now accepts fixture mode instead of failing outside a
  production-credentialed environment. (#297, #298)
- Workspace dependency versions realigned via `syncpack` without bumping any major
  version. (#299)
- Two scheduled agents (`nightly-regression`, `nightly-build`) were changed to stop
  backgrounding long-running commands or subagents: earlier runs ended their turn
  while gates or subagents were still in flight, in a environment where nothing
  arrives after the turn ends, the run reported success having done and verified
  nothing. Both now run every gate in the foreground and wait for it to exit. (#303,
  #304)
- `morning-digest`'s turn budget raised from 30 to 60 after a run hit the cap and
  posted nothing.
- Scheduled-agent workflow output and scheduling tuned (full logs, off-peak cron
  times, explicit model pins, a step-summary table). (#300)

## Documentation

- Added `docs/ARCHITECTURE.md`: a read-only, file-and-line-referenced audit of the
  monorepo as it stands today (package map, `@klorad/core`'s real shape, each
  renderer's call chain, every `@klorad/api` export, per-app bypass counts). (#305)
- Recorded the resulting decision in `docs/PLAN.md`: fix `@klorad/core` in place,
  no rewrite; version 1 ships from the existing core. (#307)
- Narrowed the still-open decision in `docs/PLAN.md` to match: what is open is how
  much of the upcoming debt audit gets paid down before version 1 goes online, not
  whether to rewrite. (#308)

## For a human to verify before publishing

- Confirm PR numbers against the GitHub PR list; they were read from local commit
  messages and not cross-checked against GitHub itself.
- `673212dd` (morning-digest turn budget) has no PR number in the local history;
  confirm whether it merged through a PR or went directly to `main`, and correct the
  note above if so.
