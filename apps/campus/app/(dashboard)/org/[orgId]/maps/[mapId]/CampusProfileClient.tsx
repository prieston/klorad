"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  Box,
  Button,
  Chip,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { Page, PageHeader, PageContent, LoadingScreen } from "@klorad/ui";
import OverviewTab from "./tabs/OverviewTab";
import SettingsTab from "./tabs/SettingsTab";
import AssetsTab from "./tabs/AssetsTab";
import IntegrationsTab from "./tabs/IntegrationsTab";

interface Props {
  orgId: string;
  mapId: string;
}

interface CampusMap {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  sceneData?: unknown;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TabKey = "overview" | "settings" | "assets" | "integrations";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "assets", label: "Assets" },
  { key: "integrations", label: "Integrations" },
];

export default function CampusProfileClient({ orgId, mapId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "overview";

  const { data: map, isLoading } = useSWR<CampusMap>(`/api/maps/${mapId}`, fetcher);

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "overview") params.delete("tab");
    else params.set("tab", key);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "", { scroll: false });
  };

  if (isLoading) return <LoadingScreen />;
  if (!map) {
    return (
      <Page>
        <PageContent>
          <Typography color="error">Map not found.</Typography>
        </PageContent>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={map.name}
        breadcrumbs={[
          { label: "Maps", href: `/org/${orgId}/maps` },
          { label: map.name },
        ]}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2, mb: 3 }}>
        <Chip
          label="Live"
          size="small"
          sx={{
            height: 24,
            fontSize: "0.75rem",
            fontWeight: 600,
            bgcolor: (th) => th.palette.success.main + "22",
            color: "success.main",
            "& .MuiChip-label": { px: 1.25 },
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Last updated {new Date(map.updatedAt).toLocaleDateString()}
        </Typography>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          component={Link}
          href={`/org/${orgId}/maps/${mapId}/builder`}
          sx={{ textTransform: "none" }}
        >
          Enter Studio
        </Button>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_e, v) => setTab(v)}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": {
            fontSize: "0.875rem",
            textTransform: "none",
            fontWeight: 500,
            minHeight: 44,
          },
          "& .Mui-selected": { color: "primary.main" },
        }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      <PageContent>
        {activeTab === "overview" && <OverviewTab orgId={orgId} mapId={mapId} map={map} />}
        {activeTab === "settings" && <SettingsTab orgId={orgId} mapId={mapId} map={map} />}
        {activeTab === "assets" && <AssetsTab orgId={orgId} mapId={mapId} />}
        {activeTab === "integrations" && <IntegrationsTab />}
      </PageContent>
    </Page>
  );
}
