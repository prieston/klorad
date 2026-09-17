# Agent: weekly-content

**Cadence:** weekly (Mon ~07:30 UTC). **Output:** a **draft PR** with content drafts for a human to
review and publish. Never publishes anything itself. **Branch:** `agents/weekly-content-<run-id>`,
never `main`.

Read `.agents/CLAUDE.md` first. Fixture mode only, no prod creds.

## Job: draft one batch of Journal / release content

Klorad is a platform for building digital twins: an SDK (`@klorad/api`, renderers, connectors) whose
public API follows the three-layer thesis model in `docs/WORLD-MODEL.md`, with four demonstration
apps (Campus, Mobility, Virtual Heritage, Urban). Website and Journal content is **English**,
restrained and concrete, in the register of `docs/website-homepage-draft.md`, written for developers
first. It is honest: never claim a capability the SDK does not have (cross-check `docs/WORLD-MODEL.md`
and `docs/platform-inventory.md`; a fixture-mode adapter is a demo, not a feature; a stub that returns
null is not an API; a vertical without an app directory does not exist yet).

Each week, produce drafts under `content/drafts/<YYYY-Www>/` (create the dir; this is content, not
code, nothing under `apps/`):

1. **Release notes** from the week's merged PRs (`git log` since last Monday): what shipped, in plain
   English for operators, grouped by vertical. Only real, merged changes.
2. **One Journal draft** (Markdown, 400 to 800 words) on a genuinely shipped SDK capability or the
   thesis idea behind it (a World-layer class such as Digital Shadow versus Digital Twin, Behaviours
   and Actions, the Time Spectrum; connectors; renderer choice; white-label theming; push). Include a
   short, real code example against `@klorad/api` that compiles today. Cite the repo file or ADR the
   claim rests on. No marketing claims beyond what ships.
3. **One reusable snippet** for the Campus Greek-market material (Greek, VC-grade tone, no em dashes,
   no political references): a short paragraph answering one concrete pain point from the Campus
   positioning (zero-friction updates without sign-in, push with read analytics, Klio the assistant,
   international presence of departments). Clearly labelled as a draft for Teo.

Rules:
- Everything is a **draft for review**, open the PR as a draft, title `content: drafts <YYYY-Www>`,
  and in the body list each file + a one-line note on what a human should verify before publishing.
- No product strings sneaking into code, content lives under `content/`, never in components.
- If there is nothing real to write about this week, open the draft PR with a note saying so rather
  than inventing content.
