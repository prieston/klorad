"use client";

import { useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
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
import ImageIcon from "@mui/icons-material/Image";
import { toast } from "react-toastify";
import { PageCard, PageSection, RightDrawer, TextField, FormField, Select } from "@klorad/ui";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, FloorPlan, POI } from "@klorad/api";
import { uploadFile } from "@klorad/storage/client";

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setForm({
      name: "",
      url: "",
      buildingPoiId: "",
      floor: 0,
      widthMeters: 60,
      heightMeters: 40,
    });
    setUploading(false);
    setUploadProgress(0);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const { publicUrl } = await uploadFile(
        file,
        { prefix: "floor-plans" },
        { onProgress: (p) => setUploadProgress(p) }
      );
      setForm((f) => ({
        ...f,
        url: publicUrl,
        name: f.name || file.name.replace(/\.[^.]+$/, ""),
      }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
      toast.error("Pick a linked building and upload an image.");
      return;
    }
    setSaving(true);
    try {
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
      resetForm();
      toast.success("Floor plan added");
    } finally {
      setSaving(false);
    }
  };

  const closeDialog = () => {
    if (uploading || saving) return;
    setDialogOpen(false);
    resetForm();
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

      {/* Hidden file input — triggered by the upload button inside the drawer. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset the input so the same file can be re-picked after an error.
          e.target.value = "";
          if (file) void handleUpload(file);
        }}
      />

      <RightDrawer
        open={dialogOpen}
        onClose={closeDialog}
        title="Add Floor Plan"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={closeDialog}
              disabled={uploading || saving}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={!form.url || !form.buildingPoiId || uploading || saving}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              {saving ? <CircularProgress size={16} /> : "Add floor plan"}
            </Button>
          </>
        }
      >
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
          label="Floor plan image"
          helperText="PNG, JPG, or WebP. Uploads straight to the Klorad storage bucket."
        >
          {form.url ? (
            <Box
              sx={(t) => ({
                position: "relative",
                borderRadius: 1,
                overflow: "hidden",
                border: `1px solid ${t.palette.divider}`,
                aspectRatio: "16 / 10",
              })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.url}
                alt="Floor plan preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <Button
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                sx={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  textTransform: "none",
                  bgcolor: "rgba(15,23,42,0.75)",
                  color: "#fff",
                  "&:hover": { bgcolor: "rgba(15,23,42,0.9)" },
                }}
              >
                Replace
              </Button>
            </Box>
          ) : uploading ? (
            <Stack spacing={1}>
              <Box
                sx={(t) => ({
                  borderRadius: 1,
                  border: `1px dashed ${t.palette.divider}`,
                  aspectRatio: "16 / 10",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 1,
                  bgcolor: "action.hover",
                })}
              >
                <ImageIcon sx={{ color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">
                  Uploading… {Math.round(uploadProgress)}%
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Stack>
          ) : (
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                textTransform: "none",
                justifyContent: "flex-start",
                py: 2,
                borderStyle: "dashed",
              }}
              fullWidth
            >
              Choose an image to upload
            </Button>
          )}
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
      </RightDrawer>
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
