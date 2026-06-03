"use client";

import { Compass } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { IndoorMapIdCard } from "@/app/(dashboard)/components/IndoorMapIdCard";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";
import { SavedRoutesCard } from "./SavedRoutesCard";

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
        actions={<OpenPublicAction href={`/campus/${mapId}/map`} />}
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
        <SavedRoutesCard mapId={mapId} />
      </section>
    </div>
  );
}
