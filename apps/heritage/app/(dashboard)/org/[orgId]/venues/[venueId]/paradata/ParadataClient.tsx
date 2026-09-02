"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ShieldCheck } from "lucide-react";
import { Button, EmptyState, Field, Input, Select } from "@klorad/design-system";
import { PageHeader } from "@/lib/heritage/ui/page-header";

const METHODS = [
  ["unknown", "Not recorded"],
  ["photogrammetry", "Photogrammetry"],
  ["laser_scan", "Laser scan"],
  ["structured_light", "Structured light"],
  ["gaussian_splat", "Gaussian splat capture"],
  ["manual_model", "Modelled by hand"],
  ["photography", "Photography"],
  ["born_digital", "Born digital"],
] as const;

type Method = (typeof METHODS)[number][0];

interface Paradata {
  method: Method;
  deviceName: string | null;
  capturedAt: string | null;
  operatorActorId: string | null;
  vigieComplexity: string | null;
  intendedPurpose: string | null;
  accuracyMeters: number | null;
  processingChain: unknown[];
}

interface Row {
  id: string;
  kind: string;
  label: string;
  format: string | null;
  paradata: Paradata | null;
}

const empty = (): Paradata => ({
  method: "unknown",
  deviceName: null,
  capturedAt: null,
  operatorActorId: null,
  vigieComplexity: null,
  intendedPurpose: null,
  accuracyMeters: null,
  processingChain: [],
});

export function ParadataClient({
  venueId,
  actors,
  initial,
}: {
  venueId: string;
  actors: { id: string; label: string }[];
  initial: Row[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Paradata>(empty());
  const [saving, setSaving] = useState(false);

  const documented = initial.filter(
    (r) => r.paradata && r.paradata.method !== "unknown",
  ).length;

  const openRow = (r: Row) => {
    setOpenId(r.id);
    setForm(r.paradata ?? empty());
  };

  const save = async () => {
    if (!openId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/venues/${venueId}/representations/${openId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paradata: {
              method: form.method,
              deviceName: form.deviceName || null,
              capturedAt: form.capturedAt
                ? new Date(form.capturedAt).toISOString()
                : null,
              operatorActorId: form.operatorActorId,
              vigieComplexity: form.vigieComplexity || null,
              intendedPurpose: form.intendedPurpose || null,
              accuracyMeters: form.accuracyMeters,
            },
          }),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Save failed");
        return;
      }
      toast.success("Paradata saved");
      setOpenId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-10">
      <PageHeader
        title="How it was made."
        lede="How each capture was made. Attached to the capture, never to the object — one sculpture may carry a 2009 laser scan and a 2026 splat capture with entirely different trustworthiness, and a curator has to be able to see which is which."
      />

      {initial.length > 0 && (
        <p className="mb-6 text-sm text-text-secondary">
          <strong className="font-medium text-text-primary">
            {documented} of {initial.length}
          </strong>{" "}
          captures have a documented method.
          {documented < initial.length ? (
            <span className="text-text-tertiary">
              {" "}
              The rest carry no capture history, which is the gap a researcher
              notices first.
            </span>
          ) : null}
        </p>
      )}

      {initial.length === 0 ? (
        <EmptyState
          tone="dashed"
          icon={ShieldCheck}
          title="Nothing captured yet."
          body="Paradata attaches to a capture. Ingest one and its record appears here."
        />
      ) : (
        <ul className="space-y-3">
          {initial.map((r) => {
            const isOpen = openId === r.id;
            const p = r.paradata;
            return (
              <li key={r.id} className="rounded-2xl border border-line-soft bg-bg">
                <button
                  type="button"
                  onClick={() => (isOpen ? setOpenId(null) : openRow(r))}
                  className="flex w-full flex-wrap items-center gap-4 p-5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {r.label}
                    </p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {r.kind}
                      {r.format ? ` · .${r.format}` : ""}
                      {p?.capturedAt ? ` · captured ${p.capturedAt}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                      p && p.method !== "unknown"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-700"
                    }`}
                  >
                    {p && p.method !== "unknown"
                      ? METHODS.find(([v]) => v === p.method)?.[1]
                      : "Undocumented"}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-line-soft p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Capture method">
                        <Select
                          value={form.method}
                          onChange={(e) =>
                            setForm({ ...form, method: e.target.value as Method })
                          }
                        >
                          {METHODS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Device" hint="Scanner, camera or rig used.">
                        <Input
                          value={form.deviceName ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, deviceName: e.target.value })
                          }
                          placeholder="e.g. Faro Focus S150"
                        />
                      </Field>
                      <Field label="Capture date">
                        <Input
                          type="date"
                          value={form.capturedAt ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, capturedAt: e.target.value || null })
                          }
                        />
                      </Field>
                      <Field label="Operator">
                        <Select
                          value={form.operatorActorId ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              operatorActorId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">— not recorded —</option>
                          {actors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Complexity degree"
                        hint="From the EU 3D digitisation quality study, if the capture was specified against it."
                      >
                        <Input
                          value={form.vigieComplexity ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, vigieComplexity: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Spatial accuracy (m)"
                        hint="Where the capture reports one."
                      >
                        <Input
                          type="number"
                          step="0.001"
                          value={form.accuracyMeters ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              accuracyMeters:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Intended purpose"
                        hint="What the capture was commissioned for. A scan made for an exhibition render is not a scan made for conservation."
                        className="sm:col-span-2"
                      >
                        <Input
                          value={form.intendedPurpose ?? ""}
                          onChange={(e) =>
                            setForm({ ...form, intendedPurpose: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    {form.processingChain.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
                          Processing chain
                        </p>
                        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-[11px] text-text-secondary">
                          {JSON.stringify(form.processingChain, null, 2)}
                        </pre>
                        <p className="mt-2 text-[11px] text-text-tertiary">
                          Recorded by the pipeline, not editable here — that is
                          the point of it being automatic.
                        </p>
                      </div>
                    )}

                    <div className="mt-6 flex gap-3">
                      <Button onClick={save} disabled={saving}>
                        {saving ? "Saving…" : "Save paradata"}
                      </Button>
                      <Button variant="secondary" onClick={() => setOpenId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
