"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { Boxes, Plus, Search, Trash2 } from "lucide-react";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
} from "@klorad/design-system";
import { PageHeader } from "@/lib/heritage/ui/page-header";
import {
  LocalizedField,
  compactLocalized,
  type LocalizedValue,
} from "@/lib/heritage/ui/localized-field";
import { StateBadge, PUBLISH_STATES, type PublishState } from "@/lib/heritage/ui/state";
import { pickLocalized } from "@/lib/heritage/i18n";
import { slugify } from "@/lib/heritage/slug";
import { ALL_RIGHTS, RIGHTS_LABEL } from "@/lib/heritage/rights";

type Rights = (typeof ALL_RIGHTS)[number];

interface Row {
  id: string;
  slug: string;
  identifier: string | null;
  title: LocalizedValue;
  description: LocalizedValue;
  creditLine: LocalizedValue;
  objectType: string | null;
  materials: string[];
  spaceId: string | null;
  periodId: string | null;
  rights: Rights | null;
  rightsHolder: string | null;
  externalUri: string | null;
  sortOrder: number;
  state: PublishState;
  representationCount: number;
  proxyCount: number;
}

type Draft = Omit<Row, "id" | "representationCount" | "proxyCount">;

const blank = (): Draft => ({
  slug: "",
  identifier: null,
  title: {},
  description: {},
  creditLine: {},
  objectType: null,
  materials: [],
  spaceId: null,
  periodId: null,
  rights: null,
  rightsHolder: null,
  externalUri: null,
  sortOrder: 0,
  state: "draft",
});

