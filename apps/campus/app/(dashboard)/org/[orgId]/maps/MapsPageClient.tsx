"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Grid, Button, Skeleton } from "@mui/material";
import {
  Page,
  PageContent,
  DashboardProjectCard,
  DashboardCreateProjectCard,
  DashboardOptionsMenu,
  DashboardDeleteConfirmationDialog,
  RightDrawer,
  TextField,
  FormField,
} from "@klorad/ui";
import { useMaps } from "@/app/hooks/useMaps";
import LocationsHeader from "./LocationsHeader";

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

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setNewName("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const map = await createMap(newName.trim());
    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    if (map) router.push(`/org/${orgId}/maps/${map.id}`);
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

  const showSkeleton = isLoading && maps.length === 0;

  return (
    <Page>
      <PageContent sx={{ mt: 0 }}>
        <LocationsHeader maps={maps} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4} lg={3}>
            <DashboardCreateProjectCard
              onClick={() => setCreateOpen(true)}
              label="New Map"
              description="Create a new campus map"
            />
          </Grid>
          {showSkeleton
            ? Array.from({ length: 3 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${i}`}>
                  <Skeleton variant="rounded" height={260} />
                </Grid>
              ))
            : maps.map((map) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={map.id}>
                  <DashboardProjectCard
                    project={{
                      id: map.id,
                      title: map.name,
                      updatedAt: map.updatedAt,
                      createdAt: map.createdAt,
                      thumbnail: map.thumbnail ?? undefined,
                    }}
                    onGoToBuilder={(id) => router.push(`/org/${orgId}/maps/${id}`)}
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
          if (menuMapId) router.push(`/org/${orgId}/maps/${menuMapId}`);
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

      <RightDrawer
        open={createOpen}
        onClose={closeCreate}
        title="New Campus Map"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={closeCreate}
              disabled={creating}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              {creating ? "Creating…" : "Create map"}
            </Button>
          </>
        }
      >
        <FormField label="Map name" gutterBottom>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Main Campus"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </FormField>
      </RightDrawer>
    </Page>
  );
}
