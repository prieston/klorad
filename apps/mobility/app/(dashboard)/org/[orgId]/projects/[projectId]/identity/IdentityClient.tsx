"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import {
  derivePalette,
  paletteToCssVars,
  type BrandPalette,
} from "@klorad/design-system/palette";
import {
  ImageIcon,
  MapPin,
  Palette,
  RefreshCcw,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Initial {
  title: string;
  thumbnail: string | null;
  sceneData: Record<string, unknown>;
  primaryColor: string;
  defaultCentre: { lat: number; lng: number };
  defaultZoom: number;
}

/**
 * Merge new branding fields into the existing `sceneData.mobility.branding`
 * slot without losing other Mobility config the project may carry.
 */
function withBranding(
  base: Record<string, unknown>,
  branding: {
    primaryColor: string;
    defaultCentre: { lat: number; lng: number };
    defaultZoom: number;
  },
): Record<string, unknown> {
  const mobility = ((base.mobility as Record<string, unknown>) ?? {}) as Record<
    string,
    unknown
  >;
  const existingBranding =
    (mobility.branding as Record<string, unknown>) ?? {};
  return {
    ...base,
    mobility: {
      ...mobility,
      branding: { ...existingBranding, ...branding },
    },
  };
}

export function IdentityClient({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Initial;
}) {
  const [title, setTitle] = useState(initial.title);
  const [thumbnail, setThumbnail] = useState(initial.thumbnail ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [centreLat, setCentreLat] = useState(String(initial.defaultCentre.lat));
  const [centreLng, setCentreLng] = useState(String(initial.defaultCentre.lng));
  const [zoom, setZoom] = useState(String(initial.defaultZoom));
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  const palette = useMemo(
    () => derivePalette(primaryColor),
    [primaryColor],
  );
  const themeStyle = useMemo(
    () => paletteToCssVars(palette),
    [palette],
  );

  const dirtyBrand =
    primaryColor !== initial.primaryColor ||
    (thumbnail || null) !== initial.thumbnail ||
    Number(centreLat) !== initial.defaultCentre.lat ||
    Number(centreLng) !== initial.defaultCentre.lng ||
    Number(zoom) !== initial.defaultZoom;

  const saveTitle = async () => {
    if (!title.trim()) {
      toast.error("Title can't be empty");
      return;
    }
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        toast.error(body.error ?? "Save failed");
        return;
      }
      toast.success("Renamed");
    } finally {
      setSavingTitle(false);
    }
  };

  const saveBrand = async () => {
    const lat = Number(centreLat);
    const lng = Number(centreLng);
    const z = Number(zoom);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error("Lat / Lng must be numbers");
      return;
    }
    if (Number.isNaN(z) || z < 1 || z > 22) {
      toast.error("Zoom must be between 1 and 22");
      return;
    }
    if (thumbnail && !/^https?:\/\//.test(thumbnail)) {
      toast.error("Logo URL must start with http(s)://");
      return;
    }
    setSavingBrand(true);
    try {
      const sceneData = withBranding(initial.sceneData ?? {}, {
        primaryColor,
        defaultCentre: { lat, lng },
        defaultZoom: z,
      });
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thumbnail: thumbnail ? thumbnail : null,
          sceneData,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        toast.error(body.error ?? "Save failed");
        return;
      }
      toast.success("Identity saved");
      // Reflect saved values as the new baseline.
      initial.thumbnail = thumbnail ? thumbnail : null;
      initial.primaryColor = primaryColor;
      initial.defaultCentre = { lat, lng };
      initial.defaultZoom = z;
    } finally {
      setSavingBrand(false);
    }
  };

  const resetBrand = () => {
    setPrimaryColor(initial.primaryColor);
    setThumbnail(initial.thumbnail ?? "");
    setCentreLat(String(initial.defaultCentre.lat));
    setCentreLng(String(initial.defaultCentre.lng));
    setZoom(String(initial.defaultZoom));
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-10">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {initial.title}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Identity.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          Per-project branding. The logo and primary colour drive the public
          traveller surface and the operator chrome; the default map centre
          and zoom decide where the operator console opens.
        </p>
      </header>

      {/* Name */}
      <Section
        icon={Type}
        title="Name"
        body="Shown in the sidebar, on every project card, and in the public traveller header."
      >
        <div className="grid gap-3 md:max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
          />
          <button
            type="button"
            onClick={saveTitle}
            disabled={savingTitle || title === initial.title}
            className="self-start rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {savingTitle ? "Saving…" : "Rename"}
          </button>
        </div>
      </Section>

      {/* Brand */}
      <Section
        icon={Palette}
        title="Brand"
        body="One hex chooses everything. The palette below is derived in OKLCH so accents stay balanced whatever you pick."
      >
        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          {/* Inputs */}
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
                Primary colour
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-12 cursor-pointer rounded-md border border-line-strong bg-bg p-0"
                />
                <input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-sm text-text-primary"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-text-tertiary">
                CSS hex. The operator console, public surface, and every
                Klorad UI primitive read this via `--brand-*` variables.
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
                Logo / hero URL
              </span>
              <div className="flex items-center gap-3">
                <input
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="https://…/logo.png"
                  className="flex-1 rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-xs text-text-primary"
                />
                {thumbnail ? (
                  <button
                    type="button"
                    onClick={() => setThumbnail("")}
                    className="rounded-md border border-line-strong px-3 py-2 text-xs font-medium text-text-tertiary transition-colors hover:border-red-500 hover:text-red-500"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <p className="mt-1.5 text-[11px] text-text-tertiary">
                Public-facing image. Uploads land in a follow-up; for now
                drop a hosted URL.
              </p>
            </label>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-line-soft bg-surface-2 p-5" style={themeStyle as React.CSSProperties}>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              <Sparkles size={11} strokeWidth={1.8} aria-hidden />
              Preview
            </div>
            {/* Brand card mock */}
            <div className="rounded-xl bg-bg p-5">
              <div className="flex items-center gap-3">
                {thumbnail ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-md bg-surface-2">
                    {/* Use unoptimised img so arbitrary URLs work without
                        Next.js image domain config. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-2 text-text-tertiary">
                    <ImageIcon size={16} strokeWidth={1.8} aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-text-primary">
                    {title || "Project name"}
                  </h3>
                  <p className="text-[11px] text-text-tertiary">
                    Public traveller map
                  </p>
                </div>
                <span
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
                  style={{
                    backgroundColor: palette.primary + "1a",
                    color: palette.primary,
                  }}
                >
                  Live
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <SwatchPreview palette={palette} />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-md px-3 py-2 text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: palette.primary }}
                >
                  Primary CTA
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-xs font-medium"
                  style={{
                    borderColor: palette.primarySoft,
                    color: palette.primaryInk,
                  }}
                >
                  Secondary
                </button>
              </div>
            </div>

            {/* Full swatch grid */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Swatch label="Primary" value={palette.primary} />
              <Swatch label="Fill" value={palette.primaryFill} />
              <Swatch label="Soft" value={palette.primarySoft} />
              <Swatch label="Ink" value={palette.primaryInk} />
              <Swatch label="Bg" value={palette.primaryBg} />
              <Swatch label="Warm" value={palette.accentWarm} />
              <Swatch label="Cool" value={palette.accentCool} />
              <Swatch label="Complement" value={palette.accentComplement} />
            </div>
          </div>
        </div>
      </Section>

      {/* Map defaults */}
      <Section
        icon={MapPin}
        title="Map defaults"
        body="Where the operator console opens, and how zoomed-in. Coordinates are WGS84."
      >
        <div className="grid gap-4 md:max-w-2xl md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              Latitude
            </span>
            <input
              value={centreLat}
              onChange={(e) => setCentreLat(e.target.value)}
              className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-sm text-text-primary"
              inputMode="decimal"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              Longitude
            </span>
            <input
              value={centreLng}
              onChange={(e) => setCentreLng(e.target.value)}
              className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-sm text-text-primary"
              inputMode="decimal"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              Zoom
            </span>
            <input
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
              className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 font-mono text-sm text-text-primary"
              inputMode="numeric"
            />
            <p className="mt-1 text-[10px] text-text-tertiary">1 – 22</p>
          </label>
        </div>
      </Section>

      {/* Save / Reset bar */}
      <section className="sticky bottom-4 mt-2 flex items-center gap-3 rounded-2xl border border-line-soft bg-bg/95 p-4 shadow-sm backdrop-blur">
        <span className="text-xs text-text-tertiary">
          {dirtyBrand ? "Unsaved changes" : "All changes saved"}
        </span>
        <button
          type="button"
          onClick={resetBrand}
          disabled={!dirtyBrand || savingBrand}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <RefreshCcw size={12} strokeWidth={1.8} />
          Reset
        </button>
        <button
          type="button"
          onClick={saveBrand}
          disabled={!dirtyBrand || savingBrand}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Wand2 size={12} strokeWidth={1.8} />
          {savingBrand ? "Saving…" : "Save identity"}
        </button>
      </section>
    </main>
  );
}

/* ─── Section wrapper ──────────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <Icon size={14} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-text-primary">{title}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ─── Swatch primitives ────────────────────────────────────────────── */

function Swatch({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line-soft bg-bg p-2 text-center">
      <div
        aria-hidden
        className="mx-auto h-8 w-8 rounded-md"
        style={{ backgroundColor: value }}
      />
      <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </p>
      <p className="font-mono text-[10px] text-text-secondary">{value}</p>
    </div>
  );
}

function SwatchPreview({ palette }: { palette: BrandPalette }) {
  const items: { label: string; bg: string; text: string }[] = [
    { label: "News", bg: palette.accentWarm + "1f", text: palette.accentWarm },
    { label: "Info", bg: palette.accentCool + "1f", text: palette.accentCool },
    {
      label: "Alert",
      bg: palette.accentComplement + "1f",
      text: palette.accentComplement,
    },
  ];
  return (
    <>
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-md px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]"
          style={{ backgroundColor: it.bg, color: it.text }}
        >
          {it.label}
        </div>
      ))}
    </>
  );
}

// Suppress unused-import warning for Image when the no-img-element rule
// pushes us off it.
export const _reservedImage = Image;
