"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Brush, Check, Trash2, Upload } from "lucide-react";
import { getStockIcon } from "@/lib/mobility/device-icons";

interface StyleRow {
  subsystem: string;
  iconKey: string;
  isOverride: boolean;
}

interface IconChoice {
  key: string;
  label: string;
  description: string;
}

interface CustomIcon {
  id: string;
  label: string;
  url: string;
  contentType: string;
  bytes: number;
  createdAt: string;
}

interface PresignResponse {
  signedUrl: string;
  publicUrl: string;
  key: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
  initialStyles: StyleRow[];
  iconLibrary: IconChoice[];
  initialCustomIcons: CustomIcon[];
  uploadsEnabled: boolean;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

const MAX_BYTES = 256 * 1024;
const ALLOWED_TYPES = new Set([
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function StylesClient({
  projectId,
  projectTitle,
  initialStyles,
  iconLibrary,
  initialCustomIcons,
  uploadsEnabled,
}: Props) {
  const { data, mutate } = useSWR<{ styles: StyleRow[] }>(
    `/api/projects/${projectId}/styles`,
    fetcher,
    { fallbackData: { styles: initialStyles } },
  );
  const baseline = data?.styles ?? initialStyles;

  const { data: iconsData, mutate: mutateIcons } = useSWR<{
    icons: CustomIcon[];
  }>(`/api/projects/${projectId}/styles/icons`, fetcher, {
    fallbackData: { icons: initialCustomIcons },
  });
  const customIcons = iconsData?.icons ?? initialCustomIcons;

  const [draft, setDraft] = useState<Map<string, string>>(
    () => new Map(baseline.map((s) => [s.subsystem, s.iconKey])),
  );
  const [saving, setSaving] = useState(false);

  // Sync the draft when the server data shifts under us. Keep
  // in-progress edits where the operator has already typed.
  const hash = baseline.map((s) => `${s.subsystem}:${s.iconKey}`).join("|");
  useMemo(() => {
    setDraft((prev) => {
      const next = new Map(prev);
      for (const s of baseline) {
        if (!prev.has(s.subsystem)) next.set(s.subsystem, s.iconKey);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const dirty = baseline.some(
    (s) => (draft.get(s.subsystem) ?? s.iconKey) !== s.iconKey,
  );

  async function save() {
    setSaving(true);
    try {
      const styles = Array.from(draft.entries()).map(([subsystem, iconKey]) => ({
        subsystem,
        iconKey,
      }));
      const res = await fetch(`/api/projects/${projectId}/styles`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ styles }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to save");
      }
      toast.success("Device styles saved");
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
            {projectTitle}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-text-primary">
            <Brush size={20} strokeWidth={1.7} aria-hidden />
            Device styles
          </h1>
          <p className="mt-2 max-w-[640px] text-sm text-text-secondary">
            Pick an icon for each device class so the map reads at a
            glance — cameras, signs, weather stations, sensors are all
            recognisable from a single zoom-out. Upload your own to
            mirror real-world hardware.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save styles"}
        </button>
      </header>

      <CustomLibrary
        projectId={projectId}
        customIcons={customIcons}
        uploadsEnabled={uploadsEnabled}
        onChanged={() => void mutateIcons()}
        anyAssignments={Array.from(draft.values()).some((k) =>
          k.startsWith("custom:"),
        )}
      />

      {baseline.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-4">
          {baseline.map((row) => (
            <li key={row.subsystem}>
              <SubsystemCard
                subsystem={row.subsystem}
                value={draft.get(row.subsystem) ?? row.iconKey}
                isOverride={row.isOverride}
                iconLibrary={iconLibrary}
                customIcons={customIcons}
                onChange={(next) =>
                  setDraft((prev) => {
                    const map = new Map(prev);
                    map.set(row.subsystem, next);
                    return map;
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/* ─── Custom-icon library ──────────────────────────────────────── */

function CustomLibrary({
  projectId,
  customIcons,
  uploadsEnabled,
  onChanged,
  anyAssignments,
}: {
  projectId: string;
  customIcons: CustomIcon[];
  uploadsEnabled: boolean;
  onChanged: () => void;
  anyAssignments: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Use SVG, PNG, JPEG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Icons must be under ${Math.round(MAX_BYTES / 1024)} KB.`);
      return;
    }
    setUploading(true);
    try {
      // 1. Presign the PUT.
      const presignRes = await fetch(`/api/uploads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          prefix: "mobility-device-icons",
        }),
      });
      if (!presignRes.ok) {
        const body = (await presignRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to presign upload");
      }
      const { signedUrl, publicUrl } = (await presignRes.json()) as PresignResponse;

      // 2. Upload directly to Spaces.
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Spaces rejected the upload");

      // 3. Register the row.
      const label = file.name.replace(/\.[^./]+$/, "").slice(0, 60);
      const registerRes = await fetch(
        `/api/projects/${projectId}/styles/icons`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url: publicUrl,
            contentType: file.type,
            bytes: file.size,
            label,
          }),
        },
      );
      if (!registerRes.ok) {
        const body = (await registerRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to register icon");
      }
      toast.success(`Uploaded ${label}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteIcon(icon: CustomIcon) {
    if (
      !confirm(
        `Delete "${icon.label}"? Any subsystems using this icon will revert to the stock default.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/projects/${projectId}/styles/icons/${icon.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`Removed ${icon.label}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Custom library
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            SVG uploads tint with the active accent. PNG / JPEG / WebP
            keep their original colours. Max{" "}
            {Math.round(MAX_BYTES / 1024)} KB.
          </p>
        </div>
        {uploadsEnabled ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-bg px-3 py-1.5 text-xs font-medium text-text-primary transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-50"
            >
              <Upload size={12} strokeWidth={1.8} aria-hidden />
              {uploading ? "Uploading…" : "Upload icon"}
            </button>
          </>
        ) : (
          <span className="text-[11px] text-text-tertiary">
            Uploads disabled (storage not configured)
          </span>
        )}
      </div>

      {customIcons.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line-soft px-3 py-5 text-center text-xs text-text-tertiary">
          No custom icons yet. Drop an SVG or PNG to give a subsystem its
          own look.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {customIcons.map((icon) => (
            <li
              key={icon.id}
              className="flex items-center gap-3 rounded-lg border border-line-soft bg-bg px-3 py-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2">
                {/* Operator-uploaded asset on DO Spaces — eslint
                    next/no-img-element is fine here because the
                    remote-pattern allowlist already covers this host
                    and we need to render arbitrary contentType. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={icon.url}
                  alt={icon.label}
                  className="h-8 w-8 object-contain"
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-xs font-semibold text-text-primary">
                  {icon.label}
                </span>
                <span className="block truncate text-[10px] text-text-tertiary">
                  {icon.contentType === "image/svg+xml"
                    ? "SVG · tinted"
                    : icon.contentType.replace("image/", "").toUpperCase()}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void deleteIcon(icon)}
                aria-label={`Delete ${icon.label}`}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 size={12} strokeWidth={1.8} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {anyAssignments ? (
        <p className="mt-3 text-[10px] text-text-tertiary">
          Some subsystems use custom icons. Deleting an icon reverts
          those subsystems to the stock default.
        </p>
      ) : null}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-soft bg-surface-1/30 py-16 text-center">
      <Brush size={26} strokeWidth={1.4} className="text-text-tertiary" />
      <p className="text-sm font-medium text-text-primary">
        No subsystems detected
      </p>
      <p className="max-w-[420px] text-xs text-text-secondary">
        Sync a data source first — device subsystems (CCTV, DMS,
        sensor, …) appear here as soon as the project has any devices
        to style.
      </p>
    </div>
  );
}

function SubsystemCard({
  subsystem,
  value,
  isOverride,
  iconLibrary,
  customIcons,
  onChange,
}: {
  subsystem: string;
  value: string;
  isOverride: boolean;
  iconLibrary: IconChoice[];
  customIcons: CustomIcon[];
  onChange: (next: string) => void;
}) {
  const customId = value.startsWith("custom:") ? value.slice(7) : null;
  const customSelected = customId
    ? customIcons.find((i) => i.id === customId)
    : null;
  const stockSelected = !customId ? getStockIcon(value) : null;
  return (
    <article className="rounded-2xl border border-line-soft bg-surface-1/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-accent-soft text-accent">
            {customSelected ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customSelected.url}
                alt=""
                className="h-7 w-7 object-contain"
              />
            ) : stockSelected ? (
              <stockSelected.Icon size={20} strokeWidth={1.6} aria-hidden />
            ) : null}
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
              Subsystem
            </p>
            <h2 className="text-sm font-semibold text-text-primary">
              {subsystem.toUpperCase()}
            </h2>
          </div>
        </div>
        {!isOverride ? (
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            Default
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {iconLibrary.map((choice) => {
          const stock = getStockIcon(choice.key);
          if (!stock) return null;
          const active = value === choice.key;
          return (
            <button
              key={choice.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(choice.key)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line-soft bg-bg hover:border-line-strong"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  active
                    ? "bg-accent text-accent-contrast"
                    : "bg-surface-2 text-text-secondary"
                }`}
              >
                <stock.Icon size={16} strokeWidth={1.6} aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-xs font-semibold text-text-primary">
                  {choice.label}
                </span>
                <span className="block truncate text-[10px] text-text-tertiary">
                  {choice.description}
                </span>
              </span>
              {active ? (
                <Check
                  size={14}
                  strokeWidth={2.2}
                  className="shrink-0 text-accent"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
        {customIcons.map((icon) => {
          const key = `custom:${icon.id}`;
          const active = value === key;
          return (
            <button
              key={icon.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-accent bg-accent-soft"
                  : "border-line-soft bg-bg hover:border-line-strong"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md ${
                  active ? "bg-accent/10" : "bg-surface-2"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={icon.url}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-xs font-semibold text-text-primary">
                  {icon.label}
                </span>
                <span className="block truncate text-[10px] text-text-tertiary">
                  Custom
                </span>
              </span>
              {active ? (
                <Check
                  size={14}
                  strokeWidth={2.2}
                  className="shrink-0 text-accent"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}
