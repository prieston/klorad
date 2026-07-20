"use client";

import Link from "next/link";
import { Bell, MapPin } from "lucide-react";
import { subsystemDescriptor } from "@/lib/mobility/subsystem-icon";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  targetPath: string | null;
  deviceIds: string[];
  createdAtIso: string;
}

interface Props {
  slug: string;
  worldName: string;
  items: NotificationItem[];
  /** id → { name, subsystem } lookup for rendering device chips. Any
   *  id missing from the map was probably deleted after the alert
   *  fired — surface a neutral chip so the row still makes sense. */
  deviceMap: Record<string, { name: string; subsystem: string }>;
}

/**
 * Visitor notifications feed. One row per broadcast the operator
 * sent to this world, most recent first. Rows carry:
 *   - date (relative + absolute tooltip)
 *   - title + body
 *   - device chips (from `deviceIds`) — visual context for what
 *     the alert was about
 *   - "View on map" link → `targetPath` (points at `/w/<slug>?devices=…`
 *     for device-scoped alerts, plain `/w/<slug>` otherwise)
 */
export function NotificationsList({
  slug,
  worldName,
  items,
  deviceMap,
}: Props) {
  return (
    <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pb-32 pt-6 md:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--w-fg,#1a1a1a)]">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-[var(--w-fg-muted,#6b6b6b)]">
          Every alert sent to {worldName}. Tap a row to open the map at the
          affected devices.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--w-border,#e6e6ea)] bg-[color-mix(in_srgb,var(--w-surface,#ffffff)_60%,transparent)] p-8 text-center">
          <Bell
            size={20}
            strokeWidth={1.5}
            className="mx-auto text-[var(--w-fg-muted,#6b6b6b)]"
          />
          <p className="mt-3 text-sm font-medium text-[var(--w-fg,#1a1a1a)]">
            No notifications yet
          </p>
          <p className="mt-1 text-[11px] text-[var(--w-fg-muted,#6b6b6b)]">
            Operator alerts and lane-closure announcements will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--w-border,#e6e6ea)] rounded-2xl border border-[var(--w-border,#e6e6ea)] bg-[var(--w-surface,#ffffff)]">
          {items.map((n) => {
            const href = n.targetPath ?? `/w/${slug}`;
            const knownDevices = n.deviceIds
              .map((id) => ({ id, meta: deviceMap[id] }))
              .filter((d) => d.meta);
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--w-page,#f5f5f7)]"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--w-accent-soft,rgba(14,165,233,0.12))] text-[var(--w-accent,#0ea5e9)]"
                  >
                    <Bell size={14} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--w-fg,#1a1a1a)]">
                        {n.title}
                      </p>
                      <time
                        dateTime={n.createdAtIso}
                        title={new Date(n.createdAtIso).toLocaleString()}
                        className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.18em] text-[var(--w-fg-muted,#6b6b6b)]"
                      >
                        {relativeFrom(n.createdAtIso)}
                      </time>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--w-fg-soft,#3d3d3d)]">
                      {n.body}
                    </p>

                    {knownDevices.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {knownDevices.slice(0, 6).map(({ id, meta }) => {
                          const desc = subsystemDescriptor(meta!.subsystem);
                          const Icon = desc.icon;
                          return (
                            <span
                              key={id}
                              className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full border border-[var(--w-border,#e6e6ea)] bg-[var(--w-surface,#ffffff)] px-2 py-0.5 text-[10px] text-[var(--w-fg-muted,#6b6b6b)]"
                            >
                              <Icon size={9} strokeWidth={2} />
                              <span className="truncate">{meta!.name}</span>
                            </span>
                          );
                        })}
                        {knownDevices.length > 6 ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--w-page,#f5f5f7)] px-2 py-0.5 text-[10px] text-[var(--w-fg-muted,#6b6b6b)]">
                            +{knownDevices.length - 6} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {n.deviceIds.length > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--w-accent,#0ea5e9)]">
                        <MapPin size={9} strokeWidth={2} />
                        View on map
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function relativeFrom(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
