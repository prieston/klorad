"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  Stack,
  MenuItem,
  FormControlLabel,
  Switch,
  Slider,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { ExpandMoreIcon } from "@klorad/ui";
import { useSceneStore } from "@klorad/core";
import type {
  MapboxSceneLayer,
  MapboxFloorPlanRaster,
  MapboxStandardBasemapConfig,
} from "@klorad/core";
import {
  textFieldStyles,
  SettingContainer,
  SettingLabel,
  LocationSearch,
} from "@klorad/ui";
import type { Map as MapboxGLMap } from "mapbox-gl";

const STYLE_PRESETS: { label: string; value: string }[] = [
  { label: "Mapbox Standard", value: "mapbox://styles/mapbox/standard" },
  { label: "Standard Satellite", value: "mapbox://styles/mapbox/standard-satellite" },
  { label: "Streets", value: "mapbox://styles/mapbox/streets-v12" },
  { label: "Outdoors", value: "mapbox://styles/mapbox/outdoors-v12" },
  { label: "Light", value: "mapbox://styles/mapbox/light-v11" },
  { label: "Dark", value: "mapbox://styles/mapbox/dark-v11" },
  { label: "Satellite", value: "mapbox://styles/mapbox/satellite-v9" },
  {
    label: "Satellite Streets",
    value: "mapbox://styles/mapbox/satellite-streets-v12",
  },
];

const LAYER_TYPES: MapboxSceneLayer["type"][] = [
  "geojson-fill",
  "geojson-line",
  "geojson-circle",
  "fill-extrusion",
];

function sectionTitle(text: string) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
      {text}
    </Typography>
  );
}

/**
 * Mapbox environment: style, projection, terrain, fog, Standard lighting/3D/labels, camera, campus layers.
 */
