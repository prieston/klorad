"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import {
  MenuItem,
  Page,
  PageCard,
  PageContent,
  RightDrawer,
  Select,
  SettingContainer,
  SettingLabel,
  TextField,
  showToast,
} from "@klorad/ui";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useOrganization } from "@/app/hooks/useOrganizations";

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
      : null
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
      if (!res.ok) throw new Error(result.error || "Failed to cancel invitation");
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

  const formatRole = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

  if (loadingOrganization || (!isPersonalOrg && isLoading && !data)) {
    return (
      <Page>
        <PageContent sx={{ mt: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress />
          </Box>
        </PageContent>
      </Page>
    );
  }

  if (!isPersonalOrg && error) {
    return (
      <Page>
        <PageContent sx={{ mt: 0 }}>
          <Alert severity="error">Failed to load members</Alert>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <PageContent sx={{ mt: 0 }} maxWidth="6xl">
        {isPersonalOrg ? (
          <PageCard>
            <Alert severity="info">
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                Personal organizations don&apos;t have members
              </Typography>
              <Typography variant="body2">
                Personal organizations are for individual use only. To
                collaborate with teammates, ask support to upgrade this
                workspace to an organization.
              </Typography>
            </Alert>
          </PageCard>
        ) : (
          <>
            <Box
              sx={(theme) => ({
                display: "flex",
                gap: 2,
                mb: 3,
                pb: 3,
                alignItems: "center",
                justifyContent: "flex-end",
                borderBottom: `1px solid ${theme.palette.divider}`,
              })}
            >
              {canInvite && (
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={() => setInviteOpen(true)}
                  size="small"
                  sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 500 }}
                >
                  Invite Member
                </Button>
              )}
            </Box>

            <PageCard>
              <Typography
                variant="h6"
                sx={{ mb: 3, fontWeight: 600, fontSize: "1rem" }}
              >
                Organization Members
              </Typography>

              {!data ? (
                <Box sx={{ textAlign: "center", py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : data.members.length === 0 && data.invites.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No members yet
                  </Typography>
                  <Typography variant="body2">
                    {canInvite
                      ? "Invite your first team member to get started"
                      : "No members in this organization"}
                  </Typography>
                </Box>
              ) : (
                <TableContainer
                  component={Box}
                  sx={{ backgroundColor: "transparent", boxShadow: "none" }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                          Member
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                          Role
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                          Joined
                        </TableCell>
                        {isOwner && (
                          <TableCell
                            align="right"
                            sx={{ fontSize: "0.75rem", fontWeight: 600 }}
                          >
                            Actions
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.members.map((member) => (
                        <TableRow key={member.id} hover sx={{ "& td": { borderBottom: "none" } }}>
                          <TableCell sx={{ fontSize: "0.75rem" }}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar
                                src={member.user.image || undefined}
                                sx={{ width: 32, height: 32, fontSize: "0.875rem" }}
                              >
                                {(member.user.name || member.user.email)
                                  ?.charAt(0)
                                  .toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
                                  {member.user.name || member.user.email}
                                </Typography>
                                {member.user.name && (
                                  <Typography
                                    sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                                  >
                                    {member.user.email}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem" }}>
                            {isOwner && member.userId !== session?.user?.id ? (
                              <Select
                                value={member.role}
                                onChange={(e) =>
                                  handleUpdateRole(member.id, e.target.value as string)
                                }
                                size="small"
                                disabled={updatingRole === member.id}
                                sx={(theme) => ({
                                  minWidth: 100,
                                  fontSize: "0.75rem",
                                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                                  color: theme.palette.primary.main,
                                })}
                              >
                                <MenuItem value="member">Member</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                                <MenuItem value="owner">Owner</MenuItem>
                              </Select>
                            ) : (
                              <Chip
                                label={formatRole(member.role)}
                                size="small"
                                sx={(theme) => ({
                                  fontSize: "0.75rem",
                                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                                  color: theme.palette.primary.main,
                                  border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                })}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                            {new Date(member.createdAt).toLocaleDateString()}
                          </TableCell>
                          {isOwner && (
                            <TableCell align="right">
                              {member.userId !== session?.user?.id && (
                                <Tooltip title="Remove member">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setMemberToRemove(member);
                                      setRemoveOpen(true);
                                    }}
                                    sx={{ color: "error.main" }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {data.invites.map((invite) => (
                        <TableRow key={invite.id} hover sx={{ "& td": { borderBottom: "none" } }}>
                          <TableCell sx={{ fontSize: "0.75rem" }}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar
                                sx={(theme) => ({
                                  width: 32,
                                  height: 32,
                                  fontSize: "0.875rem",
                                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                                  color: theme.palette.primary.main,
                                })}
                              >
                                {invite.email.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
                                  {invite.email}
                                </Typography>
                                <Typography
                                  sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                                >
                                  Pending invitation
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem" }}>
                            <Chip
                              label={formatRole(invite.role)}
                              size="small"
                              sx={(theme) => ({
                                fontSize: "0.75rem",
                                backgroundColor: alpha(theme.palette.primary.main, 0.15),
                                color: theme.palette.primary.main,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                              })}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                            Invited {new Date(invite.createdAt).toLocaleDateString()}
                          </TableCell>
                          {isOwner && (
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                                <Chip
                                  label="Pending"
                                  size="small"
                                  sx={(theme) => ({
                                    fontSize: "0.75rem",
                                    backgroundColor: alpha(theme.palette.warning.main, 0.15),
                                    color: theme.palette.warning.main,
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                                  })}
                                />
                                <Tooltip title="Cancel invitation">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setInviteToCancel(invite);
                                      setCancelOpen(true);
                                    }}
                                    disabled={cancelling}
                                    sx={{ color: "error.main" }}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </PageCard>
          </>
        )}
      </PageContent>

      {/* Invite drawer */}
      <RightDrawer
        open={inviteOpen}
        onClose={() => {
          if (inviting) return;
          setInviteOpen(false);
        }}
        title="Invite Member"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleInvite}
              disabled={!inviteEmail || inviting}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              {inviting ? <CircularProgress size={16} /> : "Send invitation"}
            </Button>
          </>
        }
      >
        <SettingContainer sx={{ borderBottom: "none", padding: 0 }}>
          <SettingLabel>Email Address *</SettingLabel>
          <TextField
            autoFocus
            type="email"
            fullWidth
            size="small"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </SettingContainer>
        <SettingContainer sx={{ borderBottom: "none", padding: 0 }}>
          <SettingLabel>Role *</SettingLabel>
          <Select
            fullWidth
            size="small"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as string)}
          >
            <MenuItem value="member">Member</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            {isOwner && <MenuItem value="owner">Owner</MenuItem>}
          </Select>
        </SettingContainer>
      </RightDrawer>

      {/* Invite URL share drawer */}
      <RightDrawer
        open={inviteUrlOpen}
        onClose={() => setInviteUrlOpen(false)}
        title="Share invitation link"
        actions={
          <Button
            variant="contained"
            onClick={() => setInviteUrlOpen(false)}
            fullWidth
            sx={{ textTransform: "none" }}
          >
            Done
          </Button>
        }
      >
        <Typography variant="body2" color="text.secondary">
          Email delivery is not yet wired on Klorad Campus. Copy this link
          and send it to the invitee. It expires in 7 days.
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            value={lastInviteUrl ?? ""}
            InputProps={{ readOnly: true }}
          />
          <IconButton
            onClick={() => {
              if (lastInviteUrl) {
                navigator.clipboard.writeText(lastInviteUrl).then(
                  () => showToast("Copied to clipboard", "success"),
                  () => showToast("Copy failed", "error")
                );
              }
            }}
            sx={{ color: "primary.main" }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Stack>
      </RightDrawer>

      {/* Remove confirm dialog */}
      <Dialog open={removeOpen} onClose={() => setRemoveOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Remove Member
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Are you sure you want to remove{" "}
            <strong>{memberToRemove?.user.name || memberToRemove?.user.email}</strong>{" "}
            from this organization? This action cannot be undone.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={() => setRemoveOpen(false)}
              disabled={removing}
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleRemove}
              disabled={removing}
              sx={{ textTransform: "none" }}
            >
              {removing ? <CircularProgress size={16} /> : "Remove"}
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Cancel invite dialog */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Cancel Invitation
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Are you sure you want to cancel the invitation sent to{" "}
            <strong>{inviteToCancel?.email}</strong>? This action cannot be undone.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
              sx={{ textTransform: "none" }}
            >
              Keep invitation
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleCancelInvite}
              disabled={cancelling}
              sx={{ textTransform: "none" }}
            >
              {cancelling ? <CircularProgress size={16} /> : "Cancel invitation"}
            </Button>
          </Stack>
        </Box>
      </Dialog>
    </Page>
  );
}
