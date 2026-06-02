"use client";

import { MessageSquare, Sliders, Wrench } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";
import { AiKeyPanel } from "@/app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/AiKeyPanel";

interface Props {
  orgId: string;
  mapId: string;
}

/**
 * Klio — the AI campus assistant settings screen. Phase 4a ships the
 * BYOK Anthropic key card (real, wired to `/ai-settings`) plus
 * placeholder cards for the three knobs that need a backend before
 * they can land: tools the assistant can call, persona sliders,
 * suggestion chips. Those move to "Coming next" so the rail row
 * resolves to something honest instead of dead UI.
 */
export default function CampusKlioPageClient({
  orgId: _orgId,
  mapId,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Klio"
        subtitle="The AI campus assistant, powered by Claude. BYOK Anthropic key, choose its tools and seed the prompts students see first."
        actions={<OpenPublicAction href={`/campus/${mapId}/klio`} />}
      />

      <div className="space-y-6">
        <AiKeyPanel mapId={mapId} />

        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Wrench size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Tools Klio can call
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Search news, lookup buildings, give directions, fetch events,
                list clubs — toggle each on or off.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
            All tools on by default. Per-tool toggles land next.
          </div>
        </Panel>

        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Sliders size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Persona &amp; tone
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Formal ↔ casual, English-first ↔ Greek-first, disclosure copy.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
            Sliders + tone copy land alongside the tool toggles.
          </div>
        </Panel>

        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Suggestion chips
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                EL + EN prompts students see in the empty Klio state.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
            Editable chip list lands next.
          </div>
        </Panel>
      </div>
    </div>
  );
}
