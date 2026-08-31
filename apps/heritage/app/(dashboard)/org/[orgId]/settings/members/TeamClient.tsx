"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  Copy,
  Crown,
  Eye,
  Loader2,
  Mail,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { OrganizationRole } from "@prisma/client";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

interface Member {
  id: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: OrganizationRole;
  expires: string;
  createdAt: string;
  invitedBy: string | null;
  token: string;
}

interface TeamResponse {
  members: Member[];
  invites: Invite[];
  yourRole: OrganizationRole | null;
}

const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Operator",
  publicViewer: "Read-only",
};

const ROLE_TONES: Record<OrganizationRole, string> = {
  owner: "bg-accent-soft text-accent",
  admin: "bg-blue-500/10 text-blue-600",
  member: "bg-emerald-500/10 text-emerald-600",
  publicViewer: "bg-surface-2 text-text-tertiary",
};

export function TeamClient({
  orgId,
  orgName,
  currentUserId,
  yourRole,
}: {
  orgId: string;
  orgName: string;
  currentUserId: string;
  yourRole: OrganizationRole | null;
}) {
  const { data, isLoading, mutate } = useSWR<TeamResponse>(
    `/api/orgs/${orgId}/members`,
    fetcher,
  );
  const members = data?.members ?? [];
  const invites = data?.invites ?? [];
  const canManage = yourRole === "owner" || yourRole === "admin";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  const invite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const body = (await res.json()) as { inviteUrl?: string; error?: string };
      if (!res.ok || !body.inviteUrl) {
        toast.error(body.error ?? "Invite failed");
        return;
      }
      setLatestInviteUrl(body.inviteUrl);
      toast.success("Invite created. Share the link.");
      setInviteEmail("");
      void mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const setRole = async (userId: string, role: OrganizationRole) => {
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Role update failed");
        return;
      }
      void mutate();
    } catch {
      toast.error("Role update failed");
    }
  };

  const removeMember = async (userId: string, name: string | null) => {
    if (
      !window.confirm(`Remove ${name ?? "this member"} from the organisation?`)
    )
      return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Remove failed");
        return;
      }
      toast.success("Removed");
      void mutate();
    } catch {
      toast.error("Remove failed");
    }
  };

  const revoke = async (inviteId: string) => {
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/invites/${inviteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error("Revoke failed");
        return;
      }
      void mutate();
    } catch {
      toast.error("Revoke failed");
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-10">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {orgName}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Team.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          People with access to this organisation. Operators run the day-to-day,
          admins curate sources and members, owners control the whole
          organisation.
        </p>
      </header>

      {/* Invite */}
      {canManage && (
        <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
          <div className="mb-4 flex items-center gap-2">
            <Mail size={16} strokeWidth={1.8} className="text-accent" aria-hidden />
            <h2 className="text-lg font-medium text-text-primary">
              Invite someone
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="someone@example.com"
              type="email"
              className="rounded-md border border-line-strong bg-bg px-3 py-2 text-sm text-text-primary"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
              className="rounded-md border border-line-strong bg-bg px-3 py-2 text-sm text-text-primary"
            >
              <option value="member">Operator</option>
              <option value="admin">Admin</option>
              <option value="publicViewer">Read-only</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="button"
              onClick={invite}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <Mail size={14} strokeWidth={1.8} />
              )}
              Send invite
            </button>
          </div>

          {latestInviteUrl ? (
            <div className="mt-4 rounded-xl bg-surface-2 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
                Invite link (share manually until email is wired)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-bg px-3 py-2 font-mono text-xs text-text-primary">
                  {latestInviteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(latestInviteUrl);
                    toast.success("Copied");
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-line-strong px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  <Copy size={12} strokeWidth={1.8} />
                  Copy
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Members */}
      <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} strokeWidth={1.8} className="text-accent" aria-hidden />
            <h2 className="text-lg font-medium text-text-primary">Members</h2>
          </div>
          <span className="text-xs text-text-tertiary">
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
        </div>
        {isLoading ? (
          <p className="py-6 text-sm text-text-tertiary">Loading…</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {members.map((m) => (
              <li
                key={m.id}
                className="grid gap-3 py-4 md:grid-cols-[auto_1fr_auto] md:items-center"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-sm font-medium text-text-secondary">
                  {m.user.name?.charAt(0) ?? m.user.email?.charAt(0) ?? "·"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {m.user.name ?? m.user.email ?? "Unknown"}
                    {m.userId === currentUserId && (
                      <span className="ml-2 text-xs text-text-tertiary">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-text-tertiary">
                    {m.user.email}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && m.userId !== currentUserId ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        setRole(m.userId, e.target.value as OrganizationRole)
                      }
                      className={`rounded-full border-0 px-3 py-1 text-[11px] uppercase tracking-[0.18em] outline-none ${ROLE_TONES[m.role]}`}
                    >
                      {(Object.keys(ROLE_LABELS) as OrganizationRole[]).map(
                        (r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${ROLE_TONES[m.role]}`}
                    >
                      {m.role === "owner" ? (
                        <Crown size={10} strokeWidth={2} aria-hidden />
                      ) : m.role === "admin" ? (
                        <Shield size={10} strokeWidth={2} aria-hidden />
                      ) : m.role === "publicViewer" ? (
                        <Eye size={10} strokeWidth={2} aria-hidden />
                      ) : null}
                      {ROLE_LABELS[m.role]}
                    </span>
                  )}
                  {canManage && m.userId !== currentUserId ? (
                    <button
                      type="button"
                      onClick={() => removeMember(m.userId, m.user.name)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-500"
                      aria-label="Remove member"
                    >
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <section className="rounded-2xl border border-line-soft bg-bg p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mail size={16} strokeWidth={1.8} className="text-accent" aria-hidden />
              <h2 className="text-lg font-medium text-text-primary">
                Pending invites
              </h2>
            </div>
            <span className="text-xs text-text-tertiary">
              {invites.length} outstanding
            </span>
          </div>
          <ul className="divide-y divide-line-soft">
            {invites.map((i) => (
              <li
                key={i.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {i.email}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    Invited{" "}
                    {i.invitedBy ? `by ${i.invitedBy}` : "by you"} · expires{" "}
                    {new Date(i.expires).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${ROLE_TONES[i.role]}`}
                >
                  {ROLE_LABELS[i.role]}
                </span>
                <button
                  type="button"
                  onClick={() => revoke(i.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Revoke invite"
                >
                  <X size={12} strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
