"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MapIcon from "@mui/icons-material/Map";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessibleIcon from "@mui/icons-material/Accessible";
import { Panel, Button } from "@klorad/design-system";
import { useMaps } from "@/app/hooks/useMaps";
import LocationsHeader from "../maps/LocationsHeader";

interface Props {
  orgId: string;
}

export default function DashboardClient({ orgId }: Props) {
  const router = useRouter();
  const { maps, isLoading } = useMaps(orgId);

  const recentMaps = useMemo(() => maps.slice(0, 3), [maps]);
  const showSkeleton = isLoading && maps.length === 0;

  return (
    <div className="w-full space-y-10 px-6 py-8 md:px-10">
      <LocationsHeader maps={maps} />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<MapIcon fontSize="small" />}
          value={String(maps.length)}
          label="Campus maps"
        />
        <StatCard
          icon={<PlaceIcon fontSize="small" />}
          value="—"
          label="POIs across maps"
        />
        <StatCard
          icon={<VisibilityIcon fontSize="small" />}
          value="—"
          label="Public views (30d)"
        />
        <StatCard
          icon={<AccessibleIcon fontSize="small" />}
          value="—"
          label="Accessibility coverage"
        />
      </div>

      {/* Recent campuses */}
      <section className="space-y-4">
        <SectionTitle>Recent campuses</SectionTitle>
        {showSkeleton ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[208px] animate-pulse rounded-xl bg-surface-2"
              />
            ))}
          </div>
        ) : recentMaps.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <MapIcon className="text-accent opacity-60" fontSize="large" />
            <p className="text-base font-medium text-text-primary">
              No campuses yet
            </p>
            <p className="max-w-sm text-sm text-text-secondary">
              Create your first campus map. Drop some POIs, share the URL —
              it&apos;s a five-minute setup.
            </p>
            <Button
              className="mt-1"
              onClick={() => router.push(`/org/${orgId}/maps`)}
            >
              Create a campus
            </Button>
          </Panel>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentMaps.map((m) => (
                <CampusCard
                  key={m.id}
                  name={m.name}
                  updatedAt={m.updatedAt}
                  thumbnail={m.thumbnail ?? undefined}
                  href={`/org/${orgId}/maps/${m.id}`}
                />
              ))}
            </div>
            <div className="flex justify-end">
              <Link
                href={`/org/${orgId}/maps`}
                className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                View all campuses →
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="space-y-4">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAction
            title="Create a new campus"
            description="Start with a blank 3D map. Drop POIs in seconds."
            href={`/org/${orgId}/maps`}
          />
          <QuickAction
            title="Invite a teammate"
            description="Bring marketing or facilities staff into the org."
            href={`/org/${orgId}/settings/members`}
          />
          <QuickAction
            title="Review usage"
            description="See plan limits, POI counts, and view analytics."
            href={`/org/${orgId}/settings/usage`}
          />
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
      {children}
    </h2>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
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

function CampusCard({
  name,
  updatedAt,
  thumbnail,
  href,
}: {
  name: string;
  updatedAt: string | number | Date;
  thumbnail?: string;
  href: string;
}) {
  const updated = new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <Link href={href} className="group block">
      <Panel className="overflow-hidden rounded-2xl transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent group-hover:shadow-glass">
        <div className="aspect-video bg-surface-2">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="p-4">
          <div className="font-medium text-text-primary">{name}</div>
          <div className="mt-1 text-xs text-text-tertiary">
            Updated {updated}
          </div>
        </div>
      </Panel>
    </Link>
  );
}

function QuickAction({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Panel className="h-full rounded-2xl p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-accent group-hover:shadow-glass">
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-text-secondary">
          {description}
        </div>
      </Panel>
    </Link>
  );
}
