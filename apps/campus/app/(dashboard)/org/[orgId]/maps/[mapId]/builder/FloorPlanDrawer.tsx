"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ImageIcon from "@mui/icons-material/Image";
import { toast } from "react-toastify";
import { FormField, RightDrawer, Select, TextField } from "@klorad/ui";
import { uploadFile } from "@klorad/storage/client";
import type { FloorPlan, POI } from "@klorad/api";

export interface FloorPlanFormValue {
  /** Empty string when creating a new plan. */
  id: string;
  name: string;
  url: string;
  buildingPoiId: string;
  floor: number;
  widthMeters: number;
  heightMeters: number;
}

const EMPTY: FloorPlanFormValue = {
  id: "",
  name: "",
  url: "",
  buildingPoiId: "",
  floor: 0,
  widthMeters: 60,
  heightMeters: 40,
};

interface Props {
  open: boolean;
  /** When set, the drawer is in edit mode and prefilled. */
  editingPlan: FloorPlan | null;
  /** When creating, the building defaults to this id (and is locked when set). */
  defaultBuildingPoiId?: string | null;
  /** POIs that are linked to a Mapbox building — the only valid attach points. */
  linkedPois: POI[];
  onClose: () => void;
  onSave: (value: FloorPlanFormValue) => Promise<void> | void;
  onDelete?: (planId: string) => Promise<void> | void;
}

export default function FloorPlanDrawer({
  open,
  editingPlan,
  defaultBuildingPoiId,
  linkedPois,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [form, setForm] = useState<FloorPlanFormValue>(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset / prefill whenever the drawer opens
  useEffect(() => {
    if (!open) return;
    if (editingPlan) {
      // `coordinates` may be undefined for floors without an uploaded
      // image — fall back to sensible defaults the user can still tweak.
      const { widthMeters, heightMeters } = editingPlan.coordinates
        ? sizeFromCorners(editingPlan.coordinates)
        : { widthMeters: 60, heightMeters: 40 };
      setForm({
        id: editingPlan.id,
        name: editingPlan.name ?? "",
        url: editingPlan.url ?? "",
        buildingPoiId: editingPlan.buildingId ?? "",
        floor: editingPlan.floor ?? 0,
        widthMeters,
        heightMeters,
      });
    } else {
      setForm({
        ...EMPTY,
        buildingPoiId: defaultBuildingPoiId ?? "",
      });
    }
    setUploading(false);
    setUploadProgress(0);
  }, [open, editingPlan, defaultBuildingPoiId]);

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

  const handleSave = async () => {
    if (!form.buildingPoiId) {
      toast.error("Pick a linked building.");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPlan || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(editingPlan.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const close = () => {
    if (uploading || saving || deleting) return;
    onClose();
  };

  return (
    <RightDrawer
      open={open}
      onClose={close}
      title={editingPlan ? "Edit Floor Plan" : "Add Floor Plan"}
      actions={
        <>
          <Button
            variant="outlined"
            onClick={close}
            disabled={uploading || saving || deleting}
            fullWidth
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.buildingPoiId || uploading || saving || deleting}
            fullWidth
            sx={{ textTransform: "none" }}
          >
            {saving ? (
              <CircularProgress size={16} />
            ) : editingPlan ? (
              "Save changes"
            ) : (
              "Add floor plan"
            )}
          </Button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleUpload(file);
        }}
      />

      <FormField label="Building">
        <Select
          size="small"
          fullWidth
          value={form.buildingPoiId}
          onChange={(e) =>
            setForm((f) => ({ ...f, buildingPoiId: e.target.value as string }))
          }
          // Lock the building when we opened in "Add for this building" mode
          // and the user hasn't switched it.
          disabled={!editingPlan && Boolean(defaultBuildingPoiId)}
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
            onChange={(e) =>
              setForm((f) => ({ ...f, floor: parseInt(e.target.value) || 0 }))
            }
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
        dimensions above. Save the map to persist.
      </Typography>

      {editingPlan && onDelete && (
        <Button
          variant="outlined"
          color="error"
          onClick={handleDelete}
          disabled={deleting || saving}
          sx={{ textTransform: "none", alignSelf: "flex-start", mt: 1 }}
        >
          {deleting ? <CircularProgress size={14} /> : "Delete floor"}
        </Button>
      )}
    </RightDrawer>
  );
}

function sizeFromCorners(
  coords: [[number, number], [number, number], [number, number], [number, number]]
): { widthMeters: number; heightMeters: number } {
  const [tl, tr, , bl] = coords;
  const METERS_PER_DEG_LAT = 111_320;
  const centerLat = (tl[1] + bl[1]) / 2;
  const metersPerDegLng = 111_320 * Math.cos((centerLat * Math.PI) / 180);
  const widthMeters = Math.round(Math.abs(tr[0] - tl[0]) * metersPerDegLng);
  const heightMeters = Math.round(Math.abs(tl[1] - bl[1]) * METERS_PER_DEG_LAT);
  return { widthMeters, heightMeters };
}

/**
 * Given a centre lng/lat and a width/height in meters, compute the four
 * image corners (TL, TR, BR, BL) in [lng, lat]. Equirectangular
 * approximation — accurate enough for a single building footprint.
 */
export function buildCornerBounds(
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
    [lng - dLng, lat + dLat],
    [lng + dLng, lat + dLat],
    [lng + dLng, lat - dLat],
    [lng - dLng, lat - dLat],
  ];
}
