# Klorad: Plan of record

Written 16 September 2026, rewritten 17 September 2026 after the direction changed from "four vertical products" to "one SDK, four demonstration apps". This file is the single source of truth for what we are building and in what order. Every Claude Code session reads it before its first edit (root `CLAUDE.md` says so). The monday Development board (5104329450) mirrors this file; when the two disagree, this file wins and the board gets corrected. Change the plan here first. The longer narrative is the Klorad Launch Plan and Execution Runbook (v2, 17 Sep) in the 03 Prieston Technologies > Klorad Drive folder.

## Direction (17 September 2026)

Klorad is a platform for building digital twins. The product is the SDK and its documentation: `@klorad/api` with the three renderers, the connectors, the components, and a docs site that lets a developer go from an empty project to a rendered, data-fed twin in an afternoon. The promise on the website, "Build Enterprise Digital Twins in Days, Not Months", is a promise about the SDK, and it is tested every time a stranger opens the quickstart.

The public API is being aligned with the system model of Teo's doctoral thesis: three layers (Access, World, Integration) and four pillars read from the thesis text, Space (Earth-anchored coordinate system as structure), Time (the Time Spectrum governing observation order), Physical correspondence (Digital Object, Shadow, Twin as a Scene Object classification with real synchronisation behind it) and Interaction and actuation (Action → Entitlement → Behaviour → state change or Animation). `docs/WORLD-MODEL.md` is the map between the thesis and the code and every API decision is checked against it. Klorad implements the thesis World layer as an engine-independent semantic model; renderers execute it; apps never bypass the public API to manipulate world state.

The verticals (Campus, Mobility, Heritage, Urban) are demonstration apps. They exist to prove the SDK, to give developers something to copy, and to be shown in meetings. They are not products with pilots and reference customers in this plan. A vertical that bypasses the public API to change world state is not a demonstration of it, so each vertical is rewritten to that rule, Mobility first as the Mapbox renderer-independence proof in Phase 2. The Phase 1 proof of the SDK is smaller and stricter: the v0.1 kernel end to end on three.js with a mock IoT connector, and that proof is the quickstart. Urban has no app and none is built until the SDK is public.

Longer term, agents will build twin apps on the SDK the way Lovable builds web apps. That is not on the website until it exists. The cheap existence proof is an MCP server plus Claude Code skills over the SDK (Phase 3).

The human number, the metric the agents cannot move: people outside Prieston who have built something on the SDK. Phase 1: zero, and the quickstart timed by someone who is not Teo. Phase 2: the first external builder. Phase 3: apps in a gallery that Prieston did not write.

2026 is a stabilization year. A public API is a compatibility promise; every surface published will be carried for years. The debt audit therefore asks "what must never go public before it is cleaned" rather than "what breaks first".

## Phase 1: Name the API and make it honest (September to end of October 2026)

Foundation:
- Scheduled agents live on `main` (`.agents/`, `agents.yml`). Due 25 September.
- ADR-0001, public API surface: the three layers as sub-exports (`@klorad/api/world`, `/access`, `/integration`), which thesis classes are in v0.1 as types, which as implementations, where today's extra surfaces go (tour, assets, environment, exhibits, floor plans, rooms, nav nodes), the semver and deprecation policy, and the rule that the World layer has no React or renderer imports. Drafted by an agent, decided by Teo. Due 30 September.
- World-model coverage inventory (`docs/platform-inventory.md`): every class in `docs/WORLD-MODEL.md` marked live / partial / app-only / absent with a file reference, plus every homepage claim reconciled against it. Due 30 September.
- CI truth: root `pnpm check`; editor e2e in its own job. Due 30 September.
- Debt audit (`docs/DEBT.md`), ranked by "must not go public as is". Due 8 October. First paydown, top three items, one PR each. Due 31 October.

SDK (order from the thesis dependency chain: Space → Time → Scene Object and state → Physical correspondence → Action, Entitlement, Behaviour → Integration → Rendering):
- `@klorad/api` reorganised per ADR-0001 into `/world`, `/access`, `/integration` sub-exports; existing surfaces re-exported under their ADR homes without behaviour change. Due 15 October.
- Kernel step 1 and 2, Space and Time: explicit Coordinate System on the Scene, stable ids and lookup, an observation model with timestamps and ordering (Time Spectrum v1). Due 22 October.
- Kernel step 3, Physical correspondence: DigitalObject / DigitalShadow / DigitalTwin as Scene Object classification; a Shadow ingests timestamped observations through the public API; `IoTAPI.getData` stops returning null. Due 31 October.
- `@klorad/core` split: pure model out of stores and React. Due 31 October, may slip into Phase 2 depending on the debt audit.

Docs:
- `apps/docs`: Docusaurus site with TypeDoc reference generated from `@klorad/api`, deployed at docs.klorad.com. Concepts section written from the thesis layers. Due 15 October.
- Quickstart = kernel proof: new project, `@klorad/api` + three.js + a mock IoT connector, a georeferenced scene with a Shadow that updates from timestamped observations. Written against the real API, then timed by a person who is not Teo. Target under one afternoon. Due 31 October (Action, Entitlement, Behaviour join it in Phase 2).

