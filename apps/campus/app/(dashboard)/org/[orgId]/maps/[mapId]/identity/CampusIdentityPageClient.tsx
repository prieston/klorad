"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import { MapPin, Palette, Upload } from "lucide-react";
import { Button, Field, Input, Panel } from "@klorad/design-system";
import { uploadFile } from "@klorad/storage/client";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";
import { PhonePreview } from "@/app/(dashboard)/components/PhonePreview";
import { UPLOAD_PREFIXES } from "@/lib/uploads/prefixes";
import { deriveCampusPalette } from "@/lib/palette";

// LocationPicker pulls in mapbox-gl (~half a megabyte). Most rectors
// brand first and scroll to Location later, so defer the chunk —
// the panel mounts with a skeleton until the user reaches it.
const LocationPicker = dynamic(
  () => import("./LocationPicker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] animate-pulse rounded-xl bg-surface-2" />
    ),
  },
);

interface Props {
  orgId: string;
  mapId: string;
}

interface CampusBranding {
  name?: string;
  nameEl?: string;
  shortName?: string;
  logo?: string;
  primaryColor?: string;
  indoorMapId?: string;
}

interface HomePageConfig {
  heroImage?: string;
  headline?: { en?: string; el?: string };
  tagline?: { en?: string; el?: string };
}

interface SceneData {
  branding?: CampusBranding;
  homePage?: HomePageConfig;
  /** Mapbox scene bundle written by the Workbench. The campus's
   *  geographic location lives at `mapboxScene.center` as `[lng, lat]`. */
  mapboxScene?: {
    center?: [number, number];
    [k: string]: unknown;
  };
  /** Legacy field (pre-Workbench rows wrote here). Still read by the
   *  org world map as a fallback, but new writes always go to
   *  `mapboxScene.center`. */
  center?: [number, number];
  [k: string]: unknown;
}

interface MapResponse {
  id: string;
  title: string;
  thumbnail?: string | null;
  sceneData?: SceneData;
}

const fetcher = (url: string): Promise<MapResponse> =>
  fetch(url).then((r) => r.json());

/** Eight curated brand-colour starters. Hand-picked across the OKLCH
 *  hue wheel so the swatches stay visually distinct + every option
 *  produces a coherent derived palette via `deriveCampusPalette`. */
const COLOR_PRESETS = [
  "#534ab7", // Klorad purple
  "#158ca3", // teal (IHU)
  "#1976d2", // royal blue
  "#0e7c4a", // forest
  "#c25700", // burnt orange
  "#b22d68", // berry
  "#7e3a98", // amethyst
  "#1f2937", // slate near-black
];

/** Limit for the PWA install label. iOS truncates anything longer. */
const SHORT_NAME_MAX = 12;

function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** Short version of a campus name — used as the PWA home-screen
 *  label when the rector hasn't typed their own. Trim, cap at the
 *  iOS limit, keep words intact when possible. */
function deriveShortName(name: string): string {
  const clean = name.trim();
  if (clean.length <= SHORT_NAME_MAX) return clean;
  const words = clean.split(/\s+/);
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > SHORT_NAME_MAX) break;
    out = next;
  }
  return out || clean.slice(0, SHORT_NAME_MAX);
}

/**
 * Identity & branding — the screen rectors land on to white-label
 * their campus. Single page, no tabs: name, logo, hero, colour, all
 * visible at once. Live phone preview on the right (lg+) so every
 * change shows up in the iframe after a save.
 *
 * Persistence model: everything lives in `Project.sceneData`. We
 * read once on mount via SWR, the form holds the in-flight edit
 * state, Save PATCHes the merged scene back. The public consumer
 * routes pick up the new state on their next request (60s cache TTL
 * via `getPublicCampusByToken`); the preview is refreshed in-place
 * via `PhonePreview`'s reloadToken.
 *
 * Zero-required-input principle: if the rector hits Save with no
 * logo or hero uploaded, the public surface still works — the nav
 * falls back to a clean wordmark, the home falls back to the
 * platform hero image. Their primary colour cascades into every
 * tinted surface via the layout's CSS-var injection.
 */
