"use client";

import { LayoutGrid } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";
import HomePagePanel from "@/app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/HomePagePanel";

interface Props {
  orgId: string;
  mapId: string;
}

/**
 * Home — composes the mobile home students see. Phase 4a hosts the
 * existing bilingual hero / tagline / section-toggle editor under
 * the new shell. Drag-to-reorder quick tiles is a follow-up — needs
 * a `sceneData.homeTiles` schema and a reorder primitive.
 */
export default function CampusHomePageClient({
  orgId: _orgId,
  mapId,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Home"
        subtitle="Greeting, hero image and which home sections appear. EL + EN."
        actions={<OpenPublicAction href={`/campus/${mapId}`} />}
      />

      <div className="space-y-6">
        <HomePagePanel mapId={mapId} />

        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <LayoutGrid size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Quick-action tiles
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                The four tiles under the greeting — Find a room, Get
                directions, Today&rsquo;s events, Ask Klio. Reorder + pick
                from a library.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
            Drag-to-reorder tile editor lands next.
          </div>
        </Panel>
      </div>
    </div>
  );
}
