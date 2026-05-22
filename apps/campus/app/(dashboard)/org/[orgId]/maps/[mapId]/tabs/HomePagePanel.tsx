"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "react-toastify";
import { uploadFile } from "@klorad/storage/client";
import { Button, Field, Input, Panel, Textarea } from "@klorad/design-system";
import { type HomePageConfig, readHomePage } from "@/lib/home-page";

interface Props {
  mapId: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServerMap {
  sceneData?: Record<string, unknown> & { homePage?: HomePageConfig };
}

/**
 * The public home page builder — a Settings section.
 *
 * Configures the campus's public landing page: a hero image, the
 * hero text, the map CTA label, and which sections show. Saved into
 * `sceneData.homePage`; the public page reads it with fallbacks, so
 * leaving a field blank keeps the sensible default.
 */
export default function HomePagePanel({ mapId }: Props) {
  const { data: serverMap } = useSWR<ServerMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );

  const [heroImage, setHeroImage] = useState("");
  const [headline, setHeadline] = useState("");
  const [tagline, setTagline] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [showEvents, setShowEvents] = useState(true);
  const [showNews, setShowNews] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const home = readHomePage(serverMap?.sceneData);
    setHeroImage(home.heroImage ?? "");
    setHeadline(home.headline ?? "");
    setTagline(home.tagline ?? "");
    setCtaLabel(home.ctaLabel ?? "");
    setShowEvents(home.showEvents !== false);
    setShowNews(home.showNews !== false);
  }, [serverMap]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await uploadFile(file, { prefix: "campus-hero" });
      setHeroImage(publicUrl);
      toast.success("Hero image uploaded — Save to apply");
    } catch {
      toast.error("Could not upload the image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const homePage: HomePageConfig = {
        heroImage: heroImage.trim() || undefined,
        headline: headline.trim() || undefined,
        tagline: tagline.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        showEvents,
        showNews,
      };
      const nextSceneData = {
        ...(serverMap?.sceneData ?? {}),
        homePage,
      };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData: nextSceneData }),
      });
      if (!res.ok) throw new Error("Save failed");
      await mutate(`/api/maps/${mapId}`);
      toast.success("Home page saved");
    } catch {
      toast.error("Could not save the home page");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="space-y-5 rounded-2xl p-6">
      <Field
        label="Hero image"
        hint="The banner behind your campus name on the public home page. A wide image (≈1600×600) works best."
      >
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
          className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
        />
      </Field>

      {heroImage ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt="Hero preview"
              className="h-36 w-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={() => setHeroImage("")}
            className="text-xs font-medium text-text-secondary transition-colors hover:text-accent"
          >
            Remove image
          </button>
        </div>
      ) : null}

      <Field
        label="Headline"
        hint="Overrides the campus name in the hero. Leave blank to use the campus name."
      >
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Welcome to our campus"
        />
      </Field>

      <Field
        label="Tagline"
        hint="A short line under the headline. Leave blank to use the campus description."
      >
        <Textarea
          rows={2}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Find your way — buildings, rooms, events and step-free routes."
        />
      </Field>

      <Field label="Map button label">
        <Input
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          placeholder="Explore the campus map"
        />
      </Field>

      <div className="space-y-2 rounded-xl bg-surface-2 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={showEvents}
            onChange={(e) => setShowEvents(e.target.checked)}
            className="h-4 w-4 rounded accent-accent"
          />
          Show the events section
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={showNews}
            onChange={(e) => setShowNews(e.target.checked)}
            className="h-4 w-4 rounded accent-accent"
          />
          Show the news section
        </label>
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving || uploading}>
        {uploading ? "Uploading…" : saving ? "Saving…" : "Save home page"}
      </Button>
    </Panel>
  );
}
