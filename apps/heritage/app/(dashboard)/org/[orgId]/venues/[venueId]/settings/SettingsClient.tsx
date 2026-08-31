"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Plus, X } from "lucide-react";
import { ALL_RIGHTS, RIGHTS_LABEL } from "@/lib/heritage/rights";

type Rights = (typeof ALL_RIGHTS)[number];

interface Initial {
  slug: string;
  kind: string;
  name: Record<string, string>;
  summary: Record<string, string>;
  languages: string[];
  defaultLanguage: string;
  scanOfPublicDomainAssertsRights: boolean;
  defaultRights: Rights;
  isPublished: boolean;
}

export function SettingsClient({
  venueId,
  initial,
}: {
  venueId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [languages, setLanguages] = useState(initial.languages);
  const [defaultLanguage, setDefaultLanguage] = useState(initial.defaultLanguage);
  const [name, setName] = useState(initial.name);
  const [summary, setSummary] = useState(initial.summary);
  const [newLanguage, setNewLanguage] = useState("");
  const [scanAsserts, setScanAsserts] = useState(
    initial.scanOfPublicDomainAssertsRights,
  );
  const [defaultRights, setDefaultRights] = useState<Rights>(
    initial.defaultRights,
  );
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [saving, setSaving] = useState(false);

  const addLanguage = () => {
    const tag = newLanguage.trim().toLowerCase();
    if (!tag) return;
    if (languages.includes(tag)) {
      toast.info(`${tag} is already in the list`);
      return;
    }
    setLanguages([...languages, tag]);
    setNewLanguage("");
  };

  const removeLanguage = (tag: string) => {
    if (tag === defaultLanguage) {
      toast.error("Pick a different default language first");
      return;
    }
    setLanguages(languages.filter((l) => l !== tag));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/venues/${venueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          summary,
          languages,
          defaultLanguage,
          scanOfPublicDomainAssertsRights: scanAsserts,
          defaultRights,
          isPublished,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Save failed");
        return;
      }
      toast.success("Saved");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="text-3xl font-light leading-[1.05] text-text-primary">
          Venue settings.
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          Public URL <span className="font-mono text-xs">/v/{initial.slug}</span>{" "}
          — permanent, because it is what goes on the physical label and inside
          other institutions&rsquo; embeds.
        </p>
      </header>

      <Section
        title="Languages"
        note="Every content field is stored per language. Public tenders in this sector typically specify three to five, so the set is extensible rather than fixed."
      >
        <div className="flex flex-wrap gap-2">
          {languages.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                tag === defaultLanguage
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-2 text-text-secondary"
              }`}
            >
              {tag}
              {tag === defaultLanguage ? " · default" : null}
              {tag !== defaultLanguage && (
                <button
                  type="button"
                  onClick={() => removeLanguage(tag)}
                  aria-label={`Remove ${tag}`}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <X size={11} strokeWidth={2} aria-hidden />
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-text-tertiary">Add language</span>
            <input
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLanguage();
                }
              }}
              placeholder="el"
              className="w-28 rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
            />
          </label>
          <button
            type="button"
            onClick={addLanguage}
            className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-sm text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            Add
          </button>
          <label className="text-sm">
            <span className="mb-1 block text-text-tertiary">Default</span>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
            >
              {languages.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section
        title="Name and summary"
        note="Untranslated languages fall back to the default rather than rendering blank, but a fallback is visible to a visitor and should not survive to publication."
      >
        <div className="space-y-4">
          {languages.map((tag) => (
            <div key={tag} className="grid gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                {tag}
              </span>
              <input
                value={name[tag] ?? ""}
                onChange={(e) => setName({ ...name, [tag]: e.target.value })}
                placeholder="Venue name"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
              <textarea
                value={summary[tag] ?? ""}
                onChange={(e) =>
                  setSummary({ ...summary, [tag]: e.target.value })
                }
                placeholder="One or two sentences a visitor reads first"
                rows={2}
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-sm text-text-primary"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Rights policy"
        note="Whether a faithful 3D scan of a public-domain object generates new copyright is legally contested in Europe, and institutions differ. This is deliberately a per-tenant setting rather than a position baked into the platform."
      >
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={scanAsserts}
            onChange={(e) => setScanAsserts(e.target.checked)}
            className="mt-1"
          />
          <span className="text-text-secondary">
            A scan of a public-domain object asserts new rights.{" "}
            <span className="text-text-tertiary">
              When off, a capture of a public-domain original inherits the
              original&rsquo;s status and cannot restrict it.
            </span>
          </span>
        </label>
        <label className="mt-5 block text-sm">
          <span className="mb-1 block text-text-tertiary">
            Default rights for new captures
          </span>
          <select
            value={defaultRights}
            onChange={(e) => setDefaultRights(e.target.value as Rights)}
            className="w-full max-w-md rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
          >
            {ALL_RIGHTS.map((r) => (
              <option key={r} value={r}>
                {RIGHTS_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section
        title="Publication"
        note="Publishing exposes the venue at its public URL. Individual objects, scenes and tours carry their own draft/review/approve state on top of this."
      >
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          <span className="text-text-secondary">
            Venue is published at{" "}
            <span className="font-mono text-xs">/v/{initial.slug}</span>
          </span>
        </label>
      </Section>

      <div className="mt-8">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </main>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
      <h2 className="text-lg font-medium text-text-primary">{title}</h2>
      <p className="mb-5 mt-1 text-xs leading-relaxed text-text-tertiary">
        {note}
      </p>
      {children}
    </section>
  );
}
