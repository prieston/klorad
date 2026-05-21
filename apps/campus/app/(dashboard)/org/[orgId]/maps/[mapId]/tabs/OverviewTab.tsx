"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import AccessibleIcon from "@mui/icons-material/Accessible";
import { Button, Panel } from "@klorad/design-system";

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
  const router = useRouter();
  // Phase 6 — points to the new Workbench. The const name stays
  // `studioHref` to minimise the blast radius; downstream JSX just
  // reads it as "the editor URL".
  const studioHref = `/org/${orgId}/maps/${mapId}/workbench`;

  // Derive simple stats from the scene data — no analytics backend yet.
  const stats = useMemo(() => {
    const scene = map.sceneData as
      | {
          objects?: Poi[];
          mapboxScene?: { center?: [number, number] };
          center?: [number, number];
        }
      | undefined;
    const objects = scene?.objects ?? [];
    const pois = objects.filter((o) => o?.meta?.poi);
    const accessible = pois.filter(
      (p) => p?.meta?.poi?.accessibility?.wheelchairAccessible,
    );
    const linked = pois.filter((p) => p?.meta?.poi?.linkedBuilding);
    const complianceScore =
      pois.length > 0
        ? Math.round((accessible.length / pois.length) * 100)
        : 0;
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
    <div className="space-y-8 pt-6">
      {/* Thumbnail (left) + 2×2 KPI grid (right). */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl border border-line-soft bg-accent-soft">
          {map.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={map.thumbnail}
              alt={map.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <PlaceIcon
                sx={{ fontSize: 48 }}
                className="text-accent opacity-50"
              />
              <p className="text-sm text-text-secondary">
                No thumbnail yet — capture one from the Studio Location tab.
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 py-3 text-white">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">
                {map.name}
              </div>
              {stats.center && (
                <div className="font-mono text-[0.7rem] tracking-wide text-white/75">
                  {stats.center[0].toFixed(3)}°, {stats.center[1].toFixed(3)}°
                </div>
              )}
            </div>
            <div className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-white/85">
              {stats.poiCount} {stats.poiCount === 1 ? "POI" : "POIs"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={<PlaceIcon fontSize="small" />}
            value={stats.poiCount}
            label="Points of interest"
          />
          <StatCard
            icon={<VisibilityIcon fontSize="small" />}
            value="—"
            label="Views this month"
          />
          <StatCard
            icon={<SearchIcon fontSize="small" />}
            value="—"
            label="Top searches"
          />
          <StatCard
            icon={<AccessibleIcon fontSize="small" />}
            value={`${stats.complianceScore}%`}
            label="Accessibility coverage"
          />
        </div>
      </div>

      {/* Enter Studio CTA */}
      <Panel className="rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-text-primary">
              Edit your campus map
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Open the Studio to add points of interest, link buildings, set the
              map location, and toggle environment layers.
            </p>
            <Button className="mt-4" onClick={() => router.push(studioHref)}>
              Enter Studio
            </Button>
          </div>
          <div className="hidden h-24 w-40 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-accent-soft sm:flex">
            <PlaceIcon
              sx={{ fontSize: 48 }}
              className="text-accent opacity-50"
            />
          </div>
        </div>
      </Panel>

      {/* Coverage breakdown */}
      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Coverage breakdown
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <CoverageCard
            overline="POIs with linked buildings"
            value={`${stats.linkedCount} / ${stats.poiCount}`}
            caption="Pins anchored to an actual building footprint feel more authoritative on the public viewer."
          />
          <CoverageCard
            overline="Accessibility-tagged"
            value={`${stats.accessibleCount} / ${stats.poiCount}`}
            caption="The European Accessibility Act (2019/882) requires public-sector sites to publish this. Fill it in."
          />
          <CoverageCard
            overline="Analytics"
            value="Coming soon"
            caption="Views, top searches, and wayfinding pain points will appear here once the map is live."
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
}) {
  return (
    <Panel className="rounded-2xl p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="mt-4 text-2xl font-light text-text-primary">{value}</div>
      <div className="mt-0.5 text-sm text-text-secondary">{label}</div>
    </Panel>
  );
}

function CoverageCard({
  overline,
  value,
  caption,
}: {
  overline: string;
  value: string;
  caption: string;
}) {
  return (
    <Panel className="rounded-2xl p-5">
      <div className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-text-tertiary">
        {overline}
      </div>
      <div className="mt-1 text-3xl font-light text-text-primary">{value}</div>
      <p className="mt-1.5 text-xs text-text-secondary">{caption}</p>
    </Panel>
  );
}
