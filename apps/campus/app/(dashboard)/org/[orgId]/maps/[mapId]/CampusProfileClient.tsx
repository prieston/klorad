"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import EditIcon from "@mui/icons-material/Edit";
import { Badge, Button, cn } from "@klorad/design-system";
import OverviewTab from "./tabs/OverviewTab";
import SettingsTab from "./tabs/SettingsTab";
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
  thumbnail?: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Floor-plan management lives in the Studio now (Buildings tab) so the
// Assets tab is gone from the profile.
type TabKey = "overview" | "settings" | "integrations";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "integrations", label: "Integrations" },
];

export default function CampusProfileClient({ orgId, mapId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "overview";

  const { data: map, isLoading } = useSWR<CampusMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "overview") params.delete("tab");
    else params.set("tab", key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (!map && isLoading) {
    return (
      <div className="w-full space-y-3 px-6 py-8 md:px-10">
        <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-80 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (!map) {
    return (
      <div className="w-full px-6 py-8 md:px-10">
        <p className="text-sm text-red-600">Map not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8 md:px-10">
      <div className="flex items-center gap-3">
        <Badge tone="success">Live</Badge>
        <span className="flex-1 text-sm text-text-secondary">
          Last updated {new Date(map.updatedAt).toLocaleDateString()}
        </span>
        <Button
          onClick={() => router.push(`/org/${orgId}/maps/${mapId}/builder`)}
        >
          <EditIcon fontSize="small" />
          Enter Studio
        </Button>
      </div>

      <div className="mt-6 flex gap-1 border-b border-line-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === t.key
                ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {t.label}
            {activeTab === t.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-2">
        {activeTab === "overview" && (
          <OverviewTab orgId={orgId} mapId={mapId} map={map} />
        )}
        {activeTab === "settings" && (
          <SettingsTab orgId={orgId} mapId={mapId} map={map} />
        )}
        {activeTab === "integrations" && <IntegrationsTab />}
      </div>
    </div>
  );
}
