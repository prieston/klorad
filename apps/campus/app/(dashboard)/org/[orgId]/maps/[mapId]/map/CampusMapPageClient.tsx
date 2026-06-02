"use client";

import { Compass, ExternalLink, Route } from "lucide-react";
import { Button, Panel } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { IndoorMapIdCard } from "@/app/(dashboard)/components/IndoorMapIdCard";

interface Props {
  orgId: string;
  mapId: string;
}

/**
 * Map & Wayfinding — thin authoring surface per
 * [[campus-indoor-mappedin-decision]]. Klorad doesn't own buildings,
 * POIs or rooms — MappedIn does. So this screen is about linking the
 * venue and curating shareable routes; the rest is authored in
 * MappedIn's hosted tools.
 *
 * Phase 4a ships the venue link + Saved Routes empty state. The
 * Saved Routes editor + default-floor selector land in a follow-up
 * once the data model + MappedIn space picker primitive are in
 * place.
 */
export default function CampusMapPageClient({ orgId: _orgId, mapId }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Map & Wayfinding"
        subtitle="Link the MappedIn venue and curate the routes worth sharing."
        actions={
          <a
            href={`/campus/${mapId}/map`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="secondary">
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
              Open public
            </Button>
          </a>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <IndoorMapIdCard mapId={mapId} />

        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Default floor
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Which floor the public viewer opens on.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-soft bg-surface-2/40 py-8 text-center">
            <Compass
              size={20}
              strokeWidth={1.6}
              className="text-text-tertiary"
              aria-hidden
            />
            <p className="text-xs text-text-tertiary">
              Floor selector lands once a venue is linked.
            </p>
          </div>
        </Panel>
      </div>

      <section className="mt-6">
        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Saved routes
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Pre-computed From → To routes that students can share via QR
                or deep link.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Route size={18} strokeWidth={1.6} aria-hidden />
            </div>
            <p className="text-sm font-medium text-text-primary">
              No saved routes yet
            </p>
            <p className="max-w-sm text-xs text-text-tertiary">
              Curate a route — Library → Main Cafeteria, say — and we&rsquo;ll
              generate a QR code students can scan from a printed sign.
            </p>
            <span className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
              Coming next
            </span>
          </div>
        </Panel>
      </section>
    </div>
  );
}
