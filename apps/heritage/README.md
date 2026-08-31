# Klorad Heritage

Photorealistic cultural heritage on the Klorad platform: captured sites and
artefacts, the records that explain them, and the rights that govern both.

Runs on port **3005**. Shares the platform's database, auth and storage with
Campus and Mobility; a Heritage *venue* is a `Project` with a `HeritageVenue`
row attached.

## Running locally

```bash
pnpm dev:heritage              # heritage alone
pnpm dev:heritage:admin        # heritage + admin, for granting the app flag
pnpm --filter @klorad/heritage seed:demo -- --org <orgId>
```

An org must have `heritage` in its `apps` list before the console will open for
it — grant that in the admin app at port 3002.

`apps/heritage/.env.local` is required, not optional: the repository root
`.env` sets `NEXTAUTH_URL` to port 3001, and OAuth will bounce you to the
editor's callback without an override. See `.env.example`.

## Checks

| Command | Needs | What it proves |
| --- | --- | --- |
| `pnpm --filter @klorad/heritage check:units` | nothing | Rights resolution, the public-domain-scan policy, format deliverability, multilingual fallback, oEmbed parsing, glTF statistics. Runs in CI. |
| `pnpm --filter @klorad/heritage check:probe` | network | The glTF and image parsers against the Khronos sample models. |
| `pnpm --filter @klorad/heritage check:oembed` | app running | 19 oEmbed conformance assertions, including that the provider refuses URLs it does not own. |
| `pnpm --filter @klorad/heritage check:authz` | app running | That an unauthenticated caller cannot tell a real venue id from an invented one. |
| `pnpm --filter @klorad/heritage check:ingest` | storage + database | A real multipart upload, that `ETag` is exposed, that the provider honours Range, and that a completed upload reaches `ready` with a delivery file. |
| `pnpm --filter @klorad/heritage check:rights` | storage | That captures are genuinely private and that rights change how long a delivery URL lives. |

The last two write to whichever database `DATABASE_URL` points at and upload a
few megabytes. They clean up their rows; they leave their objects.

## How ingest works

Most of what a curator uploads is already deliverable. A `.glb`, a JPEG, an MP4
needs validating and measuring, not transcoding — so that happens inline at
upload completion, in about a second, using an HTTP Range read of the file's
header. Probing a 26 GB master moves roughly a megabyte.

Formats that genuinely need conversion — OBJ, FBX, point clouds, splats — are
kept as **archival masters** and labelled as such, before the transfer begins
rather than after. Nothing is discarded; only formats a browser can open are
shown to visitors. Re-export as `.glb` and press Reprocess.

`POST /api/internal/ingest/drain` handles the unhappy paths: a function killed
mid-run, a transient read error, a job enqueued before the pipeline shipped.
It authenticates against `HERITAGE_INGEST_SECRET` and refuses every request
when none is set. Vercel Cron calls it every ten minutes.

## How rights work

Rights are set on the object and on each capture, and resolve most-restrictive-
wins through the venue's policy on whether scanning a public-domain work
asserts new rights over the scan.

That resolution is **enforced, not advisory**. Captures are stored privately
and every delivery URL is signed and time-limited — around a day for the open
statements, fifteen to thirty minutes for the rest. Signing rounds its
timestamp to a fixed boundary so a URL is byte-identical within a period and
still caches; without that, every page render would force a returning visitor
to re-download the model.

## Deploying

1. **Vercel project** pointed at `apps/heritage`. `vercel.json` pins `fra1` for
   the EU residency claim in §9.1 — do not let the region drift.
2. **Environment**: everything in `.env.example`. `NEXTAUTH_URL` and
   `NEXT_PUBLIC_APP_URL` must be the deployed origin, and
   `HERITAGE_INGEST_SECRET` must be set or the cron sweep is disabled.
3. **`pnpm prisma:migrate:deploy`** — all heritage migrations are additive.
4. **`pnpm spaces:set-cors`** — adds the origin and exposes `ETag`, which
   multipart completion depends on. Uploads fail without it.
5. **Google OAuth redirect URIs** — add `<origin>/api/auth/callback/google`.
   Locally that is `http://localhost:3005/api/auth/callback/google`.
6. Run `check:ingest` and `check:rights` against the deployed environment once.
   They catch exactly the misconfigurations that only appear in production.

## Analytics

Counts only. No per-visitor row is written — no IP address, no session
identifier, no cookie, no timestamp finer than a day. A counter goes up.

That is why the public pages carry no consent banner, and it is also why the
numbers cannot tell you how long someone stayed or where they went next. The
trade was made deliberately: a museum needs to justify the spend, not profile
its audience.

The one distinction worth an extra column is direct visits versus embeds.
Reach outside the institution's own website is the figure that justifies the
work to a board, and it disappears if the two are added together.

## Known gaps

- Visitor-facing chrome is English-only. Content is multilingual; the frame
  around it is not.
- `reach` (visitor notifications) is still a stub, deliberately cut from v1.
- Audio and video duration is not measured at ingest.
- No splat or point-cloud delivery. §13.1 is explicit that no measured headset
  benchmark exists, and building a public promise on an unmeasured number is
  how this ships beautiful and untappable.
