# @klorad/docs

The Klorad SDK documentation site: Fumadocs on Next.js 15, TypeDoc-generated API reference over
`packages/api/src/index.ts`. See `docs/adr/0002-docs-site.md` for why Fumadocs over Docusaurus,
the version pins, and two upstream incompatibilities found while scaffolding this.

## Content

Sidebar: Getting started, Concepts (World / Access / Integration), API reference.

Three files under `content/docs/` and `public/llms.txt` are **generated, not hand-edited** (see
`.gitignore`): `pnpm dev` and `pnpm build` both run `scripts/generate-content.mjs` first, which

- copies `docs/guides/building-a-klorad-app.md` into `content/docs/index.mdx` (Getting started),
  falling back to a placeholder until that guide (PR #309) merges;
- runs TypeDoc over `packages/api/src/index.ts` into `content/docs/reference/index.mdx`;
- writes `public/llms.txt` combining both, plain markdown, for agents reading the docs in one fetch.

`content/docs/concepts/*.mdx` are hand-authored placeholders, committed normally.

## Commands

```bash
pnpm --filter @klorad/docs dev      # http://localhost:3000
pnpm --filter @klorad/docs build
pnpm --filter @klorad/docs lint
```

## Not done yet

- No CI step: agents cannot edit `.github/workflows/*`; the diff for `pnpm --filter @klorad/docs
  build` is in the scaffolding PR body for a human to apply.
- No Vercel project. Deploy target is `docs.klorad.com` per `docs/PLAN.md`; not configured here.
- No search, no `og` image generation, no i18n. Scaffold only, per the board item.