Demonstration apps:
- Mobility import report: every place `apps/mobility` reaches into `@klorad/core` internals or an engine to change world state, mapped to a thesis class or marked server-only. The rewrite worklist and an input to ADR-0001. Due 3 October. The rewrite itself is Phase 2.
- Mobility demo path from a clean database on `mock-inet`, documented. Due 15 October.
- Heritage: status against the seven-PR sequence, canvas fix landed. Due 8 October. No further Heritage feature work in Phase 1.
- Campus: no feature work; it is rewritten in Phase 2.

Website:
- Homepage per `docs/website-homepage-draft.md` with two changes: the four cards are "worlds built with Klorad", not products, and the primary CTA is the docs. After the H1 / research route decisions. Due 22 October.
- `/research` and `/journal` per the content brief once committed to `docs/`. Due 22 October.

Deferred from Phase 1: the Twin (two-way) path, Actions, Entitlements and Behaviours implementations (kernel steps 4 and 5), the generalisation of rooms and floor plans into spatial regions, new connector adapters, billing, XR, agent tooling, Urban, any work on the legacy editor and admin apps beyond keeping them building (decision 15 October: the editor may become the reference "builder" app for the SDK, or be frozen).

## Phase 2: First external builder (November to December 2026)

- Kernel step 4, Action → Entitlement → Behaviour: Actions declared per Scene Object, validated by Entitlements (participation and protected capabilities, not only object ACLs), executing Behaviours that mutate world state; Animations as the visual response. Replaces the app-level rule engine in Mobility.
- Kernel step 5, Integration: connectors supply inbound observations to Shadows and outbound execution for Twins; the Twin path is an authorised Action reaching a device through a connector port.
- Kernel step 6, Rendering independence: Mobility rewritten so it never bypasses the public API (the Mapbox proof); Cesium proof through the editor or Heritage per the 15 October decision. Campus follows; Heritage if the seven-PR audit says it is close.
- Time Spectrum v2: history and playback on a scene.
- npm publish of `@klorad/api` and the engine packages (public or private registry per the 30 September decision), versioned 0.x with the ADR-0001 policy.
- First external builder: one named developer or student team, chosen by 15 October, building a small twin on the SDK with Teo available. Their friction log becomes board items.
- Metrics: docs visits, quickstart completions (instrumented on the docs site), npm installs, worlds published by non-Prieston accounts, support minutes per builder per week.
- Pricing model decision (15 December): SDK free with the hosted platform (tenancy, storage, push, auth) as the paid layer, or another split.

## Phase 3: Public docs and the agent path (January to February 2027)

- Public launch of docs.klorad.com and the gallery of worlds, including the first external one.
- MCP server and Claude Code skill over the SDK; existence proof: an agent builds a small twin app from a prompt. Journal entry about it only after it works.
- Second external builder; outbound to developer and GIS communities, university labs, system integrators.

## Decisions open (on the Command board with dates)

ADR-0001 approval (30 September; drafted from the revised `docs/WORLD-MODEL.md`, including the homes for surfaces not in the diagram). npm public or private registry for the first releases (30 September). Homepage H1 and research route (30 September). First external builder target (15 October). Legacy editor and admin: reference builder app or frozen (15 October). How much of DEBT.md is paid before version 1 goes online, after DEBT.md (31 October). Pricing model (15 December).

Decided 21 September: fix in place, no rewrite of `@klorad/core`; version 1 ships from the existing core, see `docs/ARCHITECTURE.md`.

## Kill and narrow criteria (end of February 2027)

If by the end of February nobody outside Prieston has built anything on the SDK and the quickstart still needs Teo in the room, Klorad stops being marketed as a platform for others and becomes internal infrastructure for Prieston Technologies projects. The thesis model stays; the public promise is withdrawn.

## Standing rules for agents

The gate list in `.agents/CLAUDE.md` applies to every session. In short: open PRs, never merge to main; nothing sent to a customer or partner; no price changes; no production credentials; no database migrations from an agent; fixture mode only; no public API surface added without a thesis class or an ADR behind it; stop and ask instead of substituting.

## Cadence

Sprints run two weeks. Sprint 1 runs 21 September to 2 October 2026 and the pattern repeats. Daily brief on weekday mornings, mid-sprint check on the Tuesday of week two, sprint close on the final Friday (the Cowork prompts are in the Drive folder).

## How to change this plan

Edit this file in a PR (agents) or directly on main (Teo). Then mirror the change on the Development board (5104329450).

**This file is the direction; the board is the work queue.** The Development board's **"Ready for agent"** group is what the `nightly-build` agent pulls from: it takes the top item, reads its name + updates as the spec, ships one small slice as a draft PR titled `board: <item>`, and moves the item to "In review" ("Needs decision" if it must ask). `board-sync` moves items whose PR merged to "Done" and keeps "Ready for agent" topped up to 3 from **"Backlog to launch"**, in Target-date order, only for items with Status "Not started" and at least one update (the spec). To hold an item back, set it "Blocked" or "Waiting on Teo", or leave it without a spec.
