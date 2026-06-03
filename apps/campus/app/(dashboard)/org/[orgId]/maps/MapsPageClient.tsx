"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button, Field, Input, Modal } from "@klorad/design-system";
import { useMaps } from "@/app/hooks/useMaps";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { CampusCard } from "@/app/(dashboard)/components/CampusCard";

interface Props {
  orgId: string;
  userId: string;
}

type Filter = "all" | "published" | "drafts";

/**
 * Org Campuses — the searchable / filterable grid of every campus this
 * organisation runs. The Org Overview's "Most active" rail is a
 * curated three; this is the place to find any campus by name or
 * publication state.
 *
 * Mirrors the IHU mock: header (title + "New campus"), search +
 * three pills (All / Published / Drafts), the grid, and an "Add a
 * campus" dashed tile at the end so creating one feels native to the
 * grid instead of hiding behind a header CTA only.
 *
 * Per [[campus-backoffice-redesign]], the world map that used to live
 * here was promoted to the Org Overview — this screen is now purely
 * about *which* campuses exist, not *where* they are.
 */
export default function MapsPageClient({ orgId }: Props) {
  const router = useRouter();
  const { maps, isLoading, createMap } = useMaps(orgId);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const closeCreate = () => {
    if (creating) return;
    setCreateOpen(false);
    setNewName("");
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const map = await createMap(newName.trim());
    setCreating(false);
    setCreateOpen(false);
    setNewName("");
    if (map) router.push(`/org/${orgId}/maps/${map.id}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return maps.filter((m) => {
      if (filter === "published" && !m.isPublished) return false;
      if (filter === "drafts" && m.isPublished) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [maps, filter, query]);

  const counts = useMemo(
    () => ({
      all: maps.length,
      published: maps.filter((m) => m.isPublished).length,
      drafts: maps.filter((m) => !m.isPublished).length,
    }),
    [maps],
  );

  const showSkeleton = isLoading && maps.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Organisation"
        title="Campuses"
        subtitle="Pick a campus to manage its public app — or spin up a new one."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} strokeWidth={1.75} aria-hidden />
            New campus
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search
            size={14}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campuses…"
            className="h-9 w-full rounded-full border border-line-soft bg-surface-1 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus-visible:border-accent"
          />
        </div>
        <div
          role="tablist"
          aria-label="Filter campuses"
          className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-1 p-1"
        >
          {(["all", "published", "drafts"] as Filter[]).map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setFilter(f)}
                className={
                  isActive
                    ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white"
                    : "rounded-full px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary"
                }
              >
                <span className="capitalize">{f}</span>
                <span className="ml-1 text-text-tertiary">
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {showSkeleton
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[208px] animate-pulse rounded-2xl bg-surface-2"
              />
            ))
          : filtered.map((m) => (
              <CampusCard
                key={m.id}
                id={m.id}
                name={m.name}
                isPublished={m.isPublished}
                updatedAt={m.updatedAt}
                thumbnail={m.thumbnail ?? null}
                href={`/org/${orgId}/maps/${m.id}`}
              />
            ))}

        {!showSkeleton && filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-line-soft bg-surface-1 px-6 py-10 text-center text-sm text-text-secondary">
            {query
              ? "No campuses match that search."
              : filter === "published"
                ? "No published campuses yet."
                : filter === "drafts"
                  ? "No drafts."
                  : "No campuses yet."}
          </div>
        ) : null}

        {!showSkeleton ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="group flex min-h-[208px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface-1 text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Plus size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="text-sm font-medium">Add a campus</span>
            <span className="text-xs text-text-tertiary">
              Link a MappedIn venue and brand it in minutes.
            </span>
          </button>
        ) : null}
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="New campus"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeCreate}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? "Creating…" : "Create campus"}
            </Button>
          </>
        }
      >
        <Field label="Campus name">
          <Input
            autoFocus
            placeholder="e.g. Main Campus"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </Field>
      </Modal>
    </div>
  );
}
