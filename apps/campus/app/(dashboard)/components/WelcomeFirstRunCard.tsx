import Link from "next/link";
import { ArrowRight, Palette, Sparkles, Map as MapIcon } from "lucide-react";
import { Panel } from "@klorad/design-system";

interface Props {
  orgId: string;
  mapId: string;
  campusName: string;
}

/**
 * The "fresh campus" welcome — shown on the campus dashboard when the
 * tenant hasn't done any setup yet (no logo, no MappedIn, no content).
 * Replaces the all-zero stat cards / empty health checklist that
 * otherwise greet a brand-new rector with nothing to act on.
 *
 * Three big tiles route into onboarding's three highest-leverage
 * actions: try sample data, brand, connect MappedIn. The fourth link
 * is the full onboarding hub for anyone who wants the guided tour.
 *
 * Disappears the moment the rector saves any of those — so the
 * dashboard's normal stat/health surface takes over without a
 * settings toggle.
 */
export function WelcomeFirstRunCard({ orgId, mapId, campusName }: Props) {
  const base = `/org/${orgId}/maps/${mapId}`;
  return (
    <Panel className="rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            Welcome
          </p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">
            {campusName} is empty &mdash; let&rsquo;s fix that.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Three quick actions and your students will have something to
            open. Do them in any order; everything can be changed later.
          </p>
        </div>
        <Link
          href={`${base}/onboarding`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          Guided setup
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ActionTile
          href={`${base}/onboarding`}
          icon={<Sparkles size={16} strokeWidth={1.75} aria-hidden />}
          title="Try with sample data"
          hint="Believable news, events, clubs and dining so the public page isn't empty."
        />
        <ActionTile
          href={`${base}/identity`}
          icon={<Palette size={16} strokeWidth={1.75} aria-hidden />}
          title="Brand the campus"
          hint="Name, logo, accent colour. Picked up by the public site immediately."
        />
        <ActionTile
          href={`${base}/map`}
          icon={<MapIcon size={16} strokeWidth={1.75} aria-hidden />}
          title="Connect MappedIn"
          hint="Drop in a venue ID to light up the indoor 3D map + wayfinding."
        />
      </div>
    </Panel>
  );
}

interface TileProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}

function ActionTile({ href, icon, title, hint }: TileProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2/40 p-4 transition-colors hover:border-accent hover:bg-surface-2/70"
    >
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="mt-0.5 text-xs text-text-tertiary">{hint}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-text-tertiary transition-colors group-hover:text-accent">
        Start
        <ArrowRight size={12} strokeWidth={1.75} aria-hidden />
      </span>
    </Link>
  );
}
