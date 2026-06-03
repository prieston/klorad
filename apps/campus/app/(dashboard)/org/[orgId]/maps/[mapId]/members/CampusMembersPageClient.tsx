"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Crown, Eye, Pencil, Users } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";

interface Props {
  orgId: string;
  mapId: string;
}

type Role = "owner" | "admin" | "member" | "publicViewer";

interface Member {
  id: string;
  userId: string;
  role: Role;
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
 * Campus-tier Members — read-only roll of everyone in the
 * organisation who can edit this campus. Per-campus role overrides
 * are deferred (see USER-PATH §A12.3); today everyone with the right
 * org role automatically gets access to every campus, so this view
 * mirrors the org-tier list.
 *
 * We keep the screen because the IA is clearer with it than without:
 * a rector standing on a campus dashboard shouldn't have to know
 * that "members" live one level up. The "Manage members" CTA hands
 * them off to the org-tier screen where the actual mutations happen.
 *
 * Filtered to roles that can read or write — `publicViewer` accounts
 * (auth-required-but-read-only campuses, USER-PATH §A13.2) are
 * counted separately so the list stays focused on the working team.
 */
export default function CampusMembersPageClient({ orgId, mapId }: Props) {
  const { data, isLoading } = useSWR<MembersResponse>(
    `/api/organizations/${orgId}/members`,
    fetcher,
  );

  const all = data?.members ?? [];
  const editors = all.filter((m) => m.role !== "publicViewer");
  const viewers = all.filter((m) => m.role === "publicViewer");

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Manage"
        title="Members"
        subtitle="Who can edit or view this campus. Manage roles and invites from the organisation settings."
        actions={
          <Link
            href={`/org/${orgId}/settings/members`}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Manage members
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
              Roles are organisation-wide
            </h2>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Anyone with an editor role on the organisation can author
              every campus inside it. Per-campus role overrides are on
              the roadmap.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Editors
          </h2>
          <span className="text-xs text-text-tertiary">
            {editors.length} {editors.length === 1 ? "person" : "people"}
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
        ) : editors.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-1.5">
            {editors.map((m) => (
              <MemberRow key={m.id} member={m} />
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
          <ul className="space-y-1.5">
            {viewers.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* mapId is referenced so the file's "scoped to this campus"
          contract is type-checked even though the screen currently
          fetches org-level data; per-campus member assignment is the
          follow-up that uses it. */}
      <div className="hidden" data-map-id={mapId} />
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const name =
    member.user.name?.trim() ||
    member.user.email?.split("@")[0] ||
    "Unnamed";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2/30 p-3">
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
      <RoleBadge role={member.role} />
    </li>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-sm font-medium text-text-primary">
        No editors yet
      </p>
      <p className="max-w-xs text-xs text-text-tertiary">
        Invite teammates from the organisation settings — they&rsquo;ll
        appear here once they accept.
      </p>
    </div>
  );
}
