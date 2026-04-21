"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Button,
} from "@mui/material";
import {
  Page,
  PageHeader,
  PageContent,
  DashboardProjectCard,
  DashboardCreateProjectCard,
  DashboardOptionsMenu,
  DashboardDeleteConfirmationDialog,
  LoadingScreen,
  TextField,
  FormField,
} from "@klorad/ui";
import { useMaps } from "@/app/hooks/useMaps";

interface Props {
  orgId: string;
  userId: string;
}

export default function MapsPageClient({ orgId }: Props) {
  const router = useRouter();
  const { maps, isLoading, createMap, deleteMap } = useMaps(orgId);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuMapId, setMenuMapId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const map = await createMap(newName.trim());
    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    if (map) router.push(`/org/${orgId}/maps/${map.id}/builder`);
  };

  const handleMenuOpen = (e: React.MouseEvent, id: string) => {
    setMenuAnchor(e.currentTarget as HTMLElement);
    setMenuMapId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuMapId(null);
  };

  const handleRequestDelete = () => {
    if (menuMapId) setConfirmDeleteId(menuMapId);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteMap(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Page>
      <PageHeader title="Campus Maps" />
      <PageContent>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            <DashboardCreateProjectCard
              onClick={() => setCreateOpen(true)}
              label="New Map"
              description="Create a new campus map"
            />
          </Grid>
          {maps.map((map) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={map.id}>
              <DashboardProjectCard
                project={{
                  id: map.id,
                  title: map.name,
                  updatedAt: map.updatedAt,
                  createdAt: map.createdAt,
                }}
                onGoToBuilder={(id) => router.push(`/org/${orgId}/maps/${id}/builder`)}
                onMenuOpen={handleMenuOpen}
              />
            </Grid>
          ))}
        </Grid>
      </PageContent>

      <DashboardOptionsMenu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onEdit={() => {
          if (menuMapId) router.push(`/org/${orgId}/maps/${menuMapId}/builder`);
          handleMenuClose();
        }}
        onDelete={handleRequestDelete}
      />

      <DashboardDeleteConfirmationDialog
        open={Boolean(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete map?"
        message="This map and all its POIs will be permanently removed. This cannot be undone."
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Campus Map</DialogTitle>
        <DialogContent>
          <FormField label="Map name" gutterBottom>
            <TextField
              autoFocus
              fullWidth
              placeholder="e.g. Main Campus"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </FormField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
}
