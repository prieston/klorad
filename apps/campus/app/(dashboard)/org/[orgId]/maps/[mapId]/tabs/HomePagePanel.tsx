"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "react-toastify";
import { uploadFile } from "@klorad/storage/client";
import { Button, Field, Input, Panel, Textarea } from "@klorad/design-system";
import { UPLOAD_PREFIXES } from "@/lib/uploads/prefixes";
import { type HomePageConfig, readHomePage } from "@/lib/home-page";
import {
  type Localizable,
  type Locale,
  type LocalizedText,
} from "@/app/lib/i18n-core";
import { LangToggle } from "./LangToggle";

interface Props {
  mapId: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServerMap {
  sceneData?: Record<string, unknown> & { homePage?: HomePageConfig };
}

type LangFields = { en: string; el: string };
const EMPTY_FIELDS: LangFields = { en: "", el: "" };

/** Expand a possibly-legacy {@link Localizable} into editable fields. */
function toFields(value: Localizable | undefined): LangFields {
  if (!value) return { ...EMPTY_FIELDS };
  if (typeof value === "string") return { en: value, el: "" };
  return { en: value.en ?? "", el: value.el ?? "" };
}

/** Collapse edited fields to localized text, dropping empty languages. */
function toLocalized(fields: LangFields): LocalizedText | undefined {
  const en = fields.en.trim() || undefined;
  const el = fields.el.trim() || undefined;
  return en || el ? { en, el } : undefined;
}

/**
 * The public home page builder — a Settings section.
 *
 * Configures the campus's public landing page. Hero text is
 * bilingual (English + Greek), edited one language at a time via the
 * toggle. Saved into `sceneData.homePage`; the public page reads it
 * with fallbacks, so a blank field keeps the sensible default.
 */
export default function HomePagePanel({ mapId }: Props) {
  const { data: serverMap } = useSWR<ServerMap>(
    `/api/maps/${mapId}`,
    fetcher,
  );

  const [lang, setLang] = useState<Locale>("en");
  const [heroImage, setHeroImage] = useState("");
  const [headline, setHeadline] = useState<LangFields>({ ...EMPTY_FIELDS });
  const [tagline, setTagline] = useState<LangFields>({ ...EMPTY_FIELDS });
  const [ctaLabel, setCtaLabel] = useState<LangFields>({ ...EMPTY_FIELDS });
  const [showEvents, setShowEvents] = useState(true);
  const [showNews, setShowNews] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialise the form from the saved config exactly once. SWR
  // revalidates `serverMap` (on window focus — which opening a file
  // picker triggers); re-running this would clobber unsaved edits,
  // including a just-uploaded hero image before it is saved.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !serverMap) return;
    loadedRef.current = true;
    const home = readHomePage(serverMap.sceneData);
    setHeroImage(home.heroImage ?? "");
    setHeadline(toFields(home.headline));
    setTagline(toFields(home.tagline));
    setCtaLabel(toFields(home.ctaLabel));
    setShowEvents(home.showEvents !== false);
    setShowNews(home.showNews !== false);
  }, [serverMap]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { publicUrl } = await uploadFile(file, { prefix: UPLOAD_PREFIXES.branding });
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
        headline: toLocalized(headline),
        tagline: toLocalized(tagline),
        ctaLabel: toLocalized(ctaLabel),
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

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-tertiary">
          Editing the {lang === "en" ? "English" : "Greek"} text
        </span>
        <LangToggle value={lang} onChange={setLang} />
      </div>

      <Field
        label="Headline"
        hint="Overrides the campus name in the hero. Leave blank to use the campus name."
      >
        <Input
          value={headline[lang]}
          onChange={(e) =>
            setHeadline((h) => ({ ...h, [lang]: e.target.value }))
          }
          placeholder="Welcome to our campus"
        />
      </Field>

      <Field
        label="Tagline"
        hint="A short line under the headline. Leave blank to use the campus description."
      >
        <Textarea
          rows={2}
          value={tagline[lang]}
          onChange={(e) =>
            setTagline((t) => ({ ...t, [lang]: e.target.value }))
          }
          placeholder="Find your way — buildings, rooms, events and step-free routes."
        />
      </Field>

      <Field label="Map button label">
        <Input
          value={ctaLabel[lang]}
          onChange={(e) =>
            setCtaLabel((c) => ({ ...c, [lang]: e.target.value }))
          }
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
