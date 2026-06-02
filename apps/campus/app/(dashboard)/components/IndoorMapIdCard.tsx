"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate as mutateGlobal } from "swr";
import { toast } from "react-toastify";
import { ExternalLink, Link2, Link2Off } from "lucide-react";
import { Button, Field, Input, Panel } from "@klorad/design-system";

interface Props {
  mapId: string;
}

interface ServerMap {
  sceneData?: { indoorMapId?: string } & Record<string, unknown>;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<ServerMap>);

/**
 * "MappedIn venue" config card on the Map & Wayfinding screen.
 *
 * Owns one knob — the campus's `indoorMapId`. Stored in
 * `sceneData.indoorMapId` (same place the rest of the campus's map
 * config lives); the public viewer reads it to spin up MappedIn.
 *
 * Mirrors the IHU mock — pill that shows Connected / Disconnected
 * based on whether an id is set + linked to the saved value, an
 * input row for editing, Save button. Status is computed from the
 * *saved* id, not the draft, so the pill doesn't lie while you
 * type.
 */
export function IndoorMapIdCard({ mapId }: Props) {
  const { data: serverMap } = useSWR<ServerMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );
  const savedId = serverMap?.sceneData?.indoorMapId ?? "";
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Seed the input from the server exactly once — re-running this
  // on every SWR revalidate (e.g. window-focus) would clobber an
  // in-progress edit.
  useEffect(() => {
    if (hydrated || !serverMap) return;
    setDraft(savedId);
    setHydrated(true);
  }, [hydrated, serverMap, savedId]);

  const dirty = hydrated && draft.trim() !== savedId.trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextSceneData = {
        ...(serverMap?.sceneData ?? {}),
        indoorMapId: draft.trim() || undefined,
      };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData: nextSceneData }),
      });
      if (!res.ok) throw new Error("Save failed");
      await mutateGlobal(`/api/maps/${mapId}`);
      toast.success(draft.trim() ? "Venue linked" : "Venue disconnected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const isConnected = savedId.trim().length > 0;

  return (
    <Panel className="rounded-2xl p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            MappedIn venue
          </h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Indoor 3D map, search &amp; wayfinding.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-text-tertiary/10 text-text-tertiary"
          }`}
        >
          {isConnected ? (
            <Link2 size={12} strokeWidth={1.75} aria-hidden />
          ) : (
            <Link2Off size={12} strokeWidth={1.75} aria-hidden />
          )}
          {isConnected ? "Connected" : "Not connected"}
        </span>
      </div>
      <Field label="Indoor map ID">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="682c13a27f034f8800b56f6ab"
          spellCheck={false}
        />
      </Field>
      <p className="mt-2 text-xs text-text-tertiary">
        Paste the MappedIn venue ID to enable the indoor viewer.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        {isConnected ? (
          <a
            href={`/campus/${mapId}/map`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
            Open public map
          </a>
        ) : null}
      </div>
    </Panel>
  );
}
