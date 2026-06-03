"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Globe2,
  Languages,
  Lock,
  Trash2,
} from "lucide-react";
import { Button, Field, Panel, Select } from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

interface Props {
  orgId: string;
  mapId: string;
}

interface SceneData {
  /** Locale shown to visitors who arrive with no explicit `?lang=` —
   *  defaults to `"en"` when unset. */
  defaultLocale?: "en" | "el";
  [k: string]: unknown;
}

interface MapResponse {
  id: string;
  title: string;
  isPublished?: boolean;
  isPublic?: boolean;
  sceneData?: SceneData;
}

interface OrgResponse {
  isPersonal?: boolean;
}

const mapFetcher = (url: string): Promise<MapResponse> =>
  fetch(url).then((r) => r.json());
const orgFetcher = (url: string): Promise<OrgResponse> =>
  fetch(url).then((r) => r.json());

/**
 * Campus-tier Settings — the publishing controls, language defaults
 * and danger zone that don't belong on the content authoring screens.
 *
 * Three panels, ordered by reversibility (most-reversible first so the
 * destructive action is harder to mis-click):
 *   1. Visibility — published / draft + auth requirement
 *   2. Localisation — default locale for visitors who arrive with no
 *      `?lang=` query
 *   3. Danger zone — delete this campus
 *
 * The publish toggle is intentionally mirrored from Reach so a rector
 * landing here in "I need to publish" mode doesn't have to context-
 * switch. SWR keeps both screens in sync.
 */
export default function CampusSettingsPageClient({ orgId, mapId }: Props) {
  const router = useRouter();
  const { data: map } = useSWR<MapResponse>(
    `/api/maps/${mapId}`,
    mapFetcher,
  );
  const { data: org } = useSWR<OrgResponse>(
    `/api/organizations/${orgId}`,
    orgFetcher,
  );

  const [defaultLocale, setDefaultLocale] = useState<"en" | "el">("en");
  const [isPublic, setIsPublic] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (hydrated || !map) return;
    setDefaultLocale(map.sceneData?.defaultLocale ?? "en");
    setIsPublic(map.isPublic ?? true);
    setHydrated(true);
  }, [hydrated, map]);

  const dirty = useMemo(() => {
    if (!hydrated || !map) return false;
    return (
      defaultLocale !== (map.sceneData?.defaultLocale ?? "en") ||
      isPublic !== (map.isPublic ?? true)
    );
  }, [hydrated, map, defaultLocale, isPublic]);

  // Personal organisations can't have private campuses — the schema
  // pins `isPublic` to `true` for them. Surface that as a disabled
  // toggle with a hint rather than silently dropping the control,
  // so the rector understands why it's locked.
  const canChangeVisibility = !(org?.isPersonal ?? false);

  const handleTogglePublish = async () => {
    if (!map || publishBusy) return;
    setPublishBusy(true);
    const next = !map.isPublished;
    try {
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });
      if (!res.ok) throw new Error("Failed");
      await globalMutate(`/api/maps/${mapId}`);
      toast.success(next ? "Campus is now public" : "Campus is now a draft");
    } catch {
      toast.error("Couldn't update visibility");
    } finally {
      setPublishBusy(false);
    }
  };

  const handleSave = async () => {
    if (!map || !dirty || saving) return;
    setSaving(true);
    try {
      const nextScene: SceneData = {
        ...(map.sceneData ?? {}),
        defaultLocale,
      };
      const body: Record<string, unknown> = { sceneData: nextScene };
      if (canChangeVisibility) {
        body.isPublic = isPublic;
      }
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      await globalMutate(`/api/maps/${mapId}`);
      toast.success("Settings saved");
    } catch {
      toast.error("Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!map || deleting) return;
    if (deleteConfirm.trim() !== map.title) {
      toast.error("Type the campus name exactly to confirm");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/maps/${mapId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed");
      toast.success(`${map.title} deleted`);
      router.push(`/org/${orgId}/maps`);
    } catch {
      toast.error("Couldn't delete");
      setDeleting(false);
    }
  };

  const isPublished = Boolean(map?.isPublished);

  return (
    <div className="mx-auto w-full max-w-[920px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Manage"
        title="Settings"
        subtitle="Publishing, language, and the danger zone."
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

      <div className="space-y-6">
        {/* ─ Visibility ──────────────────────────────────────────── */}
        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Globe2 size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Visibility
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Who can open this campus and whether they need to be
                signed in.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2/40 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  Publication state
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {isPublished
                    ? "Live — anyone with the link can open it."
                    : "Draft — only authors can see it."}
                </p>
              </div>
              <Button
                size="sm"
                variant={isPublished ? "secondary" : "primary"}
                onClick={handleTogglePublish}
                disabled={publishBusy}
              >
                {publishBusy
                  ? "…"
                  : isPublished
                    ? "Unpublish"
                    : "Publish campus"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2/40 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Lock
                    size={12}
                    strokeWidth={1.75}
                    aria-hidden
                    className="text-text-tertiary"
                  />
                  <p className="text-sm font-medium text-text-primary">
                    Require sign-in
                  </p>
                </div>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {canChangeVisibility
                    ? isPublic
                      ? "Anyone can read the campus once published."
                      : "Only signed-in members of the organisation can open it."
                    : "Personal organisations can&rsquo;t restrict access — every published campus is public."}
                </p>
              </div>
              <label
                className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${
                  !canChangeVisibility
                    ? "cursor-not-allowed opacity-50"
                    : ""
                } ${
                  !isPublic ? "bg-accent" : "bg-surface-2"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!isPublic}
                  disabled={!canChangeVisibility}
                  onChange={(e) => setIsPublic(!e.target.checked)}
                />
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    !isPublic ? "translate-x-6" : "translate-x-1"
                  }`}
                  aria-hidden
                />
              </label>
            </div>
          </div>
        </Panel>

        {/* ─ Localisation ────────────────────────────────────────── */}
        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Languages size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Localisation
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Visitors landing without a `?lang=` parameter see this
                language by default. They can switch via the language
                toggle in the consumer nav.
              </p>
            </div>
          </div>
          <Field label="Default language">
            <Select
              value={defaultLocale}
              onChange={(e) =>
                setDefaultLocale(e.target.value as "en" | "el")
              }
              className="max-w-[220px]"
            >
              <option value="en">English</option>
              <option value="el">Ελληνικά (Greek)</option>
            </Select>
          </Field>
        </Panel>

        {/* ─ Danger zone ─────────────────────────────────────────── */}
        <Panel className="rounded-2xl border-red-500/30 p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertTriangle size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">
                Danger zone
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Deletes the campus and every piece of content under it —
                news, events, clubs, dining, members&rsquo; push
                subscriptions. This cannot be undone.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
            <Field
              label={`Type "${map?.title ?? ""}" to confirm`}
              hint="Case-sensitive."
            >
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={map?.title ?? ""}
                spellCheck={false}
                className="w-full rounded-md border border-line-strong bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-red-500"
              />
            </Field>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleDelete}
                disabled={
                  deleting ||
                  !map ||
                  deleteConfirm.trim() !== map.title
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                {deleting ? "Deleting…" : "Delete campus"}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
