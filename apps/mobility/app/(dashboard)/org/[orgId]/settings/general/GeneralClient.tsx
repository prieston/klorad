"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Building2, Crown, Globe2, Receipt, Shield } from "lucide-react";
import type { OrganizationRole } from "@prisma/client";

interface Initial {
  name: string;
  slug: string;
  planCode: string;
  createdAt: string;
}

export function GeneralClient({
  orgId,
  yourRole,
  initial,
  projectCount,
}: {
  orgId: string;
  yourRole: OrganizationRole;
  initial: Initial;
  projectCount: number;
}) {
  const canManage = yourRole === "owner" || yourRole === "admin";
  const [name, setName] = useState(initial.name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Save failed");
        return;
      }
      toast.success("Saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <header className="mb-10">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          {initial.name}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          Organisation settings.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-text-secondary">
          Top-level details that apply across every project under this
          organisation.
        </p>
      </header>

      {/* Facts row */}
      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <FactCard
          icon={Crown}
          label="Your role"
          value={yourRole}
        />
        <FactCard
          icon={Building2}
          label="Projects"
          value={projectCount}
        />
        <FactCard
          icon={Receipt}
          label="Plan"
          value={initial.planCode}
        />
        <FactCard
          icon={Globe2}
          label="Slug"
          value={initial.slug}
        />
      </section>

      {/* Name */}
      <section className="mb-8 rounded-2xl border border-line-soft bg-bg p-6">
        <h2 className="mb-1 text-lg font-medium text-text-primary">Name</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Displayed in the sidebar, on every project card, and in invite
          emails.
        </p>
        <div className="grid gap-3 md:max-w-lg">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canManage}
            className="w-full rounded-md border border-line-strong bg-bg px-3 py-2 text-text-primary disabled:opacity-60"
          />
          <button
            type="button"
            onClick={save}
            disabled={!canManage || saving || name === initial.name}
            className="self-start rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Rename"}
          </button>
        </div>
      </section>

      {/* Immutable */}
      <section className="rounded-2xl border border-line-soft bg-bg p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-medium text-text-primary">
          <Shield size={16} strokeWidth={1.8} className="text-text-tertiary" />
          Immutable
        </h2>
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
              Slug
            </dt>
            <dd className="mt-1 font-mono text-sm text-text-primary">
              {initial.slug}
            </dd>
            <p className="mt-1 text-xs text-text-tertiary">
              Used in URLs. Locked because changing it would break every
              member&apos;s bookmarks + outstanding invites.
            </p>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
              Created
            </dt>
            <dd className="mt-1 text-sm text-text-primary">
              {new Date(initial.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function FactCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-bg p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-text-tertiary">
        <Icon size={11} strokeWidth={1.8} aria-hidden />
        {label}
      </div>
      <div className="mt-2 text-base font-medium capitalize text-text-primary">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
