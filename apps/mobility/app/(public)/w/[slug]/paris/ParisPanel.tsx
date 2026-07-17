"use client";

import Link from "next/link";
import { AssistantPanel } from "@klorad/design-system";
import { AlertTriangle, MapPin } from "lucide-react";
import type { ParisToolAction } from "@/lib/paris/tools";

interface Props {
  slug: string;
  worldId: string;
  worldName: string;
}

/**
 * Paris — the mobility world's read-only assistant. Thin wrapper
 * around the DS `AssistantPanel`:
 *
 * - Endpoint: `/api/paris` (server-side Anthropic tool-use)
 * - Suggestions scoped to what Paris's four tools can actually
 *   answer (alerts, devices, rules) so first-time visitors don't
 *   ask for things Paris can't do (send a notification, ack an
 *   alert — those need the operator app).
 * - Action renderer turns `focus_device` / `open_alert` tool
 *   outputs into deep-link cards under the assistant message.
 *
 * Visibility gate lives on the parent page; the panel itself is
 * anonymous once mounted.
 */
export function ParisPanel({ slug, worldId, worldName }: Props) {
  return (
    <div className="pb-32">
      <AssistantPanel<ParisToolAction>
        endpoint="/api/paris"
        extraBody={{ worldId }}
        heroTitle="Hi, I'm Paris."
        heroSubtitle={`Ask me what's happening on ${worldName} — open alerts, live device status, what triggers notifications.`}
        suggestions={[
          {
            label: "What's happening right now?",
            prompt: "What alerts are open right now?",
          },
          {
            label: "Show me the radars",
            prompt: "List every radar in this world.",
          },
          {
            label: "What triggers a notification?",
            prompt: "What alert rules are configured on this world?",
          },
          {
            label: "Is anything offline?",
            prompt: "Are any devices offline right now?",
          },
        ]}
        placeholder="Ask about alerts, devices, or rules…"
        poweredByLabel="Powered by Claude · Klorad Mobility"
        unavailableCopy="Sorry — Paris is unavailable right now."
        renderActions={(actions) => (
          <ParisActionCards actions={actions} slug={slug} />
        )}
      />
    </div>
  );
}

/**
 * Deep-link cards rendered under Paris's response. `focus_device`
 * lands on the Map tab with the device pin selected; `open_alert`
 * jumps into the alerts panel (operator surface — same domain
 * different route).
 */
function ParisActionCards({
  actions,
  slug,
}: {
  actions: ParisToolAction[];
  slug: string;
}) {
  const unique = dedupe(actions);
  if (unique.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {unique.map((a, i) => {
        const href = hrefFor(a, slug);
        const Icon = iconFor(a.type);
        return (
          <Link
            key={`${a.type}:${a.id}:${i}`}
            href={href}
            className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[var(--w-border,#e6e6ea)] bg-white px-3 py-1 text-xs text-[var(--w-fg,#1a1a1a)] transition-colors hover:border-[var(--w-accent,#0ea5e9)] hover:text-[var(--w-accent,#0ea5e9)]"
          >
            <Icon size={12} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{a.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function dedupe(actions: ParisToolAction[]): ParisToolAction[] {
  const seen = new Set<string>();
  const out: ParisToolAction[] = [];
  for (const a of actions) {
    const key = `${a.type}:${a.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function hrefFor(a: ParisToolAction, slug: string): string {
  if (a.type === "focus_device") {
    // Jump to the Devices tab with the sheet auto-opened. Keeps the
    // deep-link inside the visitor surface so anonymous callers see
    // the same rich detail (video, DMS face, radar tile) they'd get
    // from tapping the row themselves.
    return `/w/${slug}/devices?open=${encodeURIComponent(a.id)}`;
  }
  // `open_alert` — jump to the operator alerts panel; visitors
  // without operator access get the sign-in redirect.
  return `/w/${slug}?alert=${encodeURIComponent(a.id)}`;
}

function iconFor(type: ParisToolAction["type"]) {
  return type === "focus_device" ? MapPin : AlertTriangle;
}
