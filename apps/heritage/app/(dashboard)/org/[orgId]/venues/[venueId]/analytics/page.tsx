import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { languageName } from "@/lib/heritage/ui-strings";
import { PageHeader } from "@/lib/heritage/ui/page-header";

type Params = Promise<{ orgId: string; venueId: string }>;
type Search = Promise<{ days?: string }>;

export const metadata = { title: "Visitor analytics" };

/** Windows a curator actually asks about. Ninety days is the longest that
 *  stays legible as a single number rather than needing a chart. */
const WINDOWS = [7, 30, 90] as const;

/**
 * HER-601 — visitor analytics.
 *
 * What is *not* here is the point. There is no consent banner because there is
 * nothing to consent to: no per-visitor row is ever written, no IP address, no
 * session identifier, no cookie, no timestamp finer than a day. A counter goes
 * up. That means these numbers cannot answer "how long did they stay" or "what
 * did they look at next", and that limitation is the deliberate price of a
 * page a museum's data-protection officer can approve without conditions.
 *
 * The one distinction worth the extra column is direct visits versus embeds.
 * Reach outside the institution's own website is the number that justifies the
 * work to a board, and it is invisible if the two are added together.
 */
export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { orgId, venueId } = await params;
  const { days } = await searchParams;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const windowDays = WINDOWS.includes(Number(days) as (typeof WINDOWS)[number])
    ? Number(days)
    : 30;

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (windowDays - 1));

  const [venue, events] = await Promise.all([
    prisma.heritageVenue.findUnique({
      where: { id: venueId },
      select: { defaultLanguage: true, name: true },
    }),
    prisma.heritageViewEvent.findMany({
      where: { venueId, day: { gte: since } },
      select: {
        kind: true,
        targetId: true,
        isEmbed: true,
        referrerHost: true,
        language: true,
        count: true,
      },
    }),
  ]);
  if (!venue) notFound();

  const lang = venue.defaultLanguage;
  const base = `/org/${orgId}/venues/${venueId}`;
  const total = events.reduce((n, e) => n + e.count, 0);
  const embedded = events.reduce((n, e) => n + (e.isEmbed ? e.count : 0), 0);

  const sum = <K extends string>(key: (e: (typeof events)[number]) => K) => {
    const out = new Map<K, number>();
    for (const e of events) out.set(key(e), (out.get(key(e)) ?? 0) + e.count);
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byKind = sum((e) => e.kind);
  const byLanguage = sum((e) => e.language || "—").filter(([k]) => k !== "—");
  const byReferrer = sum((e) => e.referrerHost || "—").filter(([k]) => k !== "—");

  // Resolve the ids that earned views into something a curator recognises.
  // Only the top rows are looked up: a venue with ten thousand objects should
  // not issue ten thousand joins to render a leaderboard of ten.
  const topIds = sum((e) => e.targetId)
    .filter(([id]) => id !== "")
    .slice(0, 10);
  const [objects, scenes, tours] = await Promise.all([
    prisma.heritageObject.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, slug: true, title: true },
    }),
    prisma.heritageScene.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, slug: true, title: true },
    }),
    prisma.heritageTour.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, title: true },
    }),
  ]);
  const names = new Map<string, string>();
  for (const r of [...objects, ...scenes, ...tours]) {
    names.set(r.id, pickLocalized(r.title, lang, "en") ?? r.id);
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        eyebrow="HER-601"
        title="Visitor analytics."
        lede="What has been looked at, and from where. Counts only — nothing here identifies a visitor, so there is nothing to consent to and nothing to disclose."
        actions={
          <nav aria-label="Time range" className="flex items-center gap-1.5">
            {WINDOWS.map((d) => (
              <Link
                key={d}
                href={`${base}/analytics?days=${d}`}
                aria-current={d === windowDays ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  d === windowDays
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                {d} days
              </Link>
            ))}
          </nav>
        }
      />

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Views" value={total} />
        <Stat label="On your own site" value={total - embedded} />
        <Stat
          label="Embedded elsewhere"
          value={embedded}
          hint={total > 0 ? `${Math.round((embedded / total) * 100)}% of all views` : undefined}
        />
      </section>

      {total === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
          Nothing has been viewed in this period. Counting begins the moment a
          published page is opened — there is no tag to install.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <Panel title="Most viewed">
            <Rows
              rows={topIds.map(([id, n]) => [names.get(id) ?? "Removed since", n])}
              empty="Only the landing page has been viewed."
            />
          </Panel>

          <Panel title="By page type">
            <Rows rows={byKind.map(([k, n]) => [k, n])} empty="No views yet." />
          </Panel>

          <Panel title="Language read">
            <Rows
              rows={byLanguage.map(([tag, n]) => [languageName(tag), n])}
              empty="No language was recorded."
            />
          </Panel>

          <Panel
            title="Embedded on"
            note="Host names only — never a full address."
          >
            <Rows
              rows={byReferrer.map(([host, n]) => [host, n])}
              empty="No embeds have been loaded from another site yet."
            />
          </Panel>
        </div>
      )}

      <p className="mt-10 flex items-start gap-2 text-xs leading-relaxed text-text-tertiary">
        <ShieldCheck size={13} strokeWidth={1.7} aria-hidden className="mt-px shrink-0" />
        <span>
          No IP address, session identifier or cookie is stored, and no
          timestamp finer than a day. That is why there is no consent banner on
          your public pages, and it is also why these numbers cannot tell you
          how long someone stayed or where they went next. That trade was made
          deliberately.
        </span>
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-5">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-2 text-3xl font-light text-text-primary">
        {value.toLocaleString()}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        {title}
      </h2>
      {children}
      {note ? <p className="mt-2 text-[11px] text-text-tertiary">{note}</p> : null}
    </section>
  );
}

function Rows({ rows, empty }: { rows: [string, number][]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-tertiary">{empty}</p>;
  }
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map(([label, n]) => (
        <li key={label} className="flex items-center gap-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
            {label}
          </span>
          {/* A bar rather than only a number: the shape of the distribution is
              the finding, and a column of digits hides it. */}
          <span aria-hidden className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.max(4, (n / max) * 100)}%` }}
            />
          </span>
          <span className="w-14 shrink-0 text-right text-sm tabular-nums text-text-secondary">
            {n.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
