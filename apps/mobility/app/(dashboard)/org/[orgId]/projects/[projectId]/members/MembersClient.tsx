"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  Ban,
  Crown,
  Eye,
  Lock,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OrganizationRole } from "@prisma/client";

type Override = OrganizationRole | "blocked" | null;

interface Member {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  joinedAt: string;
  orgRole: OrganizationRole;
  override: Override;
}

interface MembersResponse {
  members: Member[];
  yourOrgRole: OrganizationRole | null;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

const ROLE_LABEL: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Operator",
  publicViewer: "Read-only",
};

const ROLE_ICON: Record<OrganizationRole, LucideIcon> = {
  owner: Crown,
  admin: Shield,
  member: Wrench,
  publicViewer: Eye,
};

const ROLE_TONE: Record<OrganizationRole, string> = {
  owner: "bg-accent-soft text-accent",
  admin: "bg-blue-500/10 text-blue-600",
  member: "bg-emerald-500/10 text-emerald-600",
  publicViewer: "bg-surface-2 text-text-tertiary",
};

function effectiveRole(m: Member): {
  role: OrganizationRole | "blocked";
  reason: "inherited" | "override" | "blocked" | "owner-immune";
} {
  if (m.orgRole === "owner") return { role: "owner", reason: "owner-immune" };
  if (m.override === "blocked") return { role: "blocked", reason: "blocked" };
  if (m.override === null) return { role: m.orgRole, reason: "inherited" };
  return { role: m.override, reason: "override" };
}

