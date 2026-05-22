"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  Badge,
  Button,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
} from "@klorad/design-system";

interface Member {
  id: string;
  userId: string;
  role: string;
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
  role: string;
  invitedBy: string;
}

interface MembersResponse {
  members: Member[];
  invites: Invite[];
  userRole: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  publicViewer: "Viewer",
};
/** Roles an invite can grant — ownership is transferred, not invited. */
const INVITE_ROLES = ["admin", "member", "publicViewer"];
const ASSIGNABLE_ROLES = ["owner", "admin", "member", "publicViewer"];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Organization members management — lives in the campus Settings tab.
 *
 * Roles map to {@link OrganizationRole}: Owner / Admin / Member /
 * Viewer (`publicViewer`). The backing API enforces the rules (only
 * owners change roles or remove members; owners + admins invite); the
 * UI mirrors them via `userRole`. Email delivery isn't wired yet —
 * an invite returns a shareable link.
 */
export default function MembersPanel({ orgId }: { orgId: string }) {
  const { data, isLoading, mutate } = useSWR<MembersResponse>(
    `/api/organizations/${orgId}/members`,
    fetcher,
  );

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const userRole = data?.userRole;
  const canInvite = userRole === "owner" || userRole === "admin";
  const canManageRoles = userRole === "owner";

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      setEmail("");
      // Show the shareable link only when email delivery didn't happen.
      const emailed = json.emailed === true;
      setInviteUrl(
        emailed || typeof json.inviteUrl !== "string" ? null : json.inviteUrl,
      );
      toast.success(emailed ? "Invitation emailed" : "Invitation created");
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    setBusyId(memberId);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success("Role updated");
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setBusyId(memberId);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Remove failed");
      toast.success("Member removed");
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setBusyId(inviteId);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Cancel failed");
      toast.success("Invitation cancelled");
      void mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <Panel className="rounded-2xl p-6">
        <span className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Loading members…
        </span>
      </Panel>
    );
  }

  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  return (
    <Panel className="space-y-6 rounded-2xl p-6">
      {canInvite ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <Field label="Invite by email">
                <Input
                  type="email"
                  placeholder="teammate@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
            </div>
            <div>
              <Field label="Role">
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
            >
              {inviting ? "Inviting…" : "Send invite"}
            </Button>
          </div>
          {inviteUrl ? (
            <div className="rounded-xl bg-accent-soft p-3 text-xs text-text-secondary">
              <p className="font-medium text-accent">Invite link</p>
              <p className="mt-0.5">
                Email delivery isn&apos;t wired yet — share this link with the
                invitee:
              </p>
              <code className="mt-1.5 block break-all rounded bg-surface-1 px-2 py-1 font-mono text-[0.7rem] text-text-primary">
                {inviteUrl}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
          Members
        </h3>
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {initials(m.user.name || m.user.email || "?")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text-primary">
                  {m.user.name || m.user.email || "Unknown user"}
                </div>
                {m.user.name && m.user.email ? (
                  <div className="truncate text-xs text-text-tertiary">
                    {m.user.email}
                  </div>
                ) : null}
              </div>
              {canManageRoles ? (
                <>
                  <Select
                    value={m.role}
                    disabled={busyId === m.id}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === m.id}
                    onClick={() => handleRemove(m.id)}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Badge tone="neutral">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      {invites.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
            Pending invites
          </h3>
          <ul className="space-y-1.5">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">
                    {inv.email}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    Invited as {ROLE_LABEL[inv.role] ?? inv.role} · pending
                  </div>
                </div>
                {canInvite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === inv.id}
                    onClick={() => handleCancelInvite(inv.id)}
                  >
                    Cancel
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return value.slice(0, 2).toUpperCase();
}
