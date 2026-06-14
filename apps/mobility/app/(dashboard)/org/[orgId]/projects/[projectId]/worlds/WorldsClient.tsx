"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import {
  ArrowUpRight,
  Globe2,
  Link2,
  Lock,
  Plus,
  Radio,
} from "lucide-react";

type Visibility = "public" | "linkOnly" | "authenticated";

interface WorldRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  deviceCount: number;
}

interface Props {
  orgId: string;
  projectId: string;
  projectTitle: string;
  initialWorlds: WorldRow[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function WorldsClient({
  orgId,
  projectId,
  projectTitle,
  initialWorlds,
}: Props) {
  const { data, mutate } = useSWR<{ worlds: WorldRow[] }>(
    `/api/worlds?projectId=${projectId}`,
    fetcher,
    { fallbackData: { worlds: initialWorlds } },
  );
  const worlds = data?.worlds ?? initialWorlds;
  const [creating, setCreating] = useState(worlds.length === 0);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
            {projectTitle}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">
            Worlds
          </h1>
          <p className="mt-2 max-w-[640px] text-sm text-text-secondary">
            Publish curated, stakeholder-facing apps from this project.
            Each world becomes its own installable PWA at{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              mobility.klorad.com/w/&lt;slug&gt;
            </code>{" "}
            — with its own brand, audience, and push channel.
          </p>
        </div>
        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors hover:bg-accent-strong"
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            New world
          </button>
        ) : null}
      </header>

      {creating ? (
        <CreateWorldCard
          projectId={projectId}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void mutate();
          }}
        />
      ) : null}

      {worlds.length === 0 && !creating ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <ul className="space-y-3">
          {worlds.map((w) => (
            <li key={w.id}>
              <WorldCard
                orgId={orgId}
                projectId={projectId}
                world={w}
                onChange={() => void mutate()}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-soft bg-surface-1/30 py-16 text-center">
      <Radio size={26} strokeWidth={1.4} className="text-text-tertiary" />
      <p className="text-sm font-medium text-text-primary">
        No worlds yet
      </p>
      <p className="max-w-[420px] text-xs text-text-secondary">
        A world is a publishable, stakeholder-facing view of this
        project — its own URL, brand, devices, and push channel.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors hover:bg-accent-strong"
      >
        <Plus size={14} strokeWidth={1.8} aria-hidden />
        Create your first world
      </button>
    </div>
  );
}

function CreateWorldCard({
  projectId,
  onCancel,
  onCreated,
}: {
  projectId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("linkOnly");
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = slugTouched ? slug : suggestSlug(name);
  const slugValid = SLUG_RE.test(effectiveSlug);
  const canSubmit =
    name.trim().length > 0 && slugValid && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/worlds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          slug: effectiveSlug,
          description: description.trim() || undefined,
          visibility,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to create world");
      }
      toast.success(`World "${name}" created`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create world");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 rounded-2xl border border-line-soft bg-surface-1/40 p-5"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
        New world
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-xs font-medium text-text-secondary">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Egnatia East — Winter Ops"
            required
            className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
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
              value={effectiveSlug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              onFocus={() => setSlugTouched(true)}
              required
              className="block w-full bg-bg px-3 py-2 font-mono text-sm text-text-primary focus:outline-none"
            />
          </div>
          {!slugValid && effectiveSlug.length > 0 ? (
            <span className="mt-1 block text-[11px] text-rose-500">
              Lowercase letters, digits, hyphen. Must start + end alphanumeric.
            </span>
          ) : null}
        </label>
      </div>

      <label className="mt-4 block text-xs font-medium text-text-secondary">
        Description{" "}
        <span className="text-text-tertiary">(optional, shown on world&apos;s home)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={280}
          className="mt-1 block w-full rounded-md border border-line-soft bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-text-secondary">
          Initial visibility
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
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast shadow-sm transition-colors enabled:hover:bg-accent-strong disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create world"}
        </button>
      </div>
    </form>
  );
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

function WorldCard({
  orgId,
  projectId,
  world,
  onChange,
}: {
  orgId: string;
  projectId: string;
  world: WorldRow;
  onChange: () => void;
}) {
  const editHref = `/org/${orgId}/projects/${projectId}/worlds/${world.id}`;
  const publicHref = `/w/${world.slug}`;

  async function togglePublish() {
    try {
      const res = await fetch(`/api/worlds/${world.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isPublished: !world.isPublished }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to update world");
      }
      toast.success(
        world.isPublished ? "World unpublished" : "World published",
      );
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  return (
    <article className="flex flex-wrap items-center gap-4 rounded-2xl border border-line-soft bg-surface-1/40 p-4 transition-colors hover:border-line-strong">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${
              world.isPublished ? "bg-emerald-500" : "bg-text-tertiary"
            }`}
          />
          <Link
            href={editHref}
            className="truncate text-sm font-semibold text-text-primary hover:text-accent"
          >
            {world.name}
          </Link>
          <VisibilityChip visibility={world.visibility} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-text-tertiary">
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">
            /w/{world.slug}
          </code>
          <span>{world.deviceCount} devices</span>
          {world.isPublished ? (
            <span>
              Published{" "}
              {world.publishedAt
                ? new Date(world.publishedAt).toLocaleDateString()
                : ""}
            </span>
          ) : (
            <span>Draft</span>
          )}
        </div>
        {world.description ? (
          <p className="mt-2 line-clamp-2 text-xs text-text-secondary">
            {world.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePublish}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            world.isPublished
              ? "border-line-soft text-text-secondary hover:border-line-strong hover:text-text-primary"
              : "border-accent bg-accent text-accent-contrast hover:bg-accent-strong"
          }`}
        >
          {world.isPublished ? "Unpublish" : "Publish"}
        </button>
        {world.isPublished ? (
          <a
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-line-soft px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
          >
            Open
            <ArrowUpRight size={11} strokeWidth={1.8} aria-hidden />
          </a>
        ) : null}
        <Link
          href={editHref}
          className="rounded-md border border-line-soft px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-line-strong hover:text-text-primary"
        >
          Edit
        </Link>
      </div>
    </article>
  );
}

function VisibilityChip({ visibility }: { visibility: Visibility }) {
  const { Icon, label } =
    visibility === "public"
      ? { Icon: Globe2, label: "Public" }
      : visibility === "linkOnly"
        ? { Icon: Link2, label: "Link only" }
        : { Icon: Lock, label: "Auth" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
      <Icon size={10} strokeWidth={1.8} aria-hidden />
      {label}
    </span>
  );
}