export function MembersClient({
  orgId,
  projectId,
  projectTitle,
  currentUserId,
  yourOrgRole,
}: {
  orgId: string;
  projectId: string;
  projectTitle: string;
  currentUserId: string;
  yourOrgRole: OrganizationRole;
}) {
  const { data, isLoading, mutate } = useSWR<MembersResponse>(
    `/api/projects/${projectId}/members`,
    fetcher,
  );
  const members = data?.members ?? [];
  const canManage = yourOrgRole === "owner" || yourOrgRole === "admin";

  const counts = useMemo(() => {
    let overrides = 0;
    let blocked = 0;
    for (const m of members) {
      if (m.override === "blocked") blocked += 1;
      else if (m.override !== null) overrides += 1;
    }
    return { total: members.length, overrides, blocked };
  }, [members]);

  const updateOverride = async (userId: string, value: Override) => {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ override: value }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Update failed");
        return;
      }
      void mutate();
    } catch {
      toast.error("Update failed");
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            {projectTitle}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Members.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Per-project role overrides. Each org member inherits their
            organisation role unless you override it here.
          </p>
        </div>
        <Link
          href={`/org/${orgId}/settings/members`}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
        >
          <Users size={14} strokeWidth={1.8} aria-hidden />
          Org team
        </Link>
      </header>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat icon={Users} label="People" value={counts.total} />
        <Stat
          icon={Wrench}
          label="Overrides"
          value={counts.overrides}
          tone={counts.overrides > 0 ? "primary" : "muted"}
        />
        <Stat
          icon={Ban}
          label="Blocked"
          value={counts.blocked}
          tone={counts.blocked > 0 ? "alarm" : "muted"}
        />
      </section>

      {/* Explainer */}
      <section className="mb-6 rounded-2xl border border-line-soft bg-surface-2 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <Lock size={14} strokeWidth={1.8} />
          </span>
          <div className="text-sm">
            <h3 className="font-medium text-text-primary">
              How project overrides work
            </h3>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-text-secondary">
              <li>
                <span className="font-medium text-text-primary">Inherit</span>:
                no row stored. The person uses their organisation role on this
                project.
              </li>
              <li>
                <span className="font-medium text-text-primary">Override</span>:
                pick a role and it replaces their org role for this project
                only. Can be more permissive or stricter.
              </li>
              <li>
                <span className="font-medium text-text-primary">Block</span>:
                they keep org access but are denied this project.{" "}
                <span className="text-text-tertiary">
                  Owners can&apos;t be blocked.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="overflow-hidden rounded-2xl border border-line-soft bg-bg">
        <div className="flex items-center gap-3 border-b border-line-soft bg-surface-2 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          <span className="flex-1">Person</span>
          <span className="hidden w-[120px] md:block">Org role</span>
          <span className="hidden w-[140px] md:block">Effective</span>
          <span className="w-[180px] text-right">Project access</span>
        </div>
        {isLoading && members.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-text-tertiary">
            Loading…
          </p>
        ) : members.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-text-tertiary">
            No org members.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {members.map((m) => (
              <MemberItem
                key={m.userId}
                member={m}
                isYou={m.userId === currentUserId}
                canManage={canManage}
                onChange={(v) => updateOverride(m.userId, v)}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/* ─── Row ──────────────────────────────────────────────────────────── */

function MemberItem({
  member,
  isYou,
  canManage,
  onChange,
}: {
  member: Member;
  isYou: boolean;
  canManage: boolean;
  onChange: (v: Override) => void;
}) {
  const eff = effectiveRole(member);
  const isOwner = member.orgRole === "owner";
  const disabled = !canManage || isOwner || isYou;

  // Map the persisted override + special "blocked"/inherit cases into a
  // single select value the dropdown can drive.
  const selectValue: string =
    member.override === null
      ? "inherit"
      : member.override === "blocked"
        ? "blocked"
        : (member.override as string);

  return (
    <li className="grid items-center gap-3 px-4 py-3 md:grid-cols-[1fr_120px_140px_180px]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} email={member.email} image={member.image} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">
            {member.name ?? member.email ?? "Unknown"}
            {isYou && (
              <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                you
              </span>
            )}
            {isOwner && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                <Crown size={9} strokeWidth={2} aria-hidden />
                owner
              </span>
            )}
          </p>
          <p className="truncate text-xs text-text-tertiary">{member.email}</p>
        </div>
      </div>
      <div className="hidden md:block">
        <RolePill role={member.orgRole} />
      </div>
      <div className="hidden md:block">
        {eff.role === "blocked" ? (
          <BlockedPill />
        ) : (
          <RolePill
            role={eff.role}
            sub={
              eff.reason === "override"
                ? "Overridden"
                : eff.reason === "inherited"
                  ? "Inherited"
                  : null
            }
          />
        )}
      </div>
      <div className="flex items-center justify-end">
        <select
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "inherit") onChange(null);
            else if (v === "blocked") onChange("blocked");
            else onChange(v as OrganizationRole);
          }}
          className="rounded-md border border-line-strong bg-bg px-3 py-1.5 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="inherit">Inherit org role</option>
          <optgroup label="Override with">
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Operator</option>
            <option value="publicViewer">Read-only</option>
          </optgroup>
          {!isOwner && (
            <optgroup label="Deny">
              <option value="blocked">Block from project</option>
            </optgroup>
          )}
        </select>
      </div>
    </li>
  );
}

/* ─── Primitives ───────────────────────────────────────────────────── */

function Avatar({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  if (image) {
    return (
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-medium text-text-secondary">
      {(name ?? email ?? "·").charAt(0).toUpperCase()}
    </span>
  );
}

function RolePill({
  role,
  sub,
}: {
  role: OrganizationRole;
  sub?: string | null;
}) {
  const Icon = ROLE_ICON[role];
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${ROLE_TONE[role]}`}
      >
        <Icon size={10} strokeWidth={2} aria-hidden />
        {ROLE_LABEL[role]}
      </span>
      {sub && (
        <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-text-tertiary">
          {sub}
        </p>
      )}
    </div>
  );
}

function BlockedPill() {
  return (
    <div>
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-red-600">
        <Ban size={10} strokeWidth={2} aria-hidden />
        Blocked
      </span>
      <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-text-tertiary">
        Project-only
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "primary" | "alarm" | "muted";
}) {
  const dotClass =
    tone === "alarm"
      ? "bg-red-500/10 text-red-600"
      : tone === "muted"
        ? "bg-surface-2 text-text-tertiary"
        : "bg-accent-soft text-accent";
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
          {label}
        </span>
        <span
          aria-hidden
          className={`flex h-8 w-8 items-center justify-center rounded-full ${dotClass}`}
        >
          <Icon size={14} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 text-3xl font-light text-text-primary">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
