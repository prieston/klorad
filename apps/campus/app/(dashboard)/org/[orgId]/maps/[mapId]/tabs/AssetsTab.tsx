"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { toast } from "react-toastify";
import { PageCard, PageSection, TextField, FormField, Select } from "@klorad/ui";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, FloorPlan, POI } from "@klorad/api";

interface Props {
  orgId: string;
  mapId: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CampusMap {
  id: string;
  sceneData?: unknown;
}

export default function AssetsTab({ orgId: _orgId, mapId }: Props) {
  const { data: map } = useSWR<CampusMap>(`/api/maps/${mapId}`, fetcher);

  // Reconstruct the scene in a detached API so we can read floorPlans + POIs.
  // This is read/mutate locally — we POST the full sceneData back on save below.
  const { apiRef, pois, plans } = useMemo(() => {
    const api = createSceneAPI("mapbox", "campus") as CampusAPI;
    const scene = map?.sceneData as Partial<Parameters<typeof api.load>[0]> | undefined;
    if (scene && Object.keys(scene).length > 0) api.load(scene);
    return {
      apiRef: api,
      pois: api.poi.getAll(),
      plans: api.floorPlans.getAll(),
    };
  }, [map]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    url: "",
    buildingPoiId: "",
    floor: 0,
    widthMeters: 60,
    heightMeters: 40,
  });

  const linkedPois = pois.filter((p) => p.linkedBuilding);

