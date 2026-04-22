"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import MapIcon from "@mui/icons-material/Map";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessibleIcon from "@mui/icons-material/Accessible";
import AddIcon from "@mui/icons-material/Add";
import {
  LoadingScreen,
  MetricCard,
  Page,
  PageCard,
  PageContent,
  PageHeader,
  PageSection,
  DashboardProjectCard,
} from "@klorad/ui";
import { useMaps } from "@/app/hooks/useMaps";

interface Props {
  orgId: string;
  userName: string | null;
}

export default function DashboardClient({ orgId, userName }: Props) {
  const router = useRouter();
  const { maps, isLoading } = useMaps(orgId);

  const recentMaps = useMemo(() => maps.slice(0, 3), [maps]);

  if (isLoading) return <LoadingScreen />;

  const greeting = userName ? `Welcome back, ${userName.split(" ")[0]}.` : "Welcome back.";

  return (
    <Page>
      <PageHeader title={greeting} />

      <PageContent>
        {/* KPI row */}
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
          }}
        >
          <MetricCard icon={<MapIcon fontSize="small" />} value={maps.length} label="Campus maps" />
          <MetricCard icon={<PlaceIcon fontSize="small" />} value="—" label="POIs across maps" />
          <MetricCard icon={<VisibilityIcon fontSize="small" />} value="—" label="Public views (30d)" />
          <MetricCard icon={<AccessibleIcon fontSize="small" />} value="—" label="Accessibility coverage" />
        </Box>

        <PageSection title="Recent campuses" spacing="tight">
          {recentMaps.length === 0 ? (
            <PageCard>
              <Box
                sx={{
                  textAlign: "center",
                  py: 5,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <MapIcon sx={{ fontSize: 48, color: "primary.main", opacity: 0.5 }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  No campuses yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  Create your first campus map. Drop some POIs, share the URL — it&apos;s a
                  five-minute setup.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => router.push(`/org/${orgId}/maps`)}
                  sx={{ mt: 1, textTransform: "none" }}
                >
                  Create a campus
                </Button>
              </Box>
            </PageCard>
          ) : (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                  },
                }}
              >
                {recentMaps.map((m) => (
                  <DashboardProjectCard
                    key={m.id}
                    project={{
                      id: m.id,
                      title: m.name,
                      updatedAt: m.updatedAt,
                      createdAt: m.createdAt,
                    }}
                    onGoToBuilder={(id) => router.push(`/org/${orgId}/maps/${id}`)}
                    onMenuOpen={() => {}}
                  />
                ))}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  component={Link}
                  href={`/org/${orgId}/maps`}
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  View all campuses →
                </Button>
              </Box>
            </Stack>
          )}
        </PageSection>

        <PageSection title="Quick actions" spacing="tight">
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            }}
          >
            <QuickActionCard
              title="Create a new campus"
              description="Start with a blank 3D map. Drop POIs in seconds."
              href={`/org/${orgId}/maps`}
            />
            <QuickActionCard
              title="Invite a teammate"
              description="Bring marketing or facilities staff into the org."
              href={`/org/${orgId}/settings/members`}
            />
            <QuickActionCard
              title="Review usage"
              description="See plan limits, POI counts, and view analytics."
              href={`/org/${orgId}/settings/usage`}
            />
          </Box>
        </PageSection>
      </PageContent>
    </Page>
  );
}

function QuickActionCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Box
      component={Link}
      href={href}
      sx={(t) => ({
        display: "block",
        p: 2.5,
        borderRadius: 1,
        textDecoration: "none",
        color: "inherit",
        bgcolor: "#161B20",
        border: "1px solid",
        borderColor: "divider",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: alpha(t.palette.primary.main, 0.5),
          backgroundColor: alpha(t.palette.primary.main, 0.04),
        },
      })}
    >
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </Box>
  );
}
