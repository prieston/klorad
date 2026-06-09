"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";

interface ProjectRow {
  id: string;
  title: string;
  isPublished: boolean;
  isPublic: boolean;
  createdAt: string;
  sourceCount: number;
  deviceCount: number;
}

export function OrgClient({
  orgId,
  orgName,
  initialProjects,
}: {
  orgId: string;
  orgName: string;
  initialProjects: ProjectRow[];
}) {
  const router = useRouter();
  const projects = initialProjects;
  const [showForm, setShowForm] = useState(initialProjects.length === 0);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    if (!title.trim()) {
      toast.error("Pick a title");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, title: title.trim() }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        toast.error(body.error ?? "Create failed");
        return;
      }
      toast.success("Project created");
      // Jump straight to the new project's Sources screen — the
      // natural first action after create.
      router.push(`/org/${orgId}/projects/${body.id}/sources`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {orgName}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Projects
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          Each project is a tenant. Add one per agency or operating area;
          configure its data sources, curate devices, publish a traveller
          surface.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-text-primary">
            All projects
          </h2>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center justify-center rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
          >
            {showForm ? "Cancel" : "Create a project"}
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            No projects yet. Create one to start adding data sources.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {projects.map((p) => (
              <li
                key={p.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/org/${orgId}/projects/${p.id}`}
                      className="text-base font-medium text-text-primary transition-colors hover:text-accent"
                    >
                      {p.title}
                    </Link>
                    {p.isPublished ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-600">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {p.sourceCount} source{p.sourceCount === 1 ? "" : "s"} ·{" "}
                    {p.deviceCount} device{p.deviceCount === 1 ? "" : "s"} ·
                    created {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/org/${orgId}/projects/${p.id}/sources`}
                    className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                  >
                    Sources
                  </Link>
                  <Link
                    href={`/org/${orgId}/projects/${p.id}`}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showForm && (
        <section className="rounded-2xl border border-line-soft bg-bg p-6">
          <h2 className="mb-4 text-lg font-medium text-text-primary">
            New project
          </h2>
          <div className="grid gap-4 md:max-w-md">
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Thessaloniki ATMS"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
                autoFocus
              />
            </label>
            <p className="text-xs text-text-tertiary">
              Engine set to Mapbox. After create you land on the
              project&apos;s Sources screen.
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={create}
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create project"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
