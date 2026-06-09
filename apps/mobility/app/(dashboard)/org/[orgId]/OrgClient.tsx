"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowRight,
  Building2,
  Compass,
  Database,
  Eye,
  Layers,
  Plus,
  Sparkles,
  TrafficCone,
} from "lucide-react";

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
      router.push(`/org/${orgId}/projects/${body.id}/sources`);
    } finally {
      setSubmitting(false);
    }
  };

  const publishedCount = projects.filter((p) => p.isPublished).length;
  const totalDevices = projects.reduce((sum, p) => sum + p.deviceCount, 0);

  return (
    <main className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {orgName}
          </span>
          <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
            Projects.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-text-secondary">
            Each project is a transport authority, an operating area, or an
            agency. Stand one up per ATMS connection and curate which devices
            reach the public traveller map.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-line-soft px-3 py-1.5 text-xs text-text-secondary">
            <Building2 size={12} strokeWidth={1.8} />
            {projects.length} total · {publishedCount} published
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-line-soft px-3 py-1.5 text-xs text-text-secondary">
            <Layers size={12} strokeWidth={1.8} />
            {totalDevices.toLocaleString()} devices
          </span>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            <Plus size={14} strokeWidth={1.8} />
            {showForm ? "Cancel" : "New project"}
          </button>
        </div>
      </header>

      {showForm && (
        <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
          <h2 className="mb-1 text-lg font-medium text-text-primary">
            Create project
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            One project per ATMS host, agency, or operating area. Renderer
            defaults to Mapbox.
          </p>
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

      {/* Projects */}
      {projects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-bg p-10 text-center">
          <Sparkles
            size={28}
            strokeWidth={1.6}
            className="mx-auto text-accent"
            aria-hidden
          />
          <h2 className="mt-4 text-lg font-medium text-text-primary">
            No projects yet.
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
            Spin up your first project to connect an ATMS, sync devices, and
            curate what reaches commuters.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            <Plus size={14} strokeWidth={1.8} />
            Create your first project
          </button>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group flex flex-col rounded-2xl border border-line-soft bg-bg p-6 transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/org/${orgId}/projects/${p.id}`}
                      className="text-lg font-medium text-text-primary transition-colors group-hover:text-accent"
                    >
                      {p.title}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Created {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {p.isPublished ? (
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

              <dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-surface-2 p-4">
                <Metric
                  icon={Database}
                  label="Sources"
                  value={p.sourceCount}
                />
                <Metric
                  icon={Layers}
                  label="Devices"
                  value={p.deviceCount}
                />
                <Metric
                  icon={Eye}
                  label={p.isPublic ? "Public" : "Private"}
                  value={p.isPublic ? "On" : "Off"}
                />
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href={`/org/${orgId}/projects/${p.id}/sources`}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  <Database
                    size={12}
                    strokeWidth={1.8}
                    aria-hidden
                    className="-mt-px mr-1 inline"
                  />
                  Sources
                </Link>
                <Link
                  href={`/org/${orgId}/projects/${p.id}/settings`}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
                >
                  <TrafficCone
                    size={12}
                    strokeWidth={1.8}
                    aria-hidden
                    className="-mt-px mr-1 inline"
                  />
                  Settings
                </Link>
                <Link
                  href={`/org/${orgId}/projects/${p.id}`}
                  className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
                >
                  <Compass size={12} strokeWidth={1.8} aria-hidden />
                  Open console
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
  icon: typeof Database;
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
