"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "react-toastify";
import EventIcon from "@mui/icons-material/Event";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FacebookIcon from "@mui/icons-material/Facebook";
import { Badge, Button, Field, Input, Panel } from "@klorad/design-system";
import { readEventFeeds } from "@/lib/events";

interface Props {
  mapId: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServerMap {
  sceneData?: Record<string, unknown> & { eventFeeds?: string[] };
}

/** Integrations that aren't built yet — shown as informational cards. */
const COMING_SOON: {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    id: "google",
    name: "Google Calendar",
    description:
      "One-click sync from a Google Calendar — no public ICS URL needed. Coming in a later phase.",
    icon: <CalendarMonthIcon />,
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    description:
      "Pull events from your institution's Exchange or Microsoft 365 tenant.",
    icon: <EventIcon />,
  },
  {
    id: "facebook",
    name: "Facebook Events",
    description:
      "Meta restricts public event access — likely manual entry rather than a feed.",
    icon: <FacebookIcon />,
  },
];

/**
 * Integrations tab — event feeds.
 *
 * ICS feeds are live: paste a public calendar URL and its events
 * appear on the campus's public home page (fetched + parsed server-
 * side). Feed URLs are stored in `sceneData.eventFeeds`. The other
 * providers are informational cards until built.
 */
export default function IntegrationsTab({ mapId }: Props) {
  const { data: serverMap } = useSWR<ServerMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );
  const feeds = readEventFeeds(serverMap?.sceneData);

  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const persist = async (nextFeeds: string[]) => {
    const nextSceneData = {
      ...(serverMap?.sceneData ?? {}),
      eventFeeds: nextFeeds,
    };
    const res = await fetch(`/api/maps/${mapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneData: nextSceneData }),
    });
    if (!res.ok) throw new Error("Save failed");
    await mutate(`/api/maps/${mapId}`);
  };

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("Enter a full URL starting with http(s)://");
      return;
    }
    if (feeds.includes(trimmed)) {
      toast.error("That feed is already added");
      return;
    }
    setSaving(true);
    try {
      await persist([...feeds, trimmed]);
      setUrl("");
      toast.success("Feed added");
    } catch {
      toast.error("Could not add the feed");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (feed: string) => {
    setSaving(true);
    try {
      await persist(feeds.filter((f) => f !== feed));
      toast.success("Feed removed");
    } catch {
      toast.error("Could not remove the feed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 pt-6">
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          ICS calendar feeds
        </h2>
        <Panel className="space-y-4 rounded-2xl p-6">
          <p className="text-sm text-text-secondary">
            Subscribe to any public ICS calendar URL — its upcoming events
            appear on this campus&apos;s public home page automatically.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Field label="ICS feed URL">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…/calendar.ics"
                />
              </Field>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving || !url.trim()}
            >
              Add feed
            </Button>
          </div>
          {feeds.length > 0 ? (
            <ul className="space-y-1.5">
              {feeds.map((feed) => (
                <li
                  key={feed}
                  className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-primary">
                    {feed}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => handleRemove(feed)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-tertiary">No feeds yet.</p>
          )}
        </Panel>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          More providers
        </h2>
        <div className="space-y-3">
          {COMING_SOON.map((int) => (
            <Panel
              key={int.id}
              className="flex items-center gap-4 rounded-2xl p-4"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {int.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {int.name}
                  </span>
                  <Badge>Later</Badge>
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {int.description}
                </p>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