export function ObjectsClient({
  venueId,
  orgId,
  languages,
  defaultLanguage,
  spaces,
  periods,
  initial,
}: {
  orgId: string;
  venueId: string;
  languages: string[];
  defaultLanguage: string;
  spaces: { id: string; label: string }[];
  periods: { id: string; label: string }[];
  initial: Row[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const form: Draft = editing ?? draft;
  const setForm = (patch: Partial<Draft>) =>
    editing
      ? setEditing({ ...editing, ...patch })
      : setDraft({ ...draft, ...patch });

  const close = () => {
    setEditing(null);
    setCreating(false);
    setDraft(blank());
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((o) => {
      const title = pickLocalized(o.title, defaultLanguage) ?? "";
      return (
        title.toLowerCase().includes(q) ||
        (o.identifier ?? "").toLowerCase().includes(q) ||
        o.slug.includes(q)
      );
    });
  }, [initial, query, defaultLanguage]);

  const save = async () => {
    const title = compactLocalized(form.title);
    if (!title[defaultLanguage]) {
      toast.error(`Give the object a title in ${defaultLanguage}`);
      return;
    }
    const slug = form.slug || slugify(title[defaultLanguage]);
    if (!slug) {
      toast.error("That title doesn't produce a usable URL — set one manually");
      return;
    }
    setSaving(true);
    try {
      const body = {
        slug,
        title,
        description: compactLocalized(form.description),
        creditLine: compactLocalized(form.creditLine),
        identifier: form.identifier || null,
        objectType: form.objectType || null,
        materials: form.materials,
        spaceId: form.spaceId,
        periodId: form.periodId,
        rights: form.rights,
        rightsHolder: form.rightsHolder || null,
        externalUri: form.externalUri || null,
        sortOrder: form.sortOrder,
        ...(editing ? { state: form.state } : {}),
      };
      const res = await fetch(
        editing
          ? `/api/venues/${venueId}/objects/${editing.id}`
          : `/api/venues/${venueId}/objects`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Save failed");
        return;
      }
      toast.success(editing ? "Object updated" : "Object created");
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (row.representationCount > 0) {
      toast.error(
        `This object has ${row.representationCount} captures. Deleting it would orphan their provenance — detach them first.`,
      );
      return;
    }
    const res = await fetch(`/api/venues/${venueId}/objects/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      toast.error(json.error ?? "Delete failed");
      return;
    }
    toast.success("Object deleted");
    router.refresh();
  };

  const open = creating || editing !== null;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="Items."
        lede="Everything in your collection. Each one can carry a 3D model, photos, audio and video — and the record stays yours even if the model is replaced."
        actions={
          // The primary action is the upload-first flow, because that is how
          // an item is normally born. The blank-record form stays available
          // for a curator cataloguing ahead of the scanning, but it is no
          // longer the only door.
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (open ? close() : setCreating(true))}
              className="rounded-full border border-line-soft px-4 py-2 text-xs text-text-secondary transition hover:bg-surface-2"
            >
              {open ? "Cancel" : "Add without a file"}
            </button>
            <Link
              href={`/org/${orgId}/venues/${venueId}/items/new`}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              <Plus size={13} strokeWidth={2} aria-hidden />
              Add an item
            </Link>
          </div>
        }
      />

      {open && (
        <Panel className="mb-8 rounded-2xl p-6">
          <h2 className="mb-5 text-lg font-medium text-text-primary">
            {editing ? "Edit object" : "Create object"}
          </h2>
          <div className="grid gap-5">
            <LocalizedField
              label="Title"
              value={form.title}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(title) => setForm({ title })}
              placeholder="e.g. Marble kore"
            />
            <LocalizedField
              label="Description"
              multiline
              value={form.description}
              languages={languages}
              defaultLanguage={defaultLanguage}
              onChange={(description) => setForm({ description })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Inventory number"
                hint="The institution's own accession identifier."
              >
                <Input
                  value={form.identifier ?? ""}
                  onChange={(e) => setForm({ identifier: e.target.value })}
                  placeholder="e.g. ΑΜΘ 1987.42"
                />
              </Field>
              <Field label="Object type" hint="A Getty AAT term where you use one.">
                <Input
                  value={form.objectType ?? ""}
                  onChange={(e) => setForm({ objectType: e.target.value })}
                  placeholder="e.g. statue"
                />
              </Field>
              <Field label="Space">
                <Select
                  value={form.spaceId ?? ""}
                  onChange={(e) => setForm({ spaceId: e.target.value || null })}
                >
                  <option value="">— not placed —</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Period">
                <Select
                  value={form.periodId ?? ""}
                  onChange={(e) => setForm({ periodId: e.target.value || null })}
                >
                  <option value="">— undated —</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Materials"
                hint="Comma separated."
                className="sm:col-span-2"
              >
                <Input
                  value={form.materials.join(", ")}
                  onChange={(e) =>
                    setForm({
                      materials: e.target.value
                        .split(",")
                        .map((m) => m.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="marble, pigment"
                />
              </Field>
            </div>

            <fieldset className="rounded-xl border border-line-soft p-4">
              <legend className="px-2 text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
                Rights on the original
              </legend>
              <p className="mb-4 text-xs leading-relaxed text-text-tertiary">
                Each capture carries its own statement separately. A read
                resolves to whichever of the two is more restrictive, so leaving
                this unset does not make a capture freer — it resolves to
                Copyright Not Evaluated.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rights statement">
                  <Select
                    value={form.rights ?? ""}
                    onChange={(e) =>
                      setForm({ rights: (e.target.value || null) as Rights | null })
                    }
                  >
                    <option value="">— not evaluated —</option>
                    {ALL_RIGHTS.map((r) => (
                      <option key={r} value={r}>
                        {RIGHTS_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Rights holder">
                  <Input
                    value={form.rightsHolder ?? ""}
                    onChange={(e) => setForm({ rightsHolder: e.target.value })}
                  />
                </Field>
                <LocalizedField
                  label="Credit line"
                  value={form.creditLine}
                  languages={languages}
                  defaultLanguage={defaultLanguage}
                  onChange={(creditLine) => setForm({ creditLine })}
                />
                <Field
                  label="Source record"
                  hint="Stable URI in your collections system. Becomes edm:isShownAt."
                >
                  <Input
                    value={form.externalUri ?? ""}
                    onChange={(e) => setForm({ externalUri: e.target.value })}
                    placeholder="https://…"
                  />
                </Field>
              </div>
            </fieldset>

            {editing && (
              <Field label="Publication state">
                <Select
                  value={form.state}
                  onChange={(e) =>
                    setForm({ state: e.target.value as PublishState })
                  }
                >
                  {PUBLISH_STATES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </Button>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {initial.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-full border border-line-soft px-4 py-2">
          <Search size={14} strokeWidth={1.8} aria-hidden className="text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or inventory number"
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      )}

      {initial.length === 0 ? (
        <EmptyState
          tone="dashed"
          icon={Boxes}
          title="No items yet."
          body="Record the physical originals first. Captures attach to them, never the other way round."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus size={14} strokeWidth={1.8} aria-hidden />
              Create the first object
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-tertiary">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {filtered.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(o);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-medium text-text-primary hover:text-accent">
                  {pickLocalized(o.title, defaultLanguage) ?? o.slug}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-text-tertiary">
                  {o.identifier ? <span>{o.identifier}</span> : null}
                  <span>{o.representationCount} captures</span>
                  {o.rights ? (
                    <span>{RIGHTS_LABEL[o.rights]}</span>
                  ) : (
                    <span className="text-amber-600">no rights statement</span>
                  )}
                </p>
              </button>
              <StateBadge state={o.state} />
              <button
                type="button"
                onClick={() => void remove(o)}
                aria-label="Delete object"
                className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-2 hover:text-red-600"
              >
                <Trash2 size={14} strokeWidth={1.8} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
