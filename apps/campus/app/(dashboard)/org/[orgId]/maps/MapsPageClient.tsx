"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const map = await createMap(newName.trim());
    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    if (map) router.push(`/org/${orgId}/maps/${map.id}/builder`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          Campus Maps
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
          size="small"
        >
          New Map
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : maps.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pt: 10,
            gap: 2,
            color: "text.secondary",
          }}
        >
          <MapIcon sx={{ fontSize: 56, opacity: 0.3 }} />
          <Typography variant="body1">No maps yet</Typography>
          <Button variant="outlined" size="small" onClick={() => setCreateOpen(true)}>
            Create your first map
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {maps.map((map) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={map.id}>
              <Card
                sx={{
                  bgcolor: "#14171a",
                  border: "1px solid rgba(255,255,255,0.06)",
                  "&:hover": { borderColor: "rgba(59,130,246,0.35)" },
                  transition: "border-color 0.2s",
                  position: "relative",
                }}
              >
                <CardActionArea
                  onClick={() => router.push(`/org/${orgId}/maps/${map.id}/builder`)}
                >
                  <Box
                    sx={{
                      height: 120,
                      bgcolor: "#1a1f26",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MapIcon sx={{ fontSize: 40, color: "rgba(59,130,246,0.5)" }} />
                  </Box>
                  <CardContent sx={{ pb: "12px !important" }}>
                    <Typography variant="subtitle2" fontWeight={600} noWrap>
                      {map.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(map.updatedAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </CardActionArea>
                <Tooltip title="Delete map">
                  <IconButton
                    size="small"
                    sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,0.4)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMap(map.id);
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Campus Map</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Map name"
            placeholder="e.g. Main Campus"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            sx={{ mt: 1 }}
          />
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
    </Box>
  );
}
