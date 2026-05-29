"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Avatar,
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  Panel,
  Select,
  Spinner,
} from "@klorad/design-system";
import { showToast } from "@klorad/ui";
import { Copy, Trash2, UserPlus, X } from "lucide-react";
import { useOrganization } from "@/app/hooks/useOrganizations";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expires: string;
  createdAt: string;
  invitedBy: string;
}

interface MembersData {
  members: Member[];
  invites: Invite[];
  userRole: string;
}

export default function SettingsMembersPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const { data: session } = useSession();
  const { organization, loadingOrganization } = useOrganization(orgId);
  const isPersonalOrg = organization?.isPersonal ?? false;

  const { data, error, isLoading, mutate } = useSWR<MembersData>(
    orgId && organization && !isPersonalOrg
      ? `/api/organizations/${orgId}/members`
      : null,
  );

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  const [inviteUrlOpen, setInviteUrlOpen] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [inviteToCancel, setInviteToCancel] = useState<Invite | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const isOwner = data?.userRole === "owner";
  const canInvite = isOwner || data?.userRole === "admin";

  const handleInvite = async () => {
    if (!inviteEmail || !orgId) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send invitation");
      showToast("Invitation created", "success");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      if (typeof result.inviteUrl === "string") {
        setLastInviteUrl(result.inviteUrl);
        setInviteUrlOpen(true);
      }
      mutate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to invite", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!orgId) return;
    setUpdatingRole(memberId);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update role");
      showToast("Member role updated", "success");
      mutate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update", "error");
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove || !orgId) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: memberToRemove.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to remove member");
      showToast("Member removed", "success");
      setRemoveOpen(false);
      setMemberToRemove(null);
      mutate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to remove", "error");
    } finally {
      setRemoving(false);
    }
  };

  const handleCancelInvite = async () => {
    if (!inviteToCancel || !orgId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/invites`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: inviteToCancel.id }),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to cancel invitation");
      showToast("Invitation cancelled", "success");
      setCancelOpen(false);
      setInviteToCancel(null);
      mutate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to cancel", "error");
    } finally {
      setCancelling(false);
    }
  };

  const formatRole = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1);

  if (loadingOrganization || (!isPersonalOrg && isLoading && !data)) {
    return (
      <div className="flex w-full justify-center px-6 py-20">
        <Spinner />
      </div>
    );
  }

  if (!isPersonalOrg && error) {
    return (
      <div className="w-full px-6 py-8 md:px-10">
        <Panel className="rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
          Failed to load members
        </Panel>
      </div>
    );
  }

  if (isPersonalOrg) {
    return (
      <div className="w-full px-6 py-8 md:px-10">
        <Panel className="rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Personal organizations don&apos;t have members
          </h2>
          <p className="mt-2 max-w-prose text-sm text-text-secondary">
            Personal organizations are for individual use only. To collaborate
            with teammates, ask support to upgrade this workspace to an
            organization.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-6 py-8 md:px-10">
        <PageHeader
          eyebrow="Organisation"
          title="Team"
          subtitle="Who can author this organisation's campuses, and a log of what changed."
          actions={
            canInvite ? (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus size={14} strokeWidth={1.75} aria-hidden />
                Invite member
              </Button>
            ) : null
          }
        />
        <Panel className="rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-text-primary">
            Organization members
          </h2>

          {!data ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : data.members.length === 0 && data.invites.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-text-primary">
                No members yet
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {canInvite
                  ? "Invite your first team member to get started"
                  : "No members in this organization"}
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-xs uppercase tracking-[0.14em] text-text-tertiary">
                    <th className="px-3 py-2 text-left font-medium">Member</th>
                    <th className="px-3 py-2 text-left font-medium">Role</th>
                    <th className="px-3 py-2 text-left font-medium">Joined</th>
                    {isOwner && (
                      <th className="px-3 py-2 text-right font-medium">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => {
                    const editable =
                      isOwner && member.userId !== session?.user?.id;
                    return (
                      <tr
                        key={member.id}
                        className="border-b border-line-soft last:border-0"
                      >
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={member.user.image}
                              name={member.user.name || member.user.email}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-text-primary">
                                {member.user.name || member.user.email}
                              </div>
                              {member.user.name && (
                                <div className="truncate text-xs text-text-secondary">
                                  {member.user.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          {editable ? (
                            <Select
                              className="w-32"
                              value={member.role}
                              disabled={updatingRole === member.id}
                              onChange={(e) =>
                                handleUpdateRole(member.id, e.target.value)
                              }
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                              <option value="owner">Owner</option>
                            </Select>
                          ) : (
                            <Badge tone="accent">
                              {formatRole(member.role)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle text-text-secondary">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                        {isOwner && (
                          <td className="px-3 py-3 text-right align-middle">
                            {member.userId !== session?.user?.id && (
                              <button
                                type="button"
                                aria-label="Remove member"
                                onClick={() => {
                                  setMemberToRemove(member);
                                  setRemoveOpen(true);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-600"
                              >
                                <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {data.invites.map((invite) => (
                    <tr
                      key={invite.id}
                      className="border-b border-line-soft last:border-0"
                    >
                      <td className="px-3 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <Avatar name={invite.email} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-text-primary">
                              {invite.email}
                            </div>
                            <div className="truncate text-xs text-text-secondary">
                              Pending invitation
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <Badge tone="warning">{formatRole(invite.role)}</Badge>
                      </td>
                      <td className="px-3 py-3 align-middle text-text-secondary">
                        Invited{" "}
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </td>
                      {isOwner && (
                        <td className="px-3 py-3 text-right align-middle">
                          <button
                            type="button"
                            aria-label="Cancel invitation"
                            disabled={cancelling}
                            onClick={() => {
                              setInviteToCancel(invite);
                              setCancelOpen(true);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                          >
                            <X size={14} strokeWidth={1.75} aria-hidden />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => !inviting && setInviteOpen(false)}
        title="Invite member"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || inviting}
            >
              {inviting ? "Sending…" : "Send invitation"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Email address *">
            <Input
              autoFocus
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Field>
          <Field label="Role *">
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {isOwner && <option value="owner">Owner</option>}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={inviteUrlOpen}
        onClose={() => setInviteUrlOpen(false)}
        title="Share invitation link"
        description="Email delivery is not yet wired on Klorad Campus. Copy this link and send it to the invitee. It expires in 7 days."
        footer={
          <Button onClick={() => setInviteUrlOpen(false)}>Done</Button>
        }
      >
        <div className="flex items-center gap-2">
          <Input readOnly value={lastInviteUrl ?? ""} className="flex-1" />
          <IconButton
            variant="secondary"
            aria-label="Copy link"
            onClick={() => {
              if (lastInviteUrl) {
                navigator.clipboard.writeText(lastInviteUrl).then(
                  () => showToast("Copied to clipboard", "success"),
                  () => showToast("Copy failed", "error"),
                );
              }
            }}
          >
            <Copy size={14} strokeWidth={1.75} aria-hidden />
          </IconButton>
        </div>
      </Modal>

      <Modal
        open={removeOpen}
        onClose={() => !removing && setRemoveOpen(false)}
        title="Remove member"
        description={
          <>
            Remove{" "}
            <strong className="text-text-primary">
              {memberToRemove?.user.name || memberToRemove?.user.email}
            </strong>{" "}
            from this organization? This cannot be undone.
          </>
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRemoveOpen(false)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove member"}
            </Button>
          </>
        }
      />

      <Modal
        open={cancelOpen}
        onClose={() => !cancelling && setCancelOpen(false)}
        title="Cancel invitation"
        description={
          <>
            Cancel the invitation sent to{" "}
            <strong className="text-text-primary">
              {inviteToCancel?.email}
            </strong>
            ? This cannot be undone.
          </>
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep invitation
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelInvite}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel invitation"}
            </Button>
          </>
        }
      />
    </>
  );
}
