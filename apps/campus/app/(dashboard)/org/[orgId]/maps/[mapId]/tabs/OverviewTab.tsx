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
    const scene = map.sceneData as { objects?: Poi[] } | undefined;
    const objects = scene?.objects ?? [];
    const pois = objects.filter((o) => o?.meta?.poi);
    const accessible = pois.filter(
      (p) => p?.meta?.poi?.accessibility?.wheelchairAccessible
    );
    const linked = pois.filter((p) => p?.meta?.poi?.linkedBuilding);
    const complianceScore =
      pois.length > 0 ? Math.round((accessible.length / pois.length) * 100) : 0;
    return {
      poiCount: pois.length,
      linkedCount: linked.length,
      accessibleCount: accessible.length,
      complianceScore,
    };
  }, [map.sceneData]);

  return (
    <Stack spacing={4} sx={{ mt: 3 }}>
      {/* KPI row — CSS grid (no negative-margin overflow) */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)",
          },
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
