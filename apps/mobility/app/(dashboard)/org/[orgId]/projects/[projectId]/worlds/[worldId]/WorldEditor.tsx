"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Globe2,
  Image as ImageIcon,
  Link2,
  Lock,
  MapPin,
  Palette,
  Search,
  Send,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { subsystemIcon as pickSubsystemIcon } from "@/lib/mobility/subsystem-icon";

type Visibility = "public" | "linkOnly" | "authenticated";

interface World {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  isPublished: boolean;
  publishedAt: string | null;
  subscriberCount: number;
  theme: Record<string, unknown>;
}

interface Device {
  id: string;
  name: string;
  subsystem: string;
  primaryRoad: string | null;
  crossRoad: string | null;
  hasLocation: boolean;
}

interface WorldStats {
  subscribers: number;
  views7d: number;
  installs: number;
  broadcastCount: number;
  lastBroadcastAt: string | null;
}

interface Props {
  orgId: string;
  projectId: string;
  projectTitle: string;
  world: World;
  initialDeviceIds: string[];
  devicePool: Device[];
  stats: WorldStats;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function WorldEditor({
  orgId,
  projectId,
  projectTitle,
  world,
  initialDeviceIds,
  devicePool,
  stats,
}: Props) {
  const router = useRouter();

  // Settings form
  const [name, setName] = useState(world.name);
  const [slug, setSlug] = useState(world.slug);
  const [description, setDescription] = useState(world.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(world.visibility);
  const [savingSettings, setSavingSettings] = useState(false);

  // Device picker
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialDeviceIds),
  );
  const [savingDevices, setSavingDevices] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSubsystem, setFilterSubsystem] = useState<string>("all");

  const subsystems = useMemo(() => {
    const s = new Set<string>();
    devicePool.forEach((d) => s.add(d.subsystem));
    return Array.from(s).sort();
  }, [devicePool]);

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devicePool.filter((d) => {
      if (filterSubsystem !== "all" && d.subsystem !== filterSubsystem) {
        return false;
      }
      if (!q) return true;
      const hay = `${d.name} ${d.primaryRoad ?? ""} ${d.crossRoad ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [devicePool, search, filterSubsystem]);

  const selectedInPool = filteredPool.filter((d) => selected.has(d.id)).length;
  const allInPoolSelected =
    filteredPool.length > 0 && selectedInPool === filteredPool.length;

  function toggleDevice(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allInPoolSelected) {
        filteredPool.forEach((d) => next.delete(d.id));
      } else {
        filteredPool.forEach((d) => next.add(d.id));
      }
      return next;
    });
  }

  async function saveSettings() {
    if (name.trim().length === 0) {
      toast.error("Name is required.");
      return;
    }
    if (!SLUG_RE.test(slug)) {
      toast.error("Slug format is invalid.");
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          visibility,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to save world");
      }
      toast.success("World saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveDevices() {
    setSavingDevices(true);
    try {
      const res = await fetch(`/api/worlds/${world.id}/devices`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to save devices");
      }
      const data = (await res.json()) as { count: number };
      toast.success(`${data.count} devices saved`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingDevices(false);
    }
  }

  async function deleteWorld() {
    if (
      !confirm(
        `Delete "${world.name}"? Installed PWAs will lose access. This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/worlds/${world.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to delete");
      }
      toast.success("World deleted");
      router.push(`/org/${orgId}/projects/${projectId}/worlds`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <Link
        href={`/org/${orgId}/projects/${projectId}/worlds`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-secondary"
      >
        <ArrowLeft size={12} strokeWidth={1.8} aria-hidden />
        All worlds
      </Link>

      <header className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
            {projectTitle}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-text-primary">
            {world.name}
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${
                world.isPublished ? "bg-emerald-500" : "bg-text-tertiary"
              }`}
            />
            <span className="text-xs font-medium text-text-tertiary">
              {world.isPublished ? "Published" : "Draft"}
            </span>
          </h1>
        </div>
      </header>

      {/* Settings card */}
      <section className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5">
        <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
        <p className="mt-1 text-xs text-text-secondary">
          The slug becomes the PWA&apos;s URL; renaming it after publish
          breaks installed apps and push subscriptions.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-xs font-medium text-text-secondary">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            URL slug
            <div className="mt-1 flex items-stretch overflow-hidden rounded-md border border-line-soft focus-within:border-accent">
              <span className="flex items-center bg-surface-2 px-2.5 font-mono text-[11px] text-text-tertiary">
                /w/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={world.isPublished}
                className="block w-full bg-bg px-3 py-2 font-mono text-sm text-text-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-tertiary"
              />
            </div>
            {world.isPublished ? (
              <span className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                <AlertTriangle size={11} strokeWidth={1.8} aria-hidden />
                Unpublish to rename.
              </span>
            ) : null}
          </label>
        </div>

        <label className="mt-4 block text-xs font-medium text-text-secondary">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={280}
            className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-text-secondary">
            Visibility
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <VisibilityOption
              value="public"
              current={visibility}
              onSelect={setVisibility}
              icon={Globe2}
              label="Public"
              description="Indexed. Anyone with the URL."
            />
            <VisibilityOption
              value="linkOnly"
              current={visibility}
              onSelect={setVisibility}
              icon={Link2}
              label="Link only"
              description="Not indexed. Anyone with the URL."
            />
            <VisibilityOption
              value="authenticated"
              current={visibility}
              onSelect={setVisibility}
              icon={Lock}
              label="Authenticated"
              description="Sign-in required (PR4)."
            />
          </div>
        </fieldset>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={deleteWorld}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-soft px-3 py-1.5 text-xs font-medium text-rose-500 transition-colors hover:border-rose-500/40"
          >
            <Trash2 size={12} strokeWidth={1.8} aria-hidden />
            Delete world
          </button>
          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
          >
            {savingSettings ? "Saving…" : "Save settings"}
          </button>
        </div>
      </section>

      {/* Publish + live URL */}
      <PublishCard world={world} />

      {/* Stats */}
      <StatsCard stats={stats} />

      {/* Theme */}
      <ThemeCard world={world} />

      {/* Broadcast */}
      <BroadcastCard world={world} />

      {/* Device picker */}
      <section className="rounded-2xl border border-line-soft bg-surface-1/40 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Devices</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Pick which curated devices appear in this world. Only{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">
                included
              </code>{" "}
              devices from this project are eligible.
            </p>
          </div>
          <div className="text-xs font-medium text-text-secondary">
            <span className="text-text-primary">{selected.size}</span>{" "}
            selected · {devicePool.length} eligible
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={12}
              strokeWidth={1.8}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or road…"
              className="block w-full rounded-md border border-line-soft bg-bg py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
          <select
            value={filterSubsystem}
            onChange={(e) => setFilterSubsystem(e.target.value)}
            className="rounded-md border border-line-soft bg-bg px-3 py-2 text-xs font-medium text-text-secondary focus:border-accent focus:outline-none"
          >
            <option value="all">All subsystems</option>
            {subsystems.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
          {filteredPool.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllVisible}
              className="rounded-md border border-line-soft px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
            >
              {allInPoolSelected ? "Clear visible" : "Select visible"}
            </button>
          ) : null}
        </div>

        {devicePool.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-line-soft py-12 text-center text-xs text-text-tertiary">
            No curated devices in this project yet — include some from
            the Devices tab first.
          </div>
        ) : (
          <ul className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-line-soft">
            {filteredPool.map((d) => {
              const checked = selected.has(d.id);
              return (
                <li
                  key={d.id}
                  className="border-b border-line-soft last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => toggleDevice(d.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      checked ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-accent bg-accent text-accent-contrast"
                          : "border-line-strong bg-bg"
                      }`}
                      aria-hidden
                    >
                      {checked ? (
                        <Check size={10} strokeWidth={2.4} />
                      ) : null}
                    </span>
                    <SubsystemIcon subsystem={d.subsystem} />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-medium text-text-primary">
                        {d.name}
                      </span>
                      <span className="block truncate text-[11px] text-text-tertiary">
                        {[d.primaryRoad, d.crossRoad].filter(Boolean).join(" · ") ||
                          "No locator"}
                      </span>
                    </span>
                    {!d.hasLocation ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        <MapPin size={9} strokeWidth={2} aria-hidden />
                        No coords
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={saveDevices}
            disabled={savingDevices || devicePool.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
          >
            {savingDevices ? "Saving…" : "Save device selection"}
          </button>
        </div>
      </section>
    </main>
  );
}

/* ───────────────────── Publish + live URL ─────────────────────── */

function PublishCard({ world }: { world: World }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl =
    typeof window === "undefined" ? `/w/${world.slug}` : `${window.location.origin}/w/${world.slug}`;

  async function togglePublish() {
    if (world.isPublished) {
      if (!confirm(`Unpublish "${world.name}"? Installed PWAs will stop receiving updates.`)) {
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublished: !world.isPublished }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to update world");
      }
      toast.success(world.isPublished ? "World unpublished" : "World published");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      toast.error("Clipboard unavailable — copy the URL manually.");
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {world.isPublished ? (
              <>
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Published
              </>
            ) : (
              <>
                <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-text-tertiary" />
                Draft
              </>
            )}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            {world.isPublished
              ? "The world is live. Stakeholders can install the PWA and opt into alerts."
              : "Drafts are operator-only. Publish to make the world reachable at its public URL."}
          </p>
        </div>
        <button
          type="button"
          onClick={togglePublish}
          disabled={busy}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
            world.isPublished
              ? "border-line-soft text-text-secondary hover:border-line-strong hover:text-text-primary"
              : "border-accent bg-accent text-accent-contrast hover:bg-accent-strong"
          }`}
        >
          {busy ? "Working…" : world.isPublished ? "Unpublish" : "Publish"}
        </button>
      </div>

      {world.isPublished ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line-soft bg-bg px-3 py-2">
          <code className="flex-1 truncate font-mono text-xs text-text-primary">{publicUrl}</code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md border border-line-soft px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
          >
            <Copy size={11} strokeWidth={1.8} aria-hidden />
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-line-soft px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
          >
            <ExternalLink size={11} strokeWidth={1.8} aria-hidden />
            Open
          </a>
        </div>
      ) : null}
    </section>
  );
}

/* ───────────────────── Analytics ──────────────────────────────── */

function StatsCard({ stats }: { stats: WorldStats }) {
  return (
    <section className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <BarChart3 size={14} strokeWidth={1.8} aria-hidden />
        Analytics
      </h2>
      <p className="mt-1 text-xs text-text-secondary">
        Anonymous, visitor-deduped. Views are 7-day uniques; installs are
        lifetime.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          icon={Eye}
          label="Views (7d)"
          value={formatNumber(stats.views7d)}
        />
        <Stat
          icon={Download}
          label="Installs"
          value={formatNumber(stats.installs)}
        />
        <Stat
          icon={Users}
          label="Subscribers"
          value={formatNumber(stats.subscribers)}
        />
        <Stat
          icon={Send}
          label="Broadcasts"
          value={formatNumber(stats.broadcastCount)}
          hint={
            stats.lastBroadcastAt
              ? `Last ${formatRelative(stats.lastBroadcastAt)}`
              : "None yet"
          }
        />
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line-soft bg-bg px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-text-tertiary">
        <Icon size={10} strokeWidth={1.8} aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ───────────────────── Theme + branding ───────────────────────── */

const DEFAULT_PRIMARY = "#0ea5e9";
const DEFAULT_BG = "#0b1220";

function pickHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value;
  }
  return fallback;
}

function ThemeCard({ world }: { world: World }) {
  const router = useRouter();
  const [primary, setPrimary] = useState(pickHex(world.theme.primaryColor, DEFAULT_PRIMARY));
  const [bg, setBg] = useState(pickHex(world.theme.backgroundColor, DEFAULT_BG));
  const [logoUrl, setLogoUrl] = useState(
    typeof world.theme.logoUrl === "string" ? world.theme.logoUrl : "",
  );
  const [tagline, setTagline] = useState(
    typeof world.theme.tagline === "string" ? world.theme.tagline : "",
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const theme: Record<string, unknown> = { ...world.theme };
      theme.primaryColor = primary;
      theme.backgroundColor = bg;
      const trimmedLogo = logoUrl.trim();
      if (trimmedLogo) theme.logoUrl = trimmedLogo;
      else delete theme.logoUrl;
      const trimmedTagline = tagline.trim();
      if (trimmedTagline) theme.tagline = trimmedTagline;
      else delete theme.tagline;

      const res = await fetch(`/api/worlds/${world.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save theme");
      }
      toast.success("Theme saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPrimary(DEFAULT_PRIMARY);
    setBg(DEFAULT_BG);
    setLogoUrl("");
    setTagline("");
  }

  return (
    <section className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Palette size={14} strokeWidth={1.8} aria-hidden />
        Theme &amp; branding
      </h2>
      <p className="mt-1 text-xs text-text-secondary">
        Drives the public PWA&apos;s chrome — install icon, splash, header.
        Changes apply on the next visit; installed PWAs pick them up after
        an app re-open.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Primary"
              value={primary}
              onChange={setPrimary}
              description="Markers, chips, links."
            />
            <ColorField
              label="Background"
              value={bg}
              onChange={setBg}
              description="Page + chrome backdrop."
            />
          </div>
          <label className="block text-xs font-medium text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon size={11} strokeWidth={1.8} aria-hidden />
              Logo URL
              <span className="text-text-tertiary">(square, 256px+ recommended)</span>
            </span>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.svg"
              className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            Tagline <span className="text-text-tertiary">(optional, overrides description on the header)</span>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={160}
              className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <ThemePreview
          primary={primary}
          bg={bg}
          logoUrl={logoUrl}
          name={world.name}
          tagline={tagline || world.description || ""}
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-line-soft px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
        >
          Reset to defaults
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save theme"}
        </button>
      </div>
    </section>
  );
}

function ColorField({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  description: string;
}) {
  return (
    <label className="block text-xs font-medium text-text-secondary">
      {label}
      <div className="mt-1 flex items-center gap-2 rounded-md border border-line-soft bg-bg p-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent font-mono text-xs text-text-primary focus:outline-none"
          maxLength={7}
        />
      </div>
      <span className="mt-0.5 block text-[10px] text-text-tertiary">{description}</span>
    </label>
  );
}

function ThemePreview({
  primary,
  bg,
  logoUrl,
  name,
  tagline,
}: {
  primary: string;
  bg: string;
  logoUrl: string;
  name: string;
  tagline: string;
}) {
  return (
    <div
      className="flex h-full min-h-[180px] flex-col justify-end overflow-hidden rounded-xl border border-line-soft p-4 text-white shadow-inner"
      style={{ backgroundColor: bg }}
      aria-label="Theme preview"
    >
      <div className="flex items-center gap-2">
        {logoUrl ? (
          // Plain <img> is intentional — the URL is operator-provided
          // and may live on any host. next/image would force a
          // remote-pattern config per tenant which is the wrong shape.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-7 w-7 rounded-md object-cover"
          />
        ) : (
          <span
            className="inline-block h-7 w-7 rounded-md"
            style={{ backgroundColor: primary, opacity: 0.85 }}
          />
        )}
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/60">
          Klorad Mobility
        </p>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{name}</h3>
      {tagline ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-white/70">{tagline}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-white/50">
        Sample chip:&nbsp;
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${primary}33`, color: primary }}
        >
          Live
        </span>
      </p>
    </div>
  );
}

/* ───────────────────── Broadcast composer ─────────────────────── */

function BroadcastCard({ world }: { world: World }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const canSend =
    world.isPublished &&
    world.subscriberCount > 0 &&
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !sending;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch(`/api/worlds/${world.id}/broadcast`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; attempted?: number; delivered?: number; pruned?: number; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Broadcast failed");
      }
      toast.success(
        `Sent to ${data?.delivered ?? 0} of ${data?.attempted ?? 0} subscribers`,
      );
      setTitle("");
      setBody("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  let reason: string | null = null;
  if (!world.isPublished) {
    reason = "Publish the world before broadcasting.";
  } else if (world.subscriberCount === 0) {
    reason = "No subscribers yet — visit the world and enable alerts to test.";
  }

  return (
    <section className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Bell size={14} strokeWidth={1.8} aria-hidden />
          Broadcast
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
          <Users size={11} strokeWidth={1.8} aria-hidden />
          {world.subscriberCount} subscriber{world.subscriberCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        Push a one-shot alert to every subscriber of this world. Use sparingly —
        repeat broadcasts collapse on the device.
      </p>

      <form onSubmit={send} className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-text-secondary">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Egnatia Odos — Lane closure"
            className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block text-xs font-medium text-text-secondary">
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={280}
            rows={2}
            placeholder="Two lanes closed at KM 42 until 18:00 — expect delays."
            className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-between">
          {reason ? (
            <p className="text-[11px] text-text-tertiary">{reason}</p>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
          >
            <Send size={12} strokeWidth={1.8} aria-hidden />
            {sending ? "Sending…" : "Send broadcast"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SubsystemIcon({ subsystem }: { subsystem: string }) {
  const Icon = pickSubsystemIcon(subsystem);
  return <Icon size={12} strokeWidth={1.8} className="text-text-tertiary" aria-hidden />;
}

function VisibilityOption({
  value,
  current,
  onSelect,
  icon: Icon,
  label,
  description,
}: {
  value: Visibility;
  current: Visibility;
  onSelect: (v: Visibility) => void;
  icon: typeof Globe2;
  label: string;
  description: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-accent bg-accent-soft text-text-primary"
          : "border-line-soft bg-bg text-text-secondary hover:border-line-strong hover:text-text-primary"
      }`}
    >
      <span className="flex items-center gap-2 text-xs font-medium">
        <Icon size={14} strokeWidth={1.7} aria-hidden />
        {label}
      </span>
      <span className="mt-1 block text-[11px] text-text-tertiary">
        {description}
      </span>
    </button>
  );
}
