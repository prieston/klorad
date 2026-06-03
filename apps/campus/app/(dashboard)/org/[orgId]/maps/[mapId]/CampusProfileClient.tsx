"use client";

import { useState } from "react";
import { toast as toastify } from "react-toastify";
import useSWR from "swr";
import {
  Accessibility,
  Bell,
  Eye,
  ExternalLink,
  MapPin,
  Share2,
} from "lucide-react";
import { Button } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { StatCard } from "@/app/(dashboard)/components/StatCard";
import { CampusHealthCard } from "@/app/(dashboard)/components/CampusHealthCard";
import { WhatChangedCard } from "@/app/(dashboard)/components/WhatChangedCard";
import { JumpBackInTiles } from "@/app/(dashboard)/components/JumpBackInTiles";
import { WelcomeFirstRunCard } from "@/app/(dashboard)/components/WelcomeFirstRunCard";
import { useCampusHealth } from "@/app/hooks/useCampusHealth";
import { useOrganization } from "@/app/hooks/useOrganizations";

interface Props {
  orgId: string;
  mapId: string;
}

interface CampusMap {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  thumbnail?: string | null;
  isPublished?: boolean;
}

interface PushStats {
  subscribers: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Campus Dashboard — Phase 3 of [[campus-backoffice-redesign]].
 *
 * Single-screen overview replacing the prior tab-based hub. The tabs
 * (Overview / News / Indoor / Settings / Integrations) became
 * first-class left-rail destinations in Phase 1, so this surface is
 * now purely a glance-of-the-morning:
 *
 *   header  → name + org context + Share + Open public viewer
 *   stats   → 4 KPI cards (Public views, Push subscribers, POIs,
 *             Accessibility); unbacked stats render "—" not fake data
 *   left    → Campus Health checklist (server-side checks)
 *   right   → What Changed feed (empty state until the audit log
 *             arc lands)
 *   bottom  → Jump back in shortcuts
 */
export default function CampusProfileClient({ orgId, mapId }: Props) {
  const { data: map, isLoading } = useSWR<CampusMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );
  const { health, isLoading: healthLoading } = useCampusHealth(mapId);
  // Reuse Reach's stat endpoint so the dashboard's Subscribers card
  // and the Reach screen agree to the unit. 30s refresh matches Reach.
  const { data: pushStats } = useSWR<PushStats>(
    `/api/maps/${mapId}/push-stats`,
    fetcher,
    { refreshInterval: 30_000 },
  );
  const { organization } = useOrganization(orgId);
  const [shareBusy, setShareBusy] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/campus/${mapId}`
      : `/campus/${mapId}`;

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

  if (!map && isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] space-y-4 px-6 py-8 md:px-10">
        <div className="h-16 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
          <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
        </div>
      </div>
    );
  }

  if (!map) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
        <p className="text-sm text-red-600">Campus not found.</p>
      </div>
    );
  }

  const isPublished = Boolean(map.isPublished);

  // "Fresh" = the rector hasn't set up anything yet. We deliberately
  // ignore the Klio + Published checks (Klio depends on a server
  // env var the rector can't change, and publishing is a final step
  // — pre-publish state shouldn't trigger the welcome banner). The
  // banner self-dismisses the moment any of these flip; no toggle.
  const isFresh = Boolean(
    health &&
      !health.checks.find((c) => c.key === "branding")?.done &&
      !health.checks.find((c) => c.key === "mappedin")?.done &&
      health.counts.news === 0 &&
      health.counts.events === 0 &&
      health.counts.clubs === 0 &&
      health.counts.dining === 0,
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Overview"
        title={map.name}
        subtitle={organization?.name ?? undefined}
        actions={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-text-tertiary/10 text-text-tertiary"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  isPublished ? "bg-emerald-500" : "bg-text-tertiary"
                }`}
              />
              {isPublished ? "Published" : "Draft"}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              disabled={shareBusy || !isPublished}
              title={
                !isPublished ? "Publish the campus to share it" : undefined
              }
            >
              <Share2 size={14} strokeWidth={1.75} aria-hidden />
              {shareBusy ? "Copying…" : "Share"}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                window.open(publicUrl, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
              Open public viewer
            </Button>
          </>
        }
      />

      {isFresh ? (
        <div className="mb-6">
          <WelcomeFirstRunCard
            orgId={orgId}
            mapId={mapId}
            campusName={map.name}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Eye size={18} strokeWidth={1.75} aria-hidden />}
          value="—"
          label="Public views (30d)"
        />
        <StatCard
          icon={<Bell size={18} strokeWidth={1.75} aria-hidden />}
          value={
            pushStats ? pushStats.subscribers.toLocaleString() : "—"
          }
          label="Push subscribers"
        />
        <StatCard
          icon={<MapPin size={18} strokeWidth={1.75} aria-hidden />}
          value={health ? String(health.counts.pois) : "—"}
          label="Points of interest"
          trend={
            health && health.counts.buildings > 0
              ? `across ${health.counts.buildings} buildings`
              : undefined
          }
        />
        <StatCard
          icon={<Accessibility size={18} strokeWidth={1.75} aria-hidden />}
          value={
            health && health.counts.pois > 0
              ? `${health.counts.accessibilityPct}%`
              : "—"
          }
          label="Accessibility"
          trend={
            health && health.counts.accessibleSpaces > 0
              ? `${health.counts.accessibleSpaces} step-free tagged`
              : undefined
          }
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <CampusHealthCard health={health} isLoading={healthLoading} />
        <WhatChangedCard />
      </div>

      <div className="mt-4">
        <JumpBackInTiles orgId={orgId} mapId={mapId} />
      </div>
    </div>
  );
}
