"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import AccessibleIcon from "@mui/icons-material/Accessible";
import { MetricCard, PageCard, PageSection } from "@klorad/ui";

interface Props {
  orgId: string;
  mapId: string;
  map: {
    id: string;
    name: string;
    sceneData?: unknown;
    thumbnail?: string | null;
    updatedAt?: string;
  };
}

interface Poi {
  id: string;
  name: string;
  meta?: {
    poi?: {
      accessibility?: { wheelchairAccessible?: boolean };
      linkedBuilding?: unknown;
    };
  };
}

export default function OverviewTab({ orgId, mapId, map }: Props) {
  // Derive simple stats from the scene data — no analytics backend yet.
  const stats = useMemo(() => {
    const scene = map.sceneData as
      | { objects?: Poi[]; mapboxScene?: { center?: [number, number] }; center?: [number, number] }
      | undefined;
    const objects = scene?.objects ?? [];
    const pois = objects.filter((o) => o?.meta?.poi);
    const accessible = pois.filter(
      (p) => p?.meta?.poi?.accessibility?.wheelchairAccessible
    );
    const linked = pois.filter((p) => p?.meta?.poi?.linkedBuilding);
    const complianceScore =
      pois.length > 0 ? Math.round((accessible.length / pois.length) * 100) : 0;
    const rawCenter = scene?.mapboxScene?.center ?? scene?.center ?? null;
    const center =
      Array.isArray(rawCenter) &&
      rawCenter.length >= 2 &&
      typeof rawCenter[0] === "number" &&
      typeof rawCenter[1] === "number" &&
      !(rawCenter[0] === 0 && rawCenter[1] === 0)
        ? ([rawCenter[0], rawCenter[1]] as [number, number])
        : null;
    return {
      poiCount: pois.length,
      linkedCount: linked.length,
      accessibleCount: accessible.length,
      complianceScore,
      center,
    };
  }, [map.sceneData]);

  return (
    <Stack spacing={4} sx={{ mt: 3 }}>
      {/* Top row: thumbnail (left) + 2×2 KPI grid (right). Collapses to a
          single column below md. */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          alignItems: "stretch",
        }}
      >
        <Box
          sx={(t) => ({
            position: "relative",
            borderRadius: 1,
            overflow: "hidden",
            border: `1px solid ${t.palette.divider}`,
            bgcolor: alpha(t.palette.primary.main, 0.04),
            aspectRatio: "16 / 10",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {map.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={map.thumbnail}
              alt={map.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <Stack alignItems="center" spacing={1} sx={{ textAlign: "center", p: 3 }}>
              <PlaceIcon sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                No thumbnail yet — capture one from the Studio Location tab.
              </Typography>
            </Stack>
          )}
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              px: 2,
              py: 1.5,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {map.name}
              </Typography>
              {stats.center && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: "0.7rem",
                    fontFamily: "monospace",
                    letterSpacing: "0.02em",
                  }}
                >
                  {stats.center[0].toFixed(3)}°, {stats.center[1].toFixed(3)}°
                </Typography>
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,0.85)",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              {stats.poiCount} {stats.poiCount === 1 ? "POI" : "POIs"}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: "repeat(2, 1fr)",
            gridAutoRows: "1fr",
          }}
        >
          <MetricCard
            icon={<PlaceIcon fontSize="small" />}
            value={stats.poiCount}
            label="Points of interest"
          />
          <MetricCard
            icon={<VisibilityIcon fontSize="small" />}
            value="—"
            label="Views this month"
          />
          <MetricCard
            icon={<SearchIcon fontSize="small" />}
            value="—"
            label="Top searches"
          />
          <MetricCard
            icon={<AccessibleIcon fontSize="small" />}
            value={`${stats.complianceScore}%`}
            label="Accessibility coverage"
          />
        </Box>
      </Box>

      {/* Enter Studio CTA */}
      <PageCard>
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Edit your campus map
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Open the Studio to add points of interest, link buildings, set the
              map location, and toggle environment layers.
            </Typography>
            <Button
              variant="contained"
              component={Link}
              href={`/org/${orgId}/maps/${mapId}/builder`}
              sx={{ textTransform: "none" }}
            >
              Enter Studio
            </Button>
          </Box>
          <Box
            sx={(t) => ({
              width: 160,
              height: 96,
              borderRadius: 1,
              bgcolor: alpha(t.palette.primary.main, 0.08),
              border: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            })}
          >
            <PlaceIcon sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }} />
          </Box>
        </Box>
      </PageCard>

      <PageSection title="Coverage breakdown" spacing="tight">
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          }}
        >
          <PageCard>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: "0.08em" }}>
              POIs with linked buildings
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
              {stats.linkedCount} / {stats.poiCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Pins anchored to an actual building footprint feel more
              authoritative on the public viewer.
            </Typography>
          </PageCard>
          <PageCard>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: "0.08em" }}>
              Accessibility-tagged
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
              {stats.accessibleCount} / {stats.poiCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The European Accessibility Act (2019/882) requires public-sector
              sites to publish this. Fill it in.
            </Typography>
          </PageCard>
          <PageCard>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.7rem", letterSpacing: "0.08em" }}>
              Analytics
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
              Coming soon
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Views, top searches, and wayfinding pain points will appear
              here once the map is live.
            </Typography>
          </PageCard>
        </Box>
      </PageSection>
    </Stack>
  );
}
