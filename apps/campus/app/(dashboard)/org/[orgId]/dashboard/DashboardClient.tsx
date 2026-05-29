"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Building2,
  Eye,
  MapPin,
  Plus,
  UserPlus,
} from "lucide-react";
import { Button } from "@klorad/design-system";
import { useMaps } from "@/app/hooks/useMaps";
import { useOrganization } from "@/app/hooks/useOrganizations";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { StatCard } from "@/app/(dashboard)/components/StatCard";
import { CampusCard } from "@/app/(dashboard)/components/CampusCard";
import { OrgWorldMap } from "@/app/(dashboard)/components/OrgWorldMap";

interface Props {
  orgId: string;
}

/**
 * Org Overview — the rector's first-screen-of-the-morning.
 *
 * Structure matches the IHU mocks:
 *   header (org name + invite/new campus actions)
 *   Mapbox world map with one pin per campus
 *   4 stat cards (Campuses · POIs · Public views · Avg accessibility)
 *   "Most active campuses" — 3 gradient cards sorted by recent edits
 *
 * Stats with a real backend show the real number; everything else
 * is rendered as "—" rather than fake data, so the rector trusts
 * what's displayed.
 */
export default function DashboardClient({ orgId }: Props) {
  const router = useRouter();
  const { maps, isLoading } = useMaps(orgId);
  const { organization } = useOrganization(orgId);

  const sortedByActivity = useMemo(
    () =>
      [...maps].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [maps],
  );
  const mostActive = sortedByActivity.slice(0, 3);
  const publishedCount = maps.filter((m) => m.isPublished).length;
  const draftCount = maps.length - publishedCount;
  const showSkeleton = isLoading && maps.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Organisation"
        title={organization?.name ?? "Organisation"}
        subtitle="Every campus this organisation runs, across all locations."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                router.push(`/org/${orgId}/settings/members`)
              }
            >
              <UserPlus size={14} strokeWidth={1.75} aria-hidden />
              Invite team
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/org/${orgId}/maps`)}
            >
              <Plus size={14} strokeWidth={1.75} aria-hidden />
              New campus
            </Button>
          </>
        }
      />

      <OrgWorldMap maps={maps} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Building2 size={18} strokeWidth={1.75} aria-hidden />}
          value={String(maps.length)}
          label="Campuses"
          trend={
            maps.length > 0
              ? `${publishedCount} published · ${draftCount} draft`
              : null
          }
        />
        <StatCard
          icon={<MapPin size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="POIs across maps"
        />
        <StatCard
          icon={<Eye size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="Public views (30d)"
        />
        <StatCard
          icon={<Accessibility size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="Avg accessibility"
        />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            Most active campuses
          </h2>
          {maps.length > 3 ? (
            <Link
              href={`/org/${orgId}/maps`}
              className="text-sm font-medium text-accent hover:underline"
            >
              View all campuses →
            </Link>
          ) : null}
        </div>
        {showSkeleton ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[208px] animate-pulse rounded-2xl bg-surface-2"
              />
            ))}
          </div>
        ) : mostActive.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-soft bg-surface-1 px-6 py-12 text-center">
            <Building2
              size={28}
              strokeWidth={1.5}
              className="text-accent opacity-60"
              aria-hidden
            />
            <p className="text-base font-medium text-text-primary">
              No campuses yet
            </p>
            <p className="max-w-sm text-sm text-text-secondary">
              Create your first campus. Five-minute setup — pick a location,
              annotate, share.
            </p>
            <Button
              className="mt-1"
              onClick={() => router.push(`/org/${orgId}/maps`)}
            >
              Create a campus
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mostActive.map((m) => (
              <CampusCard
                key={m.id}
                id={m.id}
                name={m.name}
                isPublished={m.isPublished}
                updatedAt={m.updatedAt}
                href={`/org/${orgId}/maps/${m.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
