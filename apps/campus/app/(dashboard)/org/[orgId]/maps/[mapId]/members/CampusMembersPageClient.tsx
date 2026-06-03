"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Ban,
  Crown,
  Eye,
  Pencil,
  RotateCcw,
  Users,
} from "lucide-react";
import { Panel, Select } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";

interface Props {
  orgId: string;
  mapId: string;
}

type Role = "owner" | "admin" | "member" | "publicViewer";
type Override = Role | "blocked" | null;
type EffectiveRole = Role | "blocked";

interface Member {
  id: string;
  userId: string;
  role: Role;
  override: Override;
  effectiveRole: EffectiveRole;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface MembersResponse {
  members: Member[];
}

const fetcher = (url: string): Promise<MembersResponse> =>
  fetch(url).then((r) => r.json());

/**
 * Campus-tier Members — every org member shown alongside their
 * **effective** role on this campus. The role picker lets owners +
 * admins override the org-level role for this specific campus, or
 * block someone entirely.
 *
 * The IA layering:
 *   - Org members are added / removed at `/org/<orgId>/settings/members`
 *     (still the place for invites).
 *   - Per-campus role overrides live here. They supersede the org
 *     role for this campus only.
 *
 * Owners are immune to overrides — the picker is read-only on the
 * owner row.
 */
export default function CampusMembersPageClient({ orgId, mapId }: Props) {
  const { data, isLoading } = useSWR<MembersResponse>(
    `/api/maps/${mapId}/members`,
    fetcher,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const all = data?.members ?? [];
  // Group by effective role so the screen reads as "who can do what
  // on this campus" rather than "who is what at the org tier".
  const active = all.filter((m) => m.effectiveRole !== "publicViewer" && m.effectiveRole !== "blocked");
  const viewers = all.filter((m) => m.effectiveRole === "publicViewer");
  const blocked = all.filter((m) => m.effectiveRole === "blocked");

  const applyOverride = async (member: Member, next: Override) => {
    if (busyUserId) return;
    setBusyUserId(member.userId);
    try {
      if (next === null) {
        // "Inherit from organisation" → clear the override row.
        const res = await fetch(
          `/api/maps/${mapId}/members/${member.userId}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Failed");
        toast.success("Reverted to organisation role");
      } else {
        const body =
          next === "blocked" ? { role: null } : { role: next };
        const res = await fetch(
          `/api/maps/${mapId}/members/${member.userId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed");
        }
        toast.success(
          next === "blocked"
            ? "Blocked from this campus"
            : "Override saved",
        );
      }
      await globalMutate(`/api/maps/${mapId}/members`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Manage"
        title="Members"
        subtitle="Who can edit or view this campus. Overrides on this screen apply only to this campus; the org-tier role is the fallback."
        actions={
          <Link
            href={`/org/${orgId}/settings/members`}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Invite to organisation
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        }
      />

      <Panel className="mb-6 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Users size={16} strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary">
              How overrides work
            </h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              The role you pick here applies only to this campus. Pick{" "}
              <span className="font-medium text-text-primary">
                Inherit
              </span>{" "}
              to fall back to the organisation role, or{" "}
              <span className="font-medium text-text-primary">
                Block
              </span>{" "}
              to lock the member out of this campus entirely. Owners
              always retain access.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Active on this campus
          </h2>
          <span className="text-xs text-text-tertiary">
            {active.length} {active.length === 1 ? "person" : "people"}
          </span>
        </div>

        {isLoading && !data ? (
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-14 animate-pulse rounded-xl bg-surface-2/60"
              />
            ))}
          </ul>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {active.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                busy={busyUserId === m.userId}
                onApply={(next) => void applyOverride(m, next)}
              />
            ))}
          </ul>
        )}
      </Panel>

      {viewers.length > 0 ? (
        <Panel className="mt-6 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Viewers
            </h2>
            <span className="text-xs text-text-tertiary">
              {viewers.length}{" "}
              {viewers.length === 1 ? "person" : "people"}
            </span>
          </div>
          <ul className="space-y-2">
            {viewers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                busy={busyUserId === m.userId}
                onApply={(next) => void applyOverride(m, next)}
              />
            ))}
          </ul>
        </Panel>
      ) : null}

      {blocked.length > 0 ? (
        <Panel className="mt-6 rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Blocked from this campus
            </h2>
            <span className="text-xs text-text-tertiary">
              {blocked.length}{" "}
              {blocked.length === 1 ? "person" : "people"}
            </span>
          </div>
          <ul className="space-y-2">
            {blocked.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                busy={busyUserId === m.userId}
                onApply={(next) => void applyOverride(m, next)}
              />
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  busy,
  onApply,
}: {
  member: Member;
  busy: boolean;
  onApply: (next: Override) => void;
}) {
  const name =
    member.user.name?.trim() ||
    member.user.email?.split("@")[0] ||
    "Unnamed";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const isOwner = member.role === "owner";
  // The picker's value: "inherit" when no override, the role name
  // otherwise, "blocked" for the null-role row.
  const pickerValue: "inherit" | Role | "blocked" =
    member.override === null ? "inherit" : member.override;

  const handleChange = (value: string) => {
    if (value === "inherit") onApply(null);
    else if (value === "blocked") onApply("blocked");
    else onApply(value as Role);
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-surface-2/30 p-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {member.user.image ? (
          <img
            src={member.user.image}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          initials || "?"
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {name}
        </p>
        <p className="truncate text-xs text-text-tertiary">
          {member.user.email}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <EffectiveBadge effective={member.effectiveRole} />
        {isOwner ? (
          <span className="text-[11px] text-text-tertiary">
            Owner — always full access
          </span>
        ) : (
          <>
            <Select
              value={pickerValue}
              disabled={busy}
              onChange={(e) => handleChange(e.target.value)}
              className="w-[170px]"
            >
              <option value="inherit">
                Inherit ({readableRole(member.role)})
              </option>
              <option value="admin">Override → Admin</option>
              <option value="member">Override → Editor</option>
              <option value="publicViewer">Override → Viewer</option>
              <option value="blocked">Block</option>
            </Select>
            {member.override !== null ? (
              <button
                type="button"
                onClick={() => onApply(null)}
                disabled={busy}
                aria-label="Revert to organisation role"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-40"
              >
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function EffectiveBadge({ effective }: { effective: EffectiveRole }) {
  if (effective === "blocked") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-700 dark:text-red-300">
        <Ban size={11} strokeWidth={1.75} aria-hidden />
        Blocked
      </span>
    );
  }
  const meta = ROLE_META[effective];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.classes}`}
    >
      <Icon size={11} strokeWidth={1.75} aria-hidden />
      {meta.label}
    </span>
  );
}

const ROLE_META: Record<
  Role,
  { label: string; icon: typeof Crown; classes: string }
> = {
  owner: {
    label: "Owner",
    icon: Crown,
    classes: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  admin: {
    label: "Admin",
    icon: Pencil,
    classes: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  },
  member: {
    label: "Editor",
    icon: Pencil,
    classes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  publicViewer: {
    label: "Viewer",
    icon: Eye,
    classes: "bg-text-tertiary/10 text-text-tertiary",
  },
};

function readableRole(role: Role): string {
  return ROLE_META[role].label;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-sm font-medium text-text-primary">
        No active members
      </p>
      <p className="max-w-xs text-xs text-text-tertiary">
        Invite teammates from the organisation settings — they&rsquo;ll
        appear here once they accept.
      </p>
    </div>
  );
}
