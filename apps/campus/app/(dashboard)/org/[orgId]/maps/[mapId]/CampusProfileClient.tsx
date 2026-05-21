"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast as toastify } from "react-toastify";
import useSWR from "swr";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ShareIcon from "@mui/icons-material/Share";
import {
  Badge,
  Button,
  WorkbenchStatTile,
  cn,
} from "@klorad/design-system";
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

type TabKey = "overview" | "settings" | "integrations";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "integrations", label: "Integrations" },
];

/**
 * Phase 0 of the production-polish arc — the campus profile hub.
 *
 * What changed:
 *   - Hero now leads with a real status badge derived from the
 *     scene (Draft vs Published — persisted publish state ships
 *     in a follow-up commit).
 *   - Stats row gives a one-glance read of the campus's size +
 *     accessibility coverage.
 *   - Three primary CTAs (Edit / Open public viewer / Share) sit
 *     in the hero where buyers expect them. Share copies the
 *     public-viewer link — same flow the workbench top bar uses.
 *
 * The hero structure is intentionally generic so it lifts cleanly
 * into a `WorldProfileHero` DS primitive when the second vertical
 * (mobility / heritage / …) ships. For now it lives here.
 */
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
        <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-2" />
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
      <CampusProfileHero orgId={orgId} mapId={mapId} map={map} />

      <div className="mt-8 flex gap-1 border-b border-line-soft">
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

/* ─── Hero ────────────────────────────────────────────────────────── */

interface CampusHeroPoi {
  id: string;
  meta?: {
    poi?: {
      accessibility?: { wheelchairAccessible?: boolean };
      linkedBuilding?: unknown;
    };
  };
}

/**
 * Top-of-page hero: status, name, last-updated, four stat tiles, and
 * three primary actions. Generic enough to template into a shared
 * `WorldProfileHero` later — kept inline here while it's a one-off
 * (per the "lift when a second consumer is plausible" rule).
 */
function CampusProfileHero({
  orgId,
  mapId,
  map,
}: {
  orgId: string;
  mapId: string;
  map: CampusMap;
}) {
  const router = useRouter();

  const stats = useMemo(() => {
    const scene = map.sceneData as
      | { objects?: CampusHeroPoi[] }
      | undefined;
    const objects = scene?.objects ?? [];
    const pois = objects.filter((o) => o?.meta?.poi);
    const buildings = pois.filter((p) => p?.meta?.poi?.linkedBuilding);
    const accessible = pois.filter(
      (p) => p?.meta?.poi?.accessibility?.wheelchairAccessible,
    );
    return {
      poiCount: pois.length,
      buildingCount: buildings.length,
      accessibleCount: accessible.length,
      accessibilityPct:
        pois.length > 0
          ? Math.round((accessible.length / pois.length) * 100)
          : 0,
    };
  }, [map.sceneData]);

  // Provisional publish state — once a real `status` field lands on
  // Map, swap this heuristic for `map.status`.
  const status: { label: string; tone: "neutral" | "success" } =
    stats.poiCount > 0
      ? { label: "Published", tone: "success" }
      : { label: "Draft", tone: "neutral" };

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/campus/${mapId}`
      : `/campus/${mapId}`;

  const [shareBusy, setShareBusy] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    setShareBusy(true);
    try {
      await navigator.clipboard.writeText(publicUrl);
      toastify.success("Public link copied");
    } catch {
      toastify.error("Couldn't copy the link");
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-[0.7rem] text-text-tertiary">
              Updated {new Date(map.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-text-primary">
            {map.name}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleShare}
            disabled={shareBusy}
          >
            <ShareIcon fontSize="small" />
            {shareBusy ? "Copying…" : "Share"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
            disabled={stats.poiCount === 0}
            title={
              stats.poiCount === 0
                ? "Add a POI before opening the public viewer"
                : undefined
            }
          >
            <OpenInNewIcon fontSize="small" />
            Open public viewer
          </Button>
          <Button
            onClick={() => router.push(`/org/${orgId}/maps/${mapId}/workbench`)}
          >
            <EditIcon fontSize="small" />
            Edit campus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <WorkbenchStatTile label="POIs" value={stats.poiCount} />
        <WorkbenchStatTile label="Buildings" value={stats.buildingCount} />
        <WorkbenchStatTile
          label="Accessible"
          value={stats.accessibleCount}
          hint={`${stats.accessibilityPct}% of POIs`}
        />
        <WorkbenchStatTile
          label="Status"
          value={status.label}
          hint={
            stats.poiCount === 0
              ? "Add your first POI to publish"
              : "Reachable via the public link"
          }
        />
      </div>
    </section>
  );
}