export default function CampusIdentityPageClient({
  orgId: _orgId,
  mapId,
}: Props) {
  const { data: server, isLoading } = useSWR<MapResponse>(
    `/api/maps/${mapId}`,
    fetcher,
  );

  // Form state — initialised once from the server, edits stay local
  // until Save. Lang toggle is UI-only, not persisted.
  const [lang, setLang] = useState<"en" | "el">("en");
  const [name, setName] = useState("");
  const [nameEl, setNameEl] = useState("");
  const [shortName, setShortName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Hydrate the form from the server response — exactly once. SWR
  // revalidates on focus (which the file picker triggers!); re-running
  // this on every revalidation would clobber unsaved edits including
  // a just-uploaded image.
  useEffect(() => {
    if (hydrated || !server) return;
    const branding = server.sceneData?.branding ?? {};
    const home = server.sceneData?.homePage ?? {};
    // Coordinates live at `mapboxScene.center`; pre-Workbench rows
    // wrote to `sceneData.center`. Read both, write only the new
    // location on save. `[0, 0]` is the legacy "not set" sentinel
    // used by OrgWorldMap, treat it as null here so the picker
    // doesn't show a bogus pin off the coast of Africa.
    const rawCenter =
      server.sceneData?.mapboxScene?.center ?? server.sceneData?.center;
    const isRealCenter =
      Array.isArray(rawCenter) &&
      typeof rawCenter[0] === "number" &&
      typeof rawCenter[1] === "number" &&
      !(rawCenter[0] === 0 && rawCenter[1] === 0);
    setName(branding.name ?? server.title ?? "");
    setNameEl(branding.nameEl ?? "");
    setShortName(branding.shortName ?? "");
    setLogoUrl(branding.logo ?? "");
    setHeroUrl(home.heroImage ?? "");
    setThumbnailUrl(server.thumbnail ?? "");
    setPrimaryColor(branding.primaryColor ?? "");
    setCenter(isRealCenter ? [rawCenter[0], rawCenter[1]] : null);
    setHydrated(true);
  }, [hydrated, server]);

  // Derived palette preview — recompute on every primaryColor change.
  // Memoised so the 8 tile re-render doesn't cost a parse-per-paint.
  const palette = useMemo(
    () => deriveCampusPalette(primaryColor || undefined),
    [primaryColor],
  );

  // Compare current form state to what the server has — `Save` is
  // disabled when nothing changed. The shortName comparison treats
  // empty as equivalent to the auto-derived value so flipping the
  // box and back doesn't look dirty.
  const dirty = useMemo(() => {
    if (!hydrated || !server) return false;
    const b = server.sceneData?.branding ?? {};
    const h = server.sceneData?.homePage ?? {};
    const rawCenter =
      server.sceneData?.mapboxScene?.center ?? server.sceneData?.center;
    const savedCenter: [number, number] | null =
      Array.isArray(rawCenter) &&
      typeof rawCenter[0] === "number" &&
      typeof rawCenter[1] === "number" &&
      !(rawCenter[0] === 0 && rawCenter[1] === 0)
        ? [rawCenter[0], rawCenter[1]]
        : null;
    const centerChanged =
      (center === null) !== (savedCenter === null) ||
      (center !== null &&
        savedCenter !== null &&
        (Math.abs(center[0] - savedCenter[0]) > 0.000001 ||
          Math.abs(center[1] - savedCenter[1]) > 0.000001));
    return (
      name !== (b.name ?? server.title ?? "") ||
      nameEl !== (b.nameEl ?? "") ||
      shortName !== (b.shortName ?? "") ||
      logoUrl !== (b.logo ?? "") ||
      heroUrl !== (h.heroImage ?? "") ||
      thumbnailUrl !== (server.thumbnail ?? "") ||
      primaryColor !== (b.primaryColor ?? "") ||
      centerChanged
    );
  }, [
    hydrated,
    server,
    name,
    nameEl,
    shortName,
    logoUrl,
    heroUrl,
    thumbnailUrl,
    primaryColor,
    center,
  ]);

  const handleUpload = async (
    file: File,
    target: "logo" | "hero" | "thumbnail",
  ) => {
    const setter =
      target === "logo"
        ? setLogoUrl
        : target === "hero"
          ? setHeroUrl
          : setThumbnailUrl;
    const busy =
      target === "logo"
        ? setUploadingLogo
        : target === "hero"
          ? setUploadingHero
          : setUploadingThumbnail;
    // The card image lives in a different prefix so it's bucketed
    // alongside the existing list-card thumbnails for tooling /
    // moderation reviews.
    const prefix =
      target === "thumbnail"
        ? UPLOAD_PREFIXES.thumbnails
        : UPLOAD_PREFIXES.branding;
    busy(true);
    try {
      const result = await uploadFile(file, { prefix });
      setter(result.publicUrl);
      const label =
        target === "logo"
          ? "Logo"
          : target === "hero"
            ? "Hero"
            : "Card image";
      toast.success(`${label} uploaded`);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      busy(false);
    }
  };

  // Stable reference — `LocationPicker` calls this from inside its
  // own effects, so an unstable inline lambda would re-trigger its
  // mount/sync passes on every parent render.
  const handleLocationChange = useCallback(
    (next: [number, number] | null) => {
      setCenter(next);
    },
    [],
  );

  const handleSave = async () => {
    if (!server || !dirty || saving) return;
    setSaving(true);
    try {
      // Merge — never replace — `sceneData`. The Map screen owns
      // `indoorMapId`, the Home screen owns the headline / tagline,
      // and we don't want to wipe their edits.
      const trimmedShort = shortName.trim();
      const nextBranding: CampusBranding = {
        ...(server.sceneData?.branding ?? {}),
        name: name.trim() || undefined,
        nameEl: nameEl.trim() || undefined,
        shortName:
          trimmedShort && trimmedShort !== deriveShortName(name)
            ? trimmedShort
            : undefined,
        logo: logoUrl.trim() || undefined,
        primaryColor:
          primaryColor.trim() && isHex(primaryColor) ? primaryColor : undefined,
      };
      const nextHome: HomePageConfig = {
        ...(server.sceneData?.homePage ?? {}),
        heroImage: heroUrl.trim() || undefined,
      };
      // Write coordinates to `mapboxScene.center` — same shape the
      // Workbench writes — so the org-tier world map and any future
      // Workbench-side reads agree. We also strip the legacy
      // top-level `center` on save so the two locations don't
      // diverge over time.
      const existingScene = { ...(server.sceneData?.mapboxScene ?? {}) };
      if (center !== null) {
        existingScene.center = center;
      } else {
        delete existingScene.center;
      }
      const sceneWithoutLegacyCenter = { ...(server.sceneData ?? {}) };
      delete sceneWithoutLegacyCenter.center;
      const nextScene: SceneData = {
        ...sceneWithoutLegacyCenter,
        branding: nextBranding,
        homePage: nextHome,
        mapboxScene: existingScene,
      };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneData: nextScene,
          // Card image is a top-level Project column, not part of
          // sceneData — that's where the campus list + public viewer
          // fallback hero both read it from.
          thumbnail: thumbnailUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await globalMutate(`/api/maps/${mapId}`);
      toast.success("Branding updated");
      // Bump the preview's reload token so the iframe reruns its
      // server fetch and the rector sees the change immediately.
      setPreviewKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !hydrated) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-6 py-8 md:px-10">
        <div className="h-12 w-1/3 animate-pulse rounded-md bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }

  // Derive an effective short-name preview — what would land on the
  // home-screen install today.
  const effectiveShortName =
    shortName.trim() || deriveShortName(name) || "Campus";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Manage"
        title="Identity & branding"
        subtitle="Everything that makes the campus look like itself. Edits here recolor the public viewer and the mobile install icon."
        actions={
          <>
            <OpenPublicAction href={`/campus/${mapId}`} />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {/* ─ Campus identity ────────────────────────────────────── */}
          <Panel className="rounded-2xl p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Campus identity
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Used in the nav, share card and PWA install icon.
                </p>
              </div>
              <LangToggle lang={lang} onChange={setLang} />
            </div>
            <div className="space-y-5">
              <Field
                label={
                  lang === "en" ? "Campus name · EN" : "Campus name · ΕΛ"
                }
                hint="Shown in the top nav and the share card title."
              >
                <Input
                  value={lang === "en" ? name : nameEl}
                  onChange={(e) =>
                    (lang === "en" ? setName : setNameEl)(e.target.value)
                  }
                  placeholder={lang === "en" ? "Thermi (HQ)" : "Θέρμη"}
                />
              </Field>
              <Field
                label="Short name"
                hint={`Label under the PWA install icon. Up to ${SHORT_NAME_MAX} chars. Defaults to a smart trim of the name.`}
              >
                <Input
                  value={shortName}
                  onChange={(e) =>
                    setShortName(e.target.value.slice(0, SHORT_NAME_MAX))
                  }
                  placeholder={effectiveShortName}
                  maxLength={SHORT_NAME_MAX}
                />
              </Field>
            </div>
          </Panel>

          {/* ─ Brand assets ───────────────────────────────────────── */}
          <Panel className="rounded-2xl p-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Logo &amp; hero
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Skip them and the campus still looks great — we derive a
                clean wordmark from the campus name + your primary colour.
              </p>
            </div>
            <div className="space-y-6">
              <UploadField
                label="Logo"
                hint="Square-ish PNG or SVG, transparent background. Used in the nav and as the install icon."
                value={logoUrl}
                preview={
                  logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-contain"
                    />
                  ) : (
                    <LogoPlaceholder
                      name={name || "Campus"}
                      color={palette.primary}
                    />
                  )
                }
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                uploading={uploadingLogo}
                onUpload={(file) => handleUpload(file, "logo")}
                onClear={() => setLogoUrl("")}
              />
              <UploadField
                label="Hero image"
                hint="Wide image (≈1600×600), used behind the greeting on the public home."
                value={heroUrl}
                preview={
                  heroUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroUrl}
                      alt=""
                      className="block h-20 w-32 rounded-md object-cover"
                    />
                  ) : (
                    <HeroPlaceholder
                      color={palette.primary}
                      fill={palette.primaryFill}
                    />
                  )
                }
                accept="image/png,image/jpeg,image/webp"
                uploading={uploadingHero}
                onUpload={(file) => handleUpload(file, "hero")}
                onClear={() => setHeroUrl("")}
              />
              <UploadField
                label="Card image"
                hint="Shown on the campus list card and the org world map's pin tooltip. Falls back to the hero if you skip it."
                value={thumbnailUrl}
                preview={
                  thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="block h-20 w-32 rounded-md object-cover"
                    />
                  ) : heroUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroUrl}
                      alt=""
                      className="block h-20 w-32 rounded-md object-cover opacity-60"
                    />
                  ) : (
                    <HeroPlaceholder
                      color={palette.primary}
                      fill={palette.primaryFill}
                    />
                  )
                }
                accept="image/png,image/jpeg,image/webp"
                uploading={uploadingThumbnail}
                onUpload={(file) => handleUpload(file, "thumbnail")}
                onClear={() => setThumbnailUrl("")}
              />
            </div>
          </Panel>

          {/* ─ Location ────────────────────────────────────────────── */}
          <Panel className="rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <MapPin size={16} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Location
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Drops a pin on the org dashboard&rsquo;s world map and lets
                  the public viewer centre on the right place. Search an
                  address or click anywhere to set.
                </p>
              </div>
            </div>
            <LocationPicker value={center} onChange={handleLocationChange} />
          </Panel>

          {/* ─ Primary colour ─────────────────────────────────────── */}
          <Panel className="rounded-2xl p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Palette size={16} strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Primary colour
                </h2>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  One hex — the entire public surface derives from this:
                  accents, buttons, the mobile browser chrome tint, even
                  the dot-pattern in the share card.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((hex) => {
                  const active =
                    primaryColor.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setPrimaryColor(hex)}
                      aria-label={`Use ${hex}`}
                      aria-pressed={active}
                      className={`h-8 w-8 rounded-full ring-2 transition-all ${
                        active
                          ? "ring-offset-2 ring-offset-bg ring-text-primary"
                          : "ring-transparent hover:ring-line-strong"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>

              <Field label="Custom hex">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Pick a colour"
                    value={isHex(primaryColor) ? primaryColor : palette.primary}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-line-soft bg-transparent"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#534ab7"
                    spellCheck={false}
                  />
                </div>
              </Field>

              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                  Derived palette
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {[
                    ["Primary", palette.primary],
                    ["Fill", palette.primaryFill],
                    ["Soft", palette.primarySoft],
                    ["Bg", palette.primaryBg],
                    ["Ink", palette.primaryInk],
                    ["Warm", palette.accentWarm],
                    ["Cool", palette.accentCool],
                    ["Comp.", palette.accentComplement],
                  ].map(([label, color]) => (
                    <div key={label} className="text-center">
                      <div
                        className="mb-1 h-12 w-full rounded-lg"
                        style={{ backgroundColor: color }}
                        aria-label={`${label}: ${color}`}
                      />
                      <div className="truncate text-[10px] font-medium text-text-secondary">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* ─ Live preview ─────────────────────────────────────────── */}
        <aside className="hidden lg:block">
          <PhonePreview
            src={`/campus/${mapId}`}
            title="Public campus preview"
            reloadToken={previewKey}
          />
        </aside>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function LangToggle({
  lang,
  onChange,
}: {
  lang: "en" | "el";
  onChange: (l: "en" | "el") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Language"
      className="inline-flex rounded-full bg-surface-2 p-0.5"
    >
      {(["en", "el"] as const).map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(l)}
            className={
              active
                ? "rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                : "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary hover:text-text-primary"
            }
          >
            {l === "en" ? "EN" : "ΕΛ"}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

interface UploadFieldProps {
  label: string;
  hint?: string;
  value: string;
  preview: React.ReactNode;
  accept: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}

/**
 * Compact upload row — visible preview on the left, Upload + Clear
 * buttons on the right, file input hidden under the label so the
 * whole control reads as one tap target.
 */
function UploadField({
  label,
  hint,
  value,
  preview,
  accept,
  uploading,
  onUpload,
  onClear,
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-text-primary">{label}</div>
      <div className="flex items-center gap-4 rounded-xl border border-line-soft bg-surface-2/40 p-3">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-1">
          {preview}
        </div>
        <div className="min-w-0 flex-1">
          {hint ? (
            <p className="mb-2 text-xs text-text-tertiary">{hint}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={12} strokeWidth={1.75} aria-hidden />
              {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
            </Button>
            {value ? (
              <Button size="sm" variant="ghost" onClick={onClear}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

/**
 * Default logo placeholder — clean monogram in the rector's primary
 * colour. Renders the first 1-2 letters of the campus name on a
 * tinted square. Better than a generic stock logo because it's
 * *theirs*: campus name + their colour.
 */
function LogoPlaceholder({ name, color }: { name: string; color: string }) {
  const initials = useMemo(() => {
    const parts = name
      .replace(/[^A-Za-zΑ-Ωα-ω\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "K";
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }, [name]);
  return (
    <div
      className="flex h-12 w-12 items-center justify-center rounded-lg text-base font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

/**
 * Default hero placeholder — gradient using the rector's primary +
 * primaryFill, dot-pattern overlay. Same visual register as the
 * campus cards in the org grid; gives the rector "their colour, in
 * real estate" before they upload a real photo.
 */
function HeroPlaceholder({
  color,
  fill,
}: {
  color: string;
  fill: string;
}) {
  return (
    <div
      className="block h-20 w-32 rounded-md"
      aria-hidden
      style={{
        background: `radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px) 0 0/12px 12px, linear-gradient(135deg, ${color} 0%, ${fill} 100%)`,
      }}
    />
  );
}