export default function MapboxEnvironmentSection() {
  const mapboxSceneData = useSceneStore((s) => s.mapboxSceneData);
  const setMapboxSceneData = useSceneStore((s) => s.setMapboxSceneData);
  const mapboxMap = useSceneStore((s) => s.mapboxMap) as MapboxGLMap | null;

  const std = mapboxSceneData.standardBasemap ?? {};
  const terrain = mapboxSceneData.terrain ?? { enabled: false, exaggeration: 1.2 };
  const fog = mapboxSceneData.fog ?? { enabled: true };

  const patchStd = useCallback(
    (p: Partial<MapboxStandardBasemapConfig>) => {
      setMapboxSceneData({ standardBasemap: { ...std, ...p } });
    },
    [setMapboxSceneData, std]
  );

  const handlePlaceSelect = useCallback(
    (latitude: number, longitude: number) => {
      const nextCenter: [number, number] = [longitude, latitude];
      const zoom = Math.max(mapboxSceneData.zoom, 15);
      const syncStore = () => {
        setMapboxSceneData({ center: nextCenter, zoom });
      };
      if (mapboxMap && typeof mapboxMap.flyTo === "function") {
        try {
          if (mapboxMap.isStyleLoaded()) {
            mapboxMap.flyTo({
              center: nextCenter,
              zoom,
              duration: 1800,
              essential: true,
            });
            const onEnd = () => {
              mapboxMap.off("moveend", onEnd);
              syncStore();
            };
            mapboxMap.once("moveend", onEnd);
            return;
          }
        } catch {
          /* fall through */
        }
      }
      syncStore();
    },
    [mapboxMap, mapboxSceneData.zoom, setMapboxSceneData]
  );

  const [boundsText, setBoundsText] = useState(() =>
    mapboxSceneData.maxBounds
      ? JSON.stringify(mapboxSceneData.maxBounds)
      : ""
  );

  useEffect(() => {
    setBoundsText(
      mapboxSceneData.maxBounds
        ? JSON.stringify(mapboxSceneData.maxBounds)
        : ""
    );
  }, [mapboxSceneData.maxBounds]);

  const applyBounds = useCallback(() => {
    const t = boundsText.trim();
    if (!t) {
      setMapboxSceneData({ maxBounds: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(t) as [[number, number], [number, number]];
      setMapboxSceneData({ maxBounds: parsed });
    } catch {
      /* invalid */
    }
  }, [boundsText, setMapboxSceneData]);

  const [geoJsonId, setGeoJsonId] = useState("campus-layer");
  const [geoJsonType, setGeoJsonType] =
    useState<MapboxSceneLayer["type"]>("geojson-fill");
  const [geoJsonText, setGeoJsonText] = useState(
    '{"type":"FeatureCollection","features":[]}'
  );

  const [fpId, setFpId] = useState("floor-1");
  const [fpUrl, setFpUrl] = useState("");
  const [fpCoords, setFpCoords] = useState(
    "[[23.72,37.985],[23.725,37.985],[23.725,37.982],[23.72,37.982]]"
  );

  const addGeoJsonLayer = useCallback(() => {
    let geojson: unknown;
    try {
      geojson = JSON.parse(geoJsonText);
    } catch {
      return;
    }
    const layer: MapboxSceneLayer = {
      id: geoJsonId || `layer-${Date.now()}`,
      type: geoJsonType,
      visible: true,
      geojson,
    };
    const next = [...mapboxSceneData.layers.filter((l) => l.id !== layer.id), layer];
    setMapboxSceneData({ layers: next });
  }, [
    geoJsonId,
    geoJsonType,
    geoJsonText,
    mapboxSceneData.layers,
    setMapboxSceneData,
  ]);

  const removeLayer = useCallback(
    (id: string) => {
      setMapboxSceneData({
        layers: mapboxSceneData.layers.filter((l) => l.id !== id),
      });
    },
    [mapboxSceneData.layers, setMapboxSceneData]
  );

  const addFloorPlan = useCallback(() => {
    let coordinates: MapboxFloorPlanRaster["coordinates"];
    try {
      coordinates = JSON.parse(fpCoords) as MapboxFloorPlanRaster["coordinates"];
    } catch {
      return;
    }
    if (!fpUrl.trim()) return;
    const fp: MapboxFloorPlanRaster = {
      id: fpId || `fp-${Date.now()}`,
      url: fpUrl.trim(),
      coordinates,
    };
    const rest = mapboxSceneData.floorPlanRasters || [];
    const next = [...rest.filter((r) => r.id !== fp.id), fp];
    setMapboxSceneData({ floorPlanRasters: next });
  }, [
    fpId,
    fpUrl,
    fpCoords,
    mapboxSceneData.floorPlanRasters,
    setMapboxSceneData,
  ]);

  const removeFloorPlan = useCallback(
    (id: string) => {
      setMapboxSceneData({
        floorPlanRasters: (mapboxSceneData.floorPlanRasters || []).filter(
          (r) => r.id !== id
        ),
      });
    },
    [mapboxSceneData.floorPlanRasters, setMapboxSceneData]
  );

  const presetValue =
    STYLE_PRESETS.find((p) => p.value === mapboxSceneData.styleUrl)?.value ||
    "custom";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, py: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        Observations use camera position as [lng, lat, altitude in meters].
      </Typography>

      <SettingContainer>
        <SettingLabel>Location search</SettingLabel>
        <Box sx={{ width: "100%" }}>
          <LocationSearch onPlaceSelect={handlePlaceSelect} boxPadding={1} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Search via OpenStreetMap Nominatim; zoom is at least 15 when jumping to
          a result.
        </Typography>
      </SettingContainer>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}>
          {sectionTitle("Map style")}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
          <SettingContainer>
            <SettingLabel>Built-in styles</SettingLabel>
            <TextField
              select
              size="small"
              fullWidth
              value={presetValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "custom") setMapboxSceneData({ styleUrl: v });
              }}
              sx={textFieldStyles}
            >
              {STYLE_PRESETS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
              <MenuItem value="custom">Custom URL…</MenuItem>
            </TextField>
          </SettingContainer>
          <TextField
            label="Style URL"
            size="small"
            fullWidth
            value={mapboxSceneData.styleUrl}
            onChange={(e) => setMapboxSceneData({ styleUrl: e.target.value })}
            sx={textFieldStyles}
            helperText="Mapbox Standard unlocks 3D buildings, light presets, and theme."
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}>
          {sectionTitle("Globe, terrain & atmosphere")}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={(mapboxSceneData.projection ?? "mercator") === "globe"}
                onChange={(_, c) =>
                  setMapboxSceneData({ projection: c ? "globe" : "mercator" })
                }
              />
            }
            label="Globe projection"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={terrain.enabled}
                onChange={(_, c) =>
                  setMapboxSceneData({
                    terrain: { ...terrain, enabled: c },
                  })
                }
              />
            }
            label="3D terrain (Mapbox DEM)"
          />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Terrain exaggeration
            </Typography>
            <Slider
              size="small"
              min={0.5}
              max={3}
              step={0.1}
              value={terrain.exaggeration}
              disabled={!terrain.enabled}
              onChange={(_, v) =>
                setMapboxSceneData({
                  terrain: { ...terrain, exaggeration: v as number },
                })
              }
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={fog.enabled !== false}
                onChange={(_, c) =>
                  setMapboxSceneData({
                    fog: { ...fog, enabled: c },
                  })
                }
              />
            }
            label="Atmospheric fog"
          />
          <Stack direction="row" gap={1}>
            <TextField
              label="Fog blend"
              size="small"
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.05 }}
              value={fog.horizonBlend ?? 0.15}
              disabled={!fog.enabled}
              onChange={(e) =>
                setMapboxSceneData({
                  fog: {
                    ...fog,
                    horizonBlend: Number(e.target.value),
                  },
                })
              }
              sx={textFieldStyles}
            />
            <TextField
              label="Star intensity"
              size="small"
              type="number"
              inputProps={{ min: 0, max: 1, step: 0.05 }}
              value={fog.starIntensity ?? 0}
              disabled={!fog.enabled}
              onChange={(e) =>
                setMapboxSceneData({
                  fog: {
                    ...fog,
                    starIntensity: Number(e.target.value),
                  },
                })
              }
              sx={textFieldStyles}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}>
          {sectionTitle("Sun, theme & 3D (Standard style)")}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Requires Mapbox Standard or Standard Satellite. Classic styles ignore these controls.
          </Typography>
          <TextField
            select
            label="Theme"
            size="small"
            fullWidth
            value={std.theme ?? "default"}
            onChange={(e) =>
              patchStd({ theme: e.target.value as MapboxStandardBasemapConfig["theme"] })
            }
            sx={textFieldStyles}
          >
            <MenuItem value="default">Default</MenuItem>
            <MenuItem value="faded">Faded</MenuItem>
            <MenuItem value="monochrome">Monochrome</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
          <TextField
            select
            label="Light preset (shadows & fill)"
            size="small"
            fullWidth
            value={std.lightPreset ?? "day"}
            onChange={(e) =>
              patchStd({
                lightPreset: e.target.value as MapboxStandardBasemapConfig["lightPreset"],
              })
            }
            sx={textFieldStyles}
          >
            <MenuItem value="dawn">Dawn</MenuItem>
            <MenuItem value="day">Day</MenuItem>
            <MenuItem value="dusk">Dusk</MenuItem>
            <MenuItem value="night">Night</MenuItem>
          </TextField>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={std.show3dObjects !== false}
                  onChange={(_, c) => patchStd({ show3dObjects: c })}
                />
              }
              label="3D objects (buildings, landmarks, trees)"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={std.show3dBuildings !== false}
                  onChange={(_, c) => patchStd({ show3dBuildings: c })}
                />
              }
              label="3D buildings"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={std.show3dLandmarks !== false}
                  onChange={(_, c) => patchStd({ show3dLandmarks: c })}
                />
              }
              label="3D landmarks"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={std.show3dTrees !== false}
                  onChange={(_, c) => patchStd({ show3dTrees: c })}
                />
              }
              label="3D trees"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}>
          {sectionTitle("Labels & roads")}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 0.5, pt: 0 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={std.showPlaceLabels !== false}
                onChange={(_, c) => patchStd({ showPlaceLabels: c })}
              />
            }
            label="Place labels"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={std.showRoadLabels !== false}
                onChange={(_, c) => patchStd({ showRoadLabels: c })}
              />
            }
            label="Road labels"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={std.showPointOfInterestLabels !== false}
                onChange={(_, c) => patchStd({ showPointOfInterestLabels: c })}
              />
            }
            label="POI labels"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={std.showTransitLabels !== false}
                onChange={(_, c) => patchStd({ showTransitLabels: c })}
              />
            }
            label="Transit labels"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={std.showPedestrianRoads !== false}
                onChange={(_, c) => patchStd({ showPedestrianRoads: c })}
              />
            }
            label="Pedestrian paths & trails"
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!!std.showAdminBoundaries}
                onChange={(_, c) => patchStd({ showAdminBoundaries: c })}
              />
            }
            label="Administrative boundaries"
          />
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}>
          {sectionTitle("Default camera")}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
          <Stack direction="row" gap={1}>
            <TextField
              label="Center lng"
              size="small"
              type="number"
              value={mapboxSceneData.center[0]}
              onChange={(e) =>
                setMapboxSceneData({
                  center: [Number(e.target.value), mapboxSceneData.center[1]],
                })
              }
              sx={textFieldStyles}
            />
            <TextField
              label="Center lat"
              size="small"
              type="number"
              value={mapboxSceneData.center[1]}
              onChange={(e) =>
                setMapboxSceneData({
                  center: [mapboxSceneData.center[0], Number(e.target.value)],
                })
              }
              sx={textFieldStyles}
            />
          </Stack>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <TextField
              label="Zoom"
              size="small"
              type="number"
              value={mapboxSceneData.zoom}
              onChange={(e) =>
                setMapboxSceneData({ zoom: Number(e.target.value) })
              }
              sx={textFieldStyles}
            />
            <TextField
              label="Pitch"
              size="small"
              type="number"
              value={mapboxSceneData.pitch}
              onChange={(e) =>
                setMapboxSceneData({ pitch: Number(e.target.value) })
              }
              sx={textFieldStyles}
            />
            <TextField
              label="Bearing"
              size="small"
              type="number"
              value={mapboxSceneData.bearing}
              onChange={(e) =>
                setMapboxSceneData({ bearing: Number(e.target.value) })
              }
              sx={textFieldStyles}
            />
          </Stack>
          <TextField
            label="Max bounds (JSON)"
            size="small"
            fullWidth
            multiline
            minRows={2}
            placeholder="[[swLng,swLat],[neLng,neLat]]"
            value={boundsText}
            onChange={(e) => setBoundsText(e.target.value)}
            sx={textFieldStyles}
          />
          <Button size="small" variant="outlined" onClick={applyBounds}>
            Apply bounds
          </Button>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}>
          {sectionTitle("Campus overlays")}
        </AccordionSummary>
        <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
          <Typography variant="subtitle2">Vector layers (GeoJSON)</Typography>
          {mapboxSceneData.layers.map((l) => (
            <Stack
              key={l.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2" noWrap sx={{ maxWidth: "70%" }}>
                {l.name || l.id} ({l.type})
              </Typography>
              <Button size="small" onClick={() => removeLayer(l.id)}>
                Remove
              </Button>
            </Stack>
          ))}
          <TextField
            label="Layer id"
            size="small"
            value={geoJsonId}
            onChange={(e) => setGeoJsonId(e.target.value)}
            sx={textFieldStyles}
          />
          <TextField
            select
            label="Layer type"
            size="small"
            value={geoJsonType}
            onChange={(e) =>
              setGeoJsonType(e.target.value as MapboxSceneLayer["type"])
            }
            sx={textFieldStyles}
          >
            {LAYER_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="GeoJSON"
            size="small"
            multiline
            minRows={3}
            value={geoJsonText}
            onChange={(e) => setGeoJsonText(e.target.value)}
            sx={textFieldStyles}
          />
          <Button variant="contained" size="small" onClick={addGeoJsonLayer}>
            Add / update GeoJSON layer
          </Button>

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle2">Floor plan images</Typography>
          <Typography variant="caption" color="text.secondary">
            Corners: top-left, top-right, bottom-right, bottom-left [lng, lat].
          </Typography>
          {(mapboxSceneData.floorPlanRasters || []).map((r) => (
            <Stack
              key={r.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="body2" noWrap sx={{ maxWidth: "60%" }}>
                {r.name || r.id}
              </Typography>
              <Button size="small" onClick={() => removeFloorPlan(r.id)}>
                Remove
              </Button>
            </Stack>
          ))}
          <TextField
            label="Floor id"
            size="small"
            value={fpId}
            onChange={(e) => setFpId(e.target.value)}
            sx={textFieldStyles}
          />
          <TextField
            label="Image URL"
            size="small"
            fullWidth
            value={fpUrl}
            onChange={(e) => setFpUrl(e.target.value)}
            sx={textFieldStyles}
          />
          <TextField
            label="Corners JSON"
            size="small"
            multiline
            minRows={2}
            value={fpCoords}
            onChange={(e) => setFpCoords(e.target.value)}
            sx={textFieldStyles}
          />
          <Button variant="outlined" size="small" onClick={addFloorPlan}>
            Add / update floor plan
          </Button>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
