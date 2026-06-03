"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Check,
  Megaphone,
  Palette,
  Sparkles,
  Map as MapIcon,
} from "lucide-react";
import { Button, Panel } from "@klorad/design-system";

interface Props {
  orgId: string;
  mapId: string;
  alreadySeeded: boolean;
  hasBranding: boolean;
  hasIndoorMap: boolean;
  isPublished: boolean;
}

/**
 * Three launcher cards. Each renders a small status pill ("done" or
 * a CTA) and links into the matching admin surface — the existing
 * Settings tab handles branding, the Indoor tab handles MappedIn,
 * and Try with sample data POSTs to /api/maps/[mapId]/seed-sample.
 */
export function OnboardingClient({
  orgId,
  mapId,
  alreadySeeded,
  hasBranding,
  hasIndoorMap,
  isPublished,
}: Props) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    if (alreadySeeded || seeding) return;
    setSeeding(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/seed-sample`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Seed failed");
      }
      const body = await res.json();
      const counts = body.counts ?? {};
      toast.success(
        `Seeded ${counts.news ?? 0} news, ${counts.events ?? 0} events, ${
          counts.clubs ?? 0
        } clubs, ${counts.dining ?? 0} dining.`,
      );
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <StepCard
        title="Try with sample data"
        body="Drops a believable starter set — 4 news, 3 events, 4 clubs, 3 dining — into this campus so the public page isn't empty."
        icon={<Sparkles size={20} strokeWidth={1.75} />}
        accent="purple"
        done={alreadySeeded}
        doneLabel="Content present"
      >
        <Button
          type="button"
          onClick={() => void seed()}
          disabled={alreadySeeded || seeding}
        >
          {alreadySeeded
            ? "Already populated"
            : seeding
              ? "Seeding…"
              : "Add sample data"}
        </Button>
      </StepCard>

      <StepCard
        title="Brand the campus"
        body="Name, logo, accent colour. The public site picks these up immediately — the consumer purple turns into your primary."
        icon={<Palette size={20} strokeWidth={1.75} />}
        accent="coral"
        done={hasBranding}
        doneLabel="Branding set"
      >
        <Link
          href={`/org/${orgId}/maps/${mapId}/identity`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          Open Identity
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </StepCard>

      <StepCard
        title="Connect MappedIn"
        body="Plug in the MappedIn venue id and the 3D map lights up for visitors — search, wayfinding, anchor chips all start working."
        icon={<MapIcon size={20} strokeWidth={1.75} />}
        accent="teal"
        done={hasIndoorMap}
        doneLabel="MappedIn linked"
      >
        <Link
          href={`/org/${orgId}/maps/${mapId}/map`}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          Open Map &amp; Wayfinding
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </StepCard>

      <Panel className="md:col-span-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <Megaphone size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {isPublished ? "Share with students" : "Publish &amp; share"}
              </p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {isPublished
                  ? "This campus is live. Grab the URL, the QR, or push a broadcast from Reach."
                  : "Publish from Reach, then hand students the URL or scan the QR. Broadcast composer lives there too."}
              </p>
            </div>
          </div>
          <Link
            href={`/org/${orgId}/maps/${mapId}/reach`}
            className="inline-flex items-center gap-1.5 rounded-full border border-solid border-line-soft bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent"
          >
            Open Reach
            <ArrowRight size={14} strokeWidth={1.75} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}

interface StepCardProps {
  title: string;
  body: string;
  icon: React.ReactNode;
  /** Drives the colored chip on the icon. Matches the consumer palette. */
  accent: "purple" | "coral" | "teal" | "pink";
  done: boolean;
  doneLabel: string;
  children: React.ReactNode;
}

const ACCENT_HEX: Record<StepCardProps["accent"], string> = {
  purple: "#534AB7",
  coral: "#D85A30",
  teal: "#1D9E75",
  pink: "#D4537E",
};

function StepCard({
  title,
  body,
  icon,
  accent,
  done,
  doneLabel,
  children,
}: StepCardProps) {
  return (
    <Panel className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: ACCENT_HEX[accent] }}
        >
          {icon}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[0.7rem] font-medium text-accent">
            <Check size={12} strokeWidth={2} />
            {doneLabel}
          </span>
        ) : null}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          {body}
        </p>
      </div>
      <div className="mt-auto pt-2">{children}</div>
    </Panel>
  );
}
