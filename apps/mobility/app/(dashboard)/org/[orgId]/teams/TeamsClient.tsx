"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import { Plus, Trash2, Users, ChevronRight, Loader2 } from "lucide-react";
import type { OrganizationRole } from "@prisma/client";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

interface ListResponse {
  teams: Team[];
}

export function TeamsClient({
  orgId,
  orgName,
  yourRole,
}: {
  orgId: string;
  orgName: string;
  yourRole: OrganizationRole | null;
}) {
  const canManage = yourRole === "owner" || yourRole === "admin";
  const { data, isLoading, mutate } = useSWR<ListResponse>(
    `/api/orgs/${orgId}/teams`,
    fetcher,
  );
  const teams = data?.teams ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || null,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Create failed");
        return;
      }
      toast.success(`Team "${trimmed}" created`);
      setName("");
      setDescription("");
      void mutate();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (team: Team) => {
    if (
      !confirm(
        `Delete team "${team.name}"? Members lose team-based world access — direct grants are unaffected.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/orgs/${orgId}/teams/${team.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      toast.error(body.error ?? "Delete failed");
      return;
    }
    toast.success(`Team "${team.name}" deleted`);
    void mutate();
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {orgName}
        </p>
        <h1 className="mt-1 text-3xl font-light text-text-primary">Teams</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Named groups of org members. Grant world access to a whole team at
          once instead of picking individual users.
        </p>
      </header>

      {canManage && (
        <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
          <h2 className="mb-4 text-lg font-medium text-text-primary">
            Create a team
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Traffic control room"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-tertiary">Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary"
              />
            </label>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={create}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Create team
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line-soft bg-bg">
        <div className="border-b border-line-soft px-6 py-4">
          <h2 className="text-lg font-medium text-text-primary">All teams</h2>
        </div>
        {isLoading ? (
          <p className="px-6 py-8 text-sm text-text-tertiary">Loading…</p>
        ) : teams.length === 0 ? (
          <p className="px-6 py-8 text-sm text-text-tertiary">
            No teams yet.{" "}
            {canManage
              ? "Create one above to start grouping org members."
              : "Ask an admin to create one."}
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-6 py-4">
                <Link
                  href={`/org/${orgId}/teams/${t.id}`}
                  className="group flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-text-primary group-hover:text-accent">
                      {t.name}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                      <Users size={9} strokeWidth={2.2} />
                      {t.memberCount}
                    </span>
                  </div>
                  {t.description && (
                    <p className="mt-1 truncate text-sm text-text-secondary">
                      {t.description}
                    </p>
                  )}
                </Link>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    aria-label={`Delete ${t.name}`}
                    className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <Link
                  href={`/org/${orgId}/teams/${t.id}`}
                  aria-label={`Open ${t.name}`}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
                >
                  <ChevronRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
