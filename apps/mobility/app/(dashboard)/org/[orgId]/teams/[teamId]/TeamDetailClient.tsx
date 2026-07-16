"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "react-toastify";
import { ArrowLeft, Loader2, Plus, X, Search } from "lucide-react";
import type { OrganizationRole } from "@prisma/client";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

interface TeamMember {
  id: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface TeamResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  members: TeamMember[];
}

interface OrgMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface OrgMembersResponse {
  members: OrgMember[];
}

export function TeamDetailClient({
  orgId,
  orgName,
  teamId,
  teamName,
  yourRole,
}: {
  orgId: string;
  orgName: string;
  teamId: string;
  teamName: string;
  yourRole: OrganizationRole | null;
}) {
  const canManage = yourRole === "owner" || yourRole === "admin";
  const { data: team, mutate: mutateTeam } = useSWR<TeamResponse>(
    `/api/orgs/${orgId}/teams/${teamId}`,
    fetcher,
  );
  const { data: orgMembersData } = useSWR<OrgMembersResponse>(
    `/api/orgs/${orgId}/members`,
    fetcher,
  );

  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Members not yet in the team, matching the search query.
  const candidates = useMemo(() => {
    if (!orgMembersData || !team) return [];
    const inTeam = new Set(team.members.map((m) => m.userId));
    const q = query.trim().toLowerCase();
    return orgMembersData.members.filter((m) => {
      if (inTeam.has(m.userId)) return false;
      if (!q) return true;
      return (
        (m.user.name ?? "").toLowerCase().includes(q) ||
        (m.user.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [orgMembersData, team, query]);

  const add = async (userId: string) => {
    setBusyId(userId);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/teams/${teamId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Add failed");
        return;
      }
      void mutateTeam();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (member: TeamMember) => {
    setBusyId(member.id);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/teams/${teamId}/members/${member.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        toast.error(body.error ?? "Remove failed");
        return;
      }
      void mutateTeam();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 md:px-10">
      <header className="mb-8">
        <Link
          href={`/org/${orgId}/teams`}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary hover:text-text-primary"
        >
          <ArrowLeft size={12} />
          {orgName} · Teams
        </Link>
        <h1 className="mt-1 text-3xl font-light text-text-primary">
          {teamName}
        </h1>
        {team?.description && (
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            {team.description}
          </p>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-line-soft bg-bg">
          <div className="border-b border-line-soft px-5 py-4">
            <h2 className="text-sm font-medium text-text-primary">
              Members ({team?.members.length ?? 0})
            </h2>
          </div>
          {!team ? (
            <p className="px-5 py-6 text-sm text-text-tertiary">Loading…</p>
          ) : team.members.length === 0 ? (
            <p className="px-5 py-6 text-sm text-text-tertiary">
              No one on this team yet.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {team.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-text-primary">
                      {m.user.name ?? m.user.email ?? m.user.id}
                    </p>
                    {m.user.name && m.user.email && (
                      <p className="truncate text-[11px] text-text-tertiary">
                        {m.user.email}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      disabled={busyId === m.id}
                      aria-label={`Remove ${m.user.name ?? m.user.email}`}
                      className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                    >
                      {busyId === m.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <X size={14} />
                      )}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage && (
          <section className="rounded-2xl border border-line-soft bg-bg">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="text-sm font-medium text-text-primary">
                Add org members
              </h2>
            </div>
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center gap-2 rounded-md border border-line-soft bg-bg pl-3">
                <Search size={14} className="text-text-tertiary" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary"
                />
              </div>
              {!orgMembersData ? (
                <p className="text-sm text-text-tertiary">Loading…</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-text-tertiary">
                  {query
                    ? "No matching org member."
                    : "Every org member is already on this team."}
                </p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {candidates.slice(0, 20).map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm text-text-primary">
                          {m.user.name ?? m.user.email ?? m.user.id}
                        </p>
                        {m.user.name && m.user.email && (
                          <p className="truncate text-[11px] text-text-tertiary">
                            {m.user.email}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => add(m.userId)}
                        disabled={busyId === m.userId}
                        className="inline-flex items-center gap-1 rounded-md border border-line-soft px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        {busyId === m.userId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Plus size={12} />
                        )}
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {candidates.length > 20 && (
                <p className="mt-2 text-[11px] text-text-tertiary">
                  Showing 20 of {candidates.length} — refine the search.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
