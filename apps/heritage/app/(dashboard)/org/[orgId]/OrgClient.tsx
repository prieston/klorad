"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { slugify } from "@/lib/heritage/slug";
import {
  ArrowRight,
  Boxes,
  Landmark,
  Languages,
  Layers,
  Plus,
  ScanLine,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";

type VenueKind =
  | "museum"
  | "archaeological_site"
  | "monument"
  | "collection"
  | "cultural_route";

const VENUE_KIND_LABEL: Record<VenueKind, string> = {
  museum: "Museum",
  archaeological_site: "Archaeological site",
  monument: "Monument",
  collection: "Collection",
  cultural_route: "Cultural route",
};

interface VenueRow {
  id: string;
  projectId: string;
  slug: string;
  kind: VenueKind;
  name: string;
  languageCount: number;
  isPublished: boolean;
  createdAt: string;
  objectCount: number;
  representationCount: number;
  sceneCount: number;
  proxyCount: number;
}

export function OrgClient({
  orgId,
  orgName,
  initialVenues,
}: {
  orgId: string;
  orgName: string;
  initialVenues: VenueRow[];
}) {
  const router = useRouter();
  const venues = initialVenues;
  const [showForm, setShowForm] = useState(initialVenues.length === 0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<VenueKind>("museum");
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const totals = useMemo(
    () => ({
      published: venues.filter((v) => v.isPublished).length,
      objects: venues.reduce((sum, v) => sum + v.objectCount, 0),
      scenes: venues.reduce((sum, v) => sum + v.sceneCount, 0),
    }),
    [venues],
  );

  const create = async () => {
    if (!name.trim()) {
      toast.error("Give the venue a name");
      return;
    }
    if (!effectiveSlug) {
      toast.error("That name doesn't produce a usable URL — set one manually");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          name: name.trim(),
          slug: effectiveSlug,
          kind,
        }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        toast.error(body.error ?? "Create failed");
        return;
      }
      toast.success("Venue created");
      router.push(`/org/${orgId}/venues/${body.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {orgName}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Venues.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            A venue is a museum, an archaeological site or a monument. It holds
            the objects, the captures of them, the scenes a visitor explores
            and the rights that govern all three.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-soft px-3 py-1.5 text-xs text-text-secondary">
            <Landmark size={12} strokeWidth={1.8} />
            {venues.length} total · {totals.published} published
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line-soft px-3 py-1.5 text-xs text-text-secondary">
            <Boxes size={12} strokeWidth={1.8} />
            {totals.objects.toLocaleString()} objects
          </span>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            <Plus size={14} strokeWidth={1.8} />
            {showForm ? "Cancel" : "New venue"}
          </button>
        </div>
      </header>

      {showForm && (
        <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
          <h2 className="mb-1 text-lg font-medium text-text-primary">
            Create venue
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            The URL is public and permanent — it is what goes on the physical
            label and next to the headset station, and what an embed on another
            institution&rsquo;s site points at.
          </p>
          <div className="grid gap-4 md:max-w-xl md:grid-cols-2">
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-text-tertiary">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Archaeological Museum of Thessaloniki"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
                autoFocus
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Kind</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as VenueKind)}
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              >
                {(Object.keys(VENUE_KIND_LABEL) as VenueKind[]).map((k) => (
                  <option key={k} value={k}>
                    {VENUE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">
                Public URL
              </span>
              <div className="flex items-center rounded-md border border-line-strong bg-bg px-3">
                <span className="shrink-0 text-sm text-text-tertiary">/v/</span>
                <input
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="amth"
                  className="w-full bg-transparent py-2 text-text-primary outline-none"
                />
              </div>
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={create}
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </section>
      )}

      {venues.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-bg p-10 text-center">
          <Sparkles
            size={28}
            strokeWidth={1.6}
            className="mx-auto text-accent"
            aria-hidden
          />
          <h2 className="mt-4 text-lg font-medium text-text-primary">
            No venues yet.
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
            Create your first venue to start recording objects, ingesting
            captures and building the scenes a visitor walks through.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            <Plus size={14} strokeWidth={1.8} />
            Create your first venue
          </button>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {venues.map((v) => (
            <li
              key={v.id}
              className="group flex flex-col rounded-2xl border border-line-soft bg-bg p-6 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/org/${orgId}/venues/${v.id}`}
                    className="text-lg font-medium text-text-primary transition-colors group-hover:text-accent"
                  >
                    {v.name}
                  </Link>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {VENUE_KIND_LABEL[v.kind]} · /v/{v.slug}
                  </p>
                </div>
                {v.isPublished ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                    <span
                      aria-hidden
                      className="h-1 w-1 rounded-full bg-emerald-500"
                    />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                    Draft
                  </span>
                )}
              </div>

              <dl className="mt-5 grid grid-cols-4 gap-3 rounded-xl bg-surface-2 p-4">
                <Metric icon={Boxes} label="Objects" value={v.objectCount} />
                <Metric
                  icon={ScanLine}
                  label="Captures"
                  value={v.representationCount}
                />
                <Metric icon={Layers} label="Scenes" value={v.sceneCount} />
                <Metric icon={Target} label="Proxies" value={v.proxyCount} />
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-text-tertiary">
                  <Languages size={11} strokeWidth={1.8} aria-hidden />
                  {v.languageCount}{" "}
                  {v.languageCount === 1 ? "language" : "languages"}
                </span>
                <Link
                  href={`/org/${orgId}/venues/${v.id}/settings`}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  <Settings
                    size={12}
                    strokeWidth={1.8}
                    aria-hidden
                    className="-mt-px mr-1 inline"
                  />
                  Settings
                </Link>
                <Link
                  href={`/org/${orgId}/venues/${v.id}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
                >
                  Open
                  <ArrowRight size={12} strokeWidth={1.8} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        <Icon size={10} strokeWidth={1.8} aria-hidden />
        {label}
      </div>
      <div className="mt-1 text-lg font-medium text-text-primary">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
