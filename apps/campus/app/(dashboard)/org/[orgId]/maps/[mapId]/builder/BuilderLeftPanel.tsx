"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Box,
  Chip,
  Divider,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { LeftPanelContainer } from "@klorad/ui";
import { useSceneStore } from "@klorad/core";
import type { POI } from "@klorad/api";

interface Props {
  mapName?: string;
  pois: POI[];
}

const BASE_STYLES = [
  { id: "standard", label: "Standard", url: "mapbox://styles/mapbox/standard" },
  { id: "streets", label: "Streets", url: "mapbox://styles/mapbox/streets-v12" },
  { id: "satellite", label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  { id: "dark", label: "Dark", url: "mapbox://styles/mapbox/dark-v11" },
  { id: "light", label: "Light", url: "mapbox://styles/mapbox/light-v11" },
];

const LIGHT_PRESETS = ["dawn", "day", "dusk", "night"] as const;

export default function BuilderLeftPanel({ mapName, pois }: Props) {
  const [tab, setTab] = useState<"campus" | "environment">("campus");
  const params = useParams<{ orgId?: string; mapId?: string }>();
  const profileHref =
    params?.orgId && params?.mapId
      ? `/org/${params.orgId}/maps/${params.mapId}`
      : "/";
  const scene = useSceneStore((s) => s.mapboxSceneData);
  const setMapboxSceneData = useSceneStore((s) => s.setMapboxSceneData);

  const isStandard = scene.styleUrl?.includes("/standard") ?? false;
  const sb = scene.standardBasemap ?? {};

  const setStyle = (url: string) => setMapboxSceneData({ styleUrl: url });

  /**
   * Push the change to Mapbox directly *and* update the store so it
   * round-trips through save/load. `useMapboxSceneSync` diffs scene
   * JSON to decide whether to re-apply env config; for narrow updates
   * like flipping a single toggle the diff sometimes coalesces and
   * the map ends up stale. Calling `setConfigProperty` here guarantees
   * the change lands immediately.
   */
  const applyStandardConfig = (key: string, value: unknown) => {
    const map = useSceneStore.getState().mapboxMap as
      | { setConfigProperty?: (importId: string, k: string, v: unknown) => void }
      | null;
    const importId = sb.importId ?? "basemap";
    try {
      map?.setConfigProperty?.(importId, key, value);
    } catch {
      /* classic styles have no basemap import */
    }
  };

  const toggleSb = (key: string, value: boolean) => {
    setMapboxSceneData({ standardBasemap: { ...sb, [key]: value } });
    applyStandardConfig(key, value);
  };
  const setLightPreset = (p: (typeof LIGHT_PRESETS)[number]) => {
    setMapboxSceneData({ standardBasemap: { ...sb, lightPreset: p } });
    applyStandardConfig("lightPreset", p);
  };

  /** Apply a terrain change directly to the map for the same reason. */
  const applyTerrain = (enabled: boolean, exaggeration: number) => {
    const map = useSceneStore.getState().mapboxMap as
      | {
          setTerrain?: (t: { source: string; exaggeration: number } | null) => void;
          getSource?: (id: string) => unknown;
          addSource?: (id: string, src: object) => void;
        }
      | null;
    if (!map?.setTerrain) return;
    const SOURCE_ID = "klorad-terrain-dem";
    try {
      if (enabled) {
        if (map.getSource && !map.getSource(SOURCE_ID) && map.addSource) {
          map.addSource(SOURCE_ID, {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: SOURCE_ID, exaggeration });
      } else {
        map.setTerrain(null);
      }
    } catch {
      /* terrain unsupported on this style */
    }
  };

  return (
    <LeftPanelContainer
      previewMode={false}
      className="glass-panel"
      sx={{
        position: "fixed",
        left: 16,
        top: 16,
        height: "calc(100vh - 32px)",
        maxHeight: "calc(100vh - 32px) !important",
        padding: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: 64,
          borderBottom: "1px solid rgba(100,116,139,0.2)",
          px: 2,
          flexShrink: 0,
        }}
      >
        <Link href={profileHref} aria-label="Back to Campus Profile" style={{ textDecoration: "none", display: "flex" }}>
          <Image
            src="/images/logo/klorad-campus-logo-white.svg"
            alt="Klorad Campus"
            width={140}
            height={32}
            priority
            style={{
              objectFit: "contain",
              height: "auto",
            }}
          />
        </Link>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 42,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiTab-root": {
            minHeight: 42,
            fontSize: "0.8125rem",
            textTransform: "none",
            fontWeight: 500,
          },
          "& .Mui-selected": { color: "primary.main" },
          "& .MuiTabs-indicator": { height: 2 },
        }}
      >
        <Tab value="campus" label="Campus" />
        <Tab value="environment" label="Environment" />
      </Tabs>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {tab === "campus" && (
          <Stack spacing={2}>
            <Box>
              <Typography
                variant="overline"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  letterSpacing: "0.08em",
                }}
              >
                Project
              </Typography>
              <Typography variant="body1" fontWeight={600} sx={{ mt: 0.5 }} noWrap>
                {mapName ?? "Campus Map"}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography
                variant="overline"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  letterSpacing: "0.08em",
                }}
              >
                Stats
              </Typography>
              <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
                <Box
                  sx={{
                    flex: 1,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    POIs
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25, fontSize: "1.25rem" }}>
                    {pois.length}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Linked
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25, fontSize: "1.25rem" }}>
                    {pois.filter((p) => p.linkedBuilding).length}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        )}

        {tab === "environment" && (
          <Stack spacing={2}>
            {/* Base style */}
            <Box>
              <Typography
                variant="overline"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  letterSpacing: "0.08em",
                }}
              >
                Base Style
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                {BASE_STYLES.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.label}
                    size="small"
                    clickable
                    onClick={() => setStyle(s.url)}
                    color={scene.styleUrl === s.url ? "primary" : "default"}
                    sx={{
                      fontSize: "0.75rem",
                      bgcolor: scene.styleUrl === s.url ? undefined : "action.hover",
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Standard-only toggles */}
            {isStandard && (
              <>
                <Divider />
                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "text.secondary",
                      letterSpacing: "0.08em",
                    }}
                  >
                    3D &amp; Labels
                  </Typography>
                  <Stack spacing={0} sx={{ mt: 0.5 }}>
                    <ToggleRow
                      label="3D buildings"
                      checked={sb.show3dBuildings ?? true}
                      onChange={(v) => toggleSb("show3dBuildings", v)}
                    />
                    <ToggleRow
                      label="3D landmarks"
                      checked={sb.show3dLandmarks ?? true}
                      onChange={(v) => toggleSb("show3dLandmarks", v)}
                    />
                    <ToggleRow
                      label="3D trees"
                      checked={sb.show3dTrees ?? true}
                      onChange={(v) => toggleSb("show3dTrees", v)}
                    />
                    <ToggleRow
                      label="Place labels"
                      checked={sb.showPlaceLabels ?? true}
                      onChange={(v) => toggleSb("showPlaceLabels", v)}
                    />
                    <ToggleRow
                      label="POI labels"
                      checked={sb.showPointOfInterestLabels ?? true}
                      onChange={(v) => toggleSb("showPointOfInterestLabels", v)}
                    />
                    <ToggleRow
                      label="Road labels"
                      checked={sb.showRoadLabels ?? true}
                      onChange={(v) => toggleSb("showRoadLabels", v)}
                    />
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "text.secondary",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Lighting
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                    {LIGHT_PRESETS.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        size="small"
                        clickable
                        onClick={() => setLightPreset(p)}
                        color={sb.lightPreset === p ? "primary" : "default"}
                        sx={{
                          fontSize: "0.75rem",
                          textTransform: "capitalize",
                          bgcolor: sb.lightPreset === p ? undefined : "action.hover",
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}

            <Divider />

            {/* Terrain */}
            <Box>
              <ToggleRow
                label="Terrain"
                checked={scene.terrain?.enabled ?? false}
                onChange={(v) => {
                  const exaggeration = scene.terrain?.exaggeration ?? 1.2;
                  setMapboxSceneData({
                    terrain: { enabled: v, exaggeration },
                  });
                  applyTerrain(v, exaggeration);
                }}
              />
              {scene.terrain?.enabled && (
                <Box sx={{ mt: 1, px: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                    Exaggeration: {(scene.terrain?.exaggeration ?? 1.2).toFixed(1)}x
                  </Typography>
                  <Slider
                    size="small"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={scene.terrain?.exaggeration ?? 1.2}
                    onChange={(_e, v) => {
                      const exaggeration = Array.isArray(v) ? v[0] : v;
                      setMapboxSceneData({
                        terrain: { enabled: true, exaggeration },
                      });
                      applyTerrain(true, exaggeration);
                    }}
                  />
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </Box>
    </LeftPanelContainer>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        py: 0.5,
      }}
    >
      <Typography variant="body2" sx={{ flex: 1, fontSize: "0.8125rem" }}>
        {label}
      </Typography>
      <Switch
        size="small"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Box>
  );
}