  const persist = async () => {
    const sceneData = apiRef.export();
    await fetch(`/api/maps/${mapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneData }),
    });
    await mutate(`/api/maps/${mapId}`);
  };

  const handleAdd = async () => {
    const building = pois.find((p) => p.id === form.buildingPoiId);
    const lng = building?.linkedBuilding?.lng ?? building?.position[0];
    const lat = building?.linkedBuilding?.lat ?? building?.position[1];
    if (typeof lng !== "number" || typeof lat !== "number" || !form.url) {
      toast.error("Pick a linked building and provide an image URL.");
      return;
    }
    const coords = buildCornerBounds(lng, lat, form.widthMeters, form.heightMeters);
    apiRef.floorPlans.add({
      name: form.name || `Floor ${form.floor}`,
      url: form.url,
      buildingId: form.buildingPoiId,
      floor: form.floor,
      coordinates: coords,
    });
    await persist();
    setDialogOpen(false);
    setForm({ name: "", url: "", buildingPoiId: "", floor: 0, widthMeters: 60, heightMeters: 40 });
    toast.success("Floor plan added");
  };

  const handleRemove = async (id: string) => {
    apiRef.floorPlans.remove(id);
    await persist();
    toast.success("Floor plan removed");
  };

  const handleToggleVisible = async (plan: FloorPlan) => {
    apiRef.floorPlans.setVisible(plan.id, plan.visible === false);
    await persist();
  };

  // Group plans by building for display.
  const groupedPlans = useMemo(() => {
    const map = new Map<string, { buildingPoi: POI | null; plans: FloorPlan[] }>();
    for (const plan of plans) {
      const key = plan.buildingId ?? "unassigned";
      if (!map.has(key)) {
        const buildingPoi = plan.buildingId
          ? pois.find((p) => p.id === plan.buildingId) ?? null
          : null;
        map.set(key, { buildingPoi, plans: [] });
      }
      map.get(key)!.plans.push(plan);
    }
    for (const group of map.values()) {
      group.plans.sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0));
    }
    return Array.from(map.values());
  }, [plans, pois]);

  return (
    <Stack spacing={4} sx={{ mt: 3 }}>
      <PageSection title="Floor Plans" spacing="tight">
        <PageCard>
          <Stack spacing={2}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                Upload floor-plan images and anchor them to a building. Visitors
                will reveal them when diving into a building on the public viewer.
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
                disabled={linkedPois.length === 0}
                sx={{ textTransform: "none" }}
              >
                Add Floor Plan
              </Button>
            </Box>

            {linkedPois.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Link at least one POI to a Mapbox building first (in the
                Studio). Floor plans attach to linked buildings.
              </Typography>
            )}

            {groupedPlans.length === 0 ? (
              <EmptyBlock
                title="No floor plans yet"
                description="Add your first floor plan to unlock the Level Switcher in the public viewer."
              />
            ) : (
              groupedPlans.map((group) => (
                <Box
                  key={group.buildingPoi?.id ?? "unassigned"}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    {group.buildingPoi?.name ?? "Unassigned"}
                    {group.buildingPoi && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({group.plans.length} floor{group.plans.length === 1 ? "" : "s"})
                      </Typography>
                    )}
                  </Typography>
                  <Stack spacing={1}>
                    {group.plans.map((p) => (
                      <Box
                        key={p.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.5,
                          py: 0.75,
                        }}
                      >
                        <Chip
                          size="small"
                          label={p.floor === 0 ? "Γ" : String(p.floor ?? "?")}
                          sx={{ fontWeight: 600, minWidth: 36 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>
                            {p.name ?? `Floor ${p.floor}`}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}
                          >
                            {p.url}
                          </Typography>
                        </Box>
                        <Tooltip title={p.visible === false ? "Show" : "Hide"}>
                          <IconButton size="small" onClick={() => handleToggleVisible(p)}>
                            {p.visible === false ? (
                              <VisibilityOffIcon fontSize="small" />
                            ) : (
                              <VisibilityIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleRemove(p.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </PageCard>
      </PageSection>

      <PageSection title="360° Photos" spacing="tight">
        <PageCard>
          <Typography variant="body2" color="text.secondary">
            360° virtual tours are available as an add-on. Contact us to enable
            production support.
          </Typography>
        </PageCard>
      </PageSection>

      <PageSection title="Media Library" spacing="tight">
        <PageCard>
          <EmptyBlock
            title="No media yet"
            description="POI images, documents, and videos live here. Drag files or upload to attach them to any POI."
          />
        </PageCard>
      </PageSection>

      {/* Add dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Floor Plan</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormField label="Building">
              <Select
                size="small"
                fullWidth
                value={form.buildingPoiId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, buildingPoiId: e.target.value as string }))
                }
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Pick a linked-building POI…
                </MenuItem>
                {linkedPois.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormField>
            <Stack direction="row" spacing={2}>
              <FormField label="Floor" sx={{ flex: 1 }}>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: parseInt(e.target.value) || 0 }))}
                  slotProps={{ htmlInput: { step: 1 } }}
                />
              </FormField>
              <FormField label="Display name" sx={{ flex: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. Ground floor"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>
            </Stack>
            <FormField
              label="Image URL"
              helperText="Public URL to a PNG or JPG. Tip: upload to your CDN / Cloudinary and paste the URL."
            >
              <TextField
                size="small"
                fullWidth
                placeholder="https://…/floor-2.png"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </FormField>
            <Stack direction="row" spacing={2}>
              <FormField label="Width (m)" sx={{ flex: 1 }}>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={form.widthMeters}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, widthMeters: parseInt(e.target.value) || 60 }))
                  }
                  slotProps={{ htmlInput: { step: 5, min: 10 } }}
                />
              </FormField>
              <FormField label="Height (m)" sx={{ flex: 1 }}>
                <TextField
                  type="number"
                  size="small"
                  fullWidth
                  value={form.heightMeters}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, heightMeters: parseInt(e.target.value) || 40 }))
                  }
                  slotProps={{ htmlInput: { step: 5, min: 10 } }}
                />
              </FormField>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              The plan is placed centered on the linked building with the
              dimensions above. Fine-tune georeferencing later via drag-corners
              (coming in Phase 2).
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!form.url || !form.buildingPoiId}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 40, color: "text.secondary", opacity: 0.4 }} />
      <Typography variant="subtitle2" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
        {description}
      </Typography>
    </Box>
  );
}

/**
 * Given a center lng/lat and a width/height in meters, compute the four
 * image corners (TL, TR, BR, BL) in [lng, lat]. Uses a simple equirectangular
 * approximation — good enough for a single building at a fixed location.
 */
function buildCornerBounds(
  lng: number,
  lat: number,
  widthMeters: number,
  heightMeters: number
): [[number, number], [number, number], [number, number], [number, number]] {
  const METERS_PER_DEG_LAT = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const dLng = widthMeters / 2 / metersPerDegLng;
  const dLat = heightMeters / 2 / METERS_PER_DEG_LAT;
  return [
    [lng - dLng, lat + dLat], // TL
    [lng + dLng, lat + dLat], // TR
    [lng + dLng, lat - dLat], // BR
    [lng - dLng, lat - dLat], // BL
  ];
}
