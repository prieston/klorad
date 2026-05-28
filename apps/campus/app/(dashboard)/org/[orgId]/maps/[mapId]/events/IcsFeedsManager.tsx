"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Trash2 } from "lucide-react";
import { Button, Field, Input, Panel } from "@klorad/design-system";

interface Props {
  mapId: string;
  initialFeeds: string[];
}

/**
 * Manage the project's ICS event feed URLs.
 *
 * Feeds live in `sceneData.eventFeeds: string[]`. Save flow:
 *   1. GET /api/maps/[mapId] to pull the current `sceneData`,
 *   2. mutate `eventFeeds` only,
 *   3. PATCH /api/maps/[mapId] with the merged `sceneData`.
 *
 * The public surface fetches + parses these feeds via the existing
 * `events-server.ts` pipeline and merges them with `EventPost` rows
 * on the consumer home + events list page. Two-way binding: deletes
 * here remove the feed from the public surface on next ISR window.
 */
export function IcsFeedsManager({ mapId, initialFeeds }: Props) {
  const [feeds, setFeeds] = useState<string[]>(initialFeeds);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (next: string[]) => {
    setSaving(true);
    try {
      const cur = await fetch(`/api/maps/${mapId}`).then((r) => r.json());
      const sceneData = {
        ...(cur.sceneData ?? {}),
        eventFeeds: next,
      };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
      }
      setFeeds(next);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    const url = input.trim();
    if (!url) return;
    try {
      new URL(url); // basic shape check
    } catch {
      toast.error("That doesn’t look like a URL.");
      return;
    }
    if (feeds.includes(url)) {
      toast.info("Feed already added.");
      setInput("");
      return;
    }
    await save([...feeds, url]);
    setInput("");
    toast.success("Feed added");
  };

  const remove = async (url: string) => {
    if (!confirm("Remove this feed?")) return;
    await save(feeds.filter((f) => f !== url));
    toast.success("Feed removed");
  };

  return (
    <Panel className="mt-6 p-5">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">
          ICS feeds
        </h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Paste a Google / Outlook / department calendar URL. Events
          pull every render and merge with anything you publish below.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {feeds.length === 0 ? (
          <p className="rounded-lg bg-surface-2 p-3 text-xs text-text-tertiary">
            No feeds yet.
          </p>
        ) : (
          feeds.map((url) => (
            <div
              key={url}
              className="flex items-center gap-2 rounded-lg border border-solid border-line-soft p-2"
            >
              <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                {url}
              </span>
              <button
                type="button"
                onClick={() => void remove(url)}
                disabled={saving}
                aria-label="Remove feed"
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 items-end">
        <Field label="Add feed URL">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…"
            type="url"
            disabled={saving}
          />
        </Field>
        <Button
          type="button"
          onClick={() => void add()}
          disabled={saving || !input.trim()}
        >
          {saving ? "Saving…" : "Add"}
        </Button>
      </div>
    </Panel>
  );
}
