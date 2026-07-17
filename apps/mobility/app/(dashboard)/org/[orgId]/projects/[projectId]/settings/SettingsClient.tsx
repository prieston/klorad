"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { ArrowUpRight } from "lucide-react";
import { AiKeyPanel } from "@/lib/mobility/AiKeyPanel";

interface Initial {
  title: string;
  isPublished: boolean;
  isPublic: boolean;
}

export function SettingsClient({
  orgId,
  projectId,
  initial,
}: {
  orgId: string;
  projectId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [isPublic, setIsPublic] = useState(initial.isPublic);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async (patch: Partial<Initial>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        toast.error(body.error ?? "Save failed");
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const saveTitle = async () => {
    if (!title.trim()) {
      toast.error("Title can't be empty");
      return;
    }
    const ok = await save({ title: title.trim() });
    if (ok) toast.success("Renamed");
  };

  const togglePublished = async (next: boolean) => {
    setIsPublished(next);
    const ok = await save({ isPublished: next });
    if (ok) {
      toast.success(next ? "Project published" : "Project unpublished");
    } else {
      setIsPublished(!next);
    }
  };

  const togglePublic = async (next: boolean) => {
    setIsPublic(next);
    const ok = await save({ isPublic: next });
    if (ok) {
      toast.success(next ? "Traveller map is public" : "Traveller map is private");
    } else {
      setIsPublic(!next);
    }
  };

  const remove = async () => {
    const confirmText = `delete ${initial.title}`;
    const got = window.prompt(
      `This drops the project and every device, status row, and alert under it. To confirm, type:\n\n${confirmText}`,
    );
    if (got !== confirmText) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      toast.success("Project deleted");
      router.push(`/org/${orgId}`);
    } finally {
      setDeleting(false);
    }
  };

  const publicVisible = isPublished && isPublic;
  const publicUrl = `/m/${projectId}`;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {initial.title}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          Rename the project, control visibility of its public traveller
          surface, or remove it entirely.
        </p>
      </header>

      {/* Title */}
      <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
        <h2 className="mb-3 text-lg font-medium text-text-primary">Name</h2>
        <div className="grid gap-3 md:max-w-lg">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
          />
          <button
            type="button"
            onClick={saveTitle}
            disabled={saving || title === initial.title}
            className="self-start rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </section>

      {/* Publish */}
      <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
        <h2 className="mb-1 text-lg font-medium text-text-primary">
          Publication
        </h2>
        <p className="mb-5 text-sm text-text-secondary">
          The public traveller surface at <code>{publicUrl}</code> shows
          only devices flagged public, and only when the project is itself
          published AND public.
        </p>

        <div className="grid gap-3 divide-y divide-line-soft">
          <Row
            title="Published"
            description="Draft projects are hidden from public surfaces and the org overview's public counters."
            checked={isPublished}
            onChange={togglePublished}
            disabled={saving}
          />
          <Row
            title="Public"
            description="When off, the traveller map requires the project's organisation membership. When on, it's anonymously reachable."
            checked={isPublic}
            onChange={togglePublic}
            disabled={saving}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-4 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              publicVisible ? "bg-emerald-500" : "bg-text-tertiary"
            }`}
            aria-hidden
          />
          {publicVisible ? (
            <>
              <span className="text-text-primary">
                Traveller map is live.
              </span>
              <Link
                href={publicUrl}
                target="_blank"
                rel="noopener"
                className="ml-auto inline-flex items-center gap-1 text-accent transition-colors hover:text-accent-hover"
              >
                Open
                <ArrowUpRight size={14} strokeWidth={1.8} />
              </Link>
            </>
          ) : (
            <span className="text-text-tertiary">
              Traveller map is not visible to anonymous visitors yet.
            </span>
          )}
        </div>
      </section>

      {/* Paris AI key */}
      <section className="mb-8">
        <AiKeyPanel projectId={projectId} />
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-500/20 bg-bg p-6">
        <h2 className="mb-1 text-lg font-medium text-red-500">Danger zone</h2>
        <p className="mb-5 text-sm text-text-secondary">
          Deletes the project, its data sources, every cached device, status
          history, and alert. Irreversible.
        </p>
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="rounded-md border border-red-500/40 bg-red-500/5 px-5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete project"}
        </button>
      </section>
    </main>
  );
}

function Row({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-4 first:pt-0">
      <div className="min-w-0">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </label>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-surface-2 border border-line-strong"
      }`}
    >
      <span
        aria-hidden
        className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
