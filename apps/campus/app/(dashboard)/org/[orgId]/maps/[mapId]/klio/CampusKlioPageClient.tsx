"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "react-toastify";
import {
  MessageSquare,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
  Textarea,
} from "@klorad/design-system";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";
import { AiKeyPanel } from "@/app/(dashboard)/org/[orgId]/maps/[mapId]/tabs/AiKeyPanel";
import { ASSISTANT_TOOL_NAMES, type AssistantToolName } from "@/lib/assistant/tools";
import {
  DEFAULT_KLIO_CONFIG,
  DEFAULT_PERSONA,
  defaultTools,
  parseKlioConfig,
  type KlioChip,
  type KlioConfig,
  type KlioPersona,
} from "@/lib/klio-config";

interface Props {
  orgId: string;
  mapId: string;
}

interface MapResponse {
  id: string;
  sceneData?: Record<string, unknown>;
}

const mapFetcher = (url: string): Promise<MapResponse> =>
  fetch(url).then((r) => r.json());

const TOOL_LABELS: Record<AssistantToolName, { title: string; hint: string }> =
  {
    search_places: {
      title: "Search places",
      hint: "Find buildings and rooms by free-text query.",
    },
    query_news: {
      title: "Query news",
      hint: "Pull recent news posts and cite them.",
    },
    query_events: {
      title: "Query events",
      hint: "List upcoming events filtered by anchor or time window.",
    },
    query_clubs: {
      title: "Query clubs",
      hint: "List the most active student clubs.",
    },
    query_dining: {
      title: "Query dining",
      hint: "Read the dining list — names, hours, cuisines.",
    },
    focus: {
      title: "Focus on a space",
      hint: "Pan the MappedIn viewer to a single building or room.",
    },
    route: {
      title: "Compute routes",
      hint: "Draw a from-X-to-Y route, including accessible variants.",
    },
    cite: {
      title: "Cite sources",
      hint: "Surface tappable cards for news/events/clubs/dining mentioned.",
    },
  };

/**
 * Klio — the AI campus assistant settings screen. Wired to
 * `sceneData.klio`:
 *   - tools: per-tool kill switches
 *   - persona: formality + verbosity sliders + free-text notes
 *   - chips: bilingual suggestion-prompt overrides for the chat
 *     empty state
 *
 * The BYOK API key panel lives next to these but speaks to a
 * different endpoint (`/api/maps/<mapId>/ai-settings`) — keys are
 * encrypted at rest and never round-trip through `sceneData`.
 */
export default function CampusKlioPageClient({
  orgId: _orgId,
  mapId,
}: Props) {
  const { data: server } = useSWR<MapResponse>(
    `/api/maps/${mapId}`,
    mapFetcher,
  );

  const [config, setConfig] = useState<KlioConfig>(DEFAULT_KLIO_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated || !server) return;
    setConfig(parseKlioConfig(server.sceneData?.klio));
    setHydrated(true);
  }, [hydrated, server]);

  const savedConfig = useMemo(
    () => parseKlioConfig(server?.sceneData?.klio),
    [server],
  );
  const dirty = useMemo(
    () => hydrated && !configsEqual(config, savedConfig),
    [hydrated, config, savedConfig],
  );

  const handleSave = async () => {
    if (!server || !dirty || saving) return;
    setSaving(true);
    try {
      const nextScene = { ...(server.sceneData ?? {}), klio: config };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData: nextScene }),
      });
      if (!res.ok) throw new Error("Failed");
      await globalMutate(`/api/maps/${mapId}`);
      toast.success("Klio settings saved");
    } catch {
      toast.error("Couldn't save Klio settings");
    } finally {
      setSaving(false);
    }
  };

  const setTool = (name: AssistantToolName, enabled: boolean) => {
    setConfig((c) => ({
      ...c,
      tools: { ...c.tools, [name]: enabled },
    }));
  };

  const setPersona = (patch: Partial<KlioPersona>) => {
    setConfig((c) => ({ ...c, persona: { ...c.persona, ...patch } }));
  };

  const setChips = (chips: KlioChip[]) => {
    setConfig((c) => ({ ...c, chips }));
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Klio"
        subtitle="The AI campus assistant, powered by Claude. BYOK Anthropic key, choose its tools, shape its tone, and seed the prompts students see first."
        actions={
          <>
            <OpenPublicAction href={`/campus/${mapId}/klio`} />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <AiKeyPanel mapId={mapId} />

        {/* ─ Tools ─────────────────────────────────────────────── */}
        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Wrench size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-text-primary">
                Tools Klio can call
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Each tool is exposed to the model only when toggled on.
                Disabling a tool also drops the related instructions
                from the system prompt so Claude won&rsquo;t pretend it
                has them.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfig((c) => ({ ...c, tools: defaultTools() }))
              }
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline"
            >
              <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
              Reset
            </button>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ASSISTANT_TOOL_NAMES.map((name) => {
              const meta = TOOL_LABELS[name];
              const enabled = config.tools[name] !== false;
              return (
                <li
                  key={name}
                  className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-2/30 p-3"
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={meta.title}
                    onClick={() => setTool(name, !enabled)}
                    className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      enabled ? "bg-accent" : "bg-surface-2"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                        enabled ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">
                      {meta.title}
                    </div>
                    <div className="mt-0.5 text-xs text-text-tertiary">
                      {meta.hint}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* ─ Persona ───────────────────────────────────────────── */}
        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Sliders size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-text-primary">
                Persona &amp; tone
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Shape how Klio speaks. Defaults sit in the middle of
                each slider so the assistant works fine even when this
                screen is untouched.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPersona(DEFAULT_PERSONA)}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline"
            >
              <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
              Reset
            </button>
          </div>
          <div className="space-y-5">
            <PersonaSlider
              label="Formality"
              hint="Strict + formal · Relaxed + friendly"
              leftLabel="Formal"
              rightLabel="Casual"
              value={config.persona.formality}
              onChange={(v) => setPersona({ formality: v })}
            />
            <PersonaSlider
              label="Verbosity"
              hint="Terse answers · Detailed explanations"
              leftLabel="Concise"
              rightLabel="Verbose"
              value={config.persona.verbosity}
              onChange={(v) => setPersona({ verbosity: v })}
            />
            <Field
              label="Additional instructions (optional)"
              hint={`${1000 - config.persona.notes.length} characters left. Appended verbatim to the system prompt.`}
            >
              <Textarea
                value={config.persona.notes}
                onChange={(e) =>
                  setPersona({ notes: e.target.value.slice(0, 1000) })
                }
                placeholder="Always remind students about open office hours on Wednesdays."
                rows={3}
                maxLength={1000}
              />
            </Field>
          </div>
        </Panel>

        {/* ─ Suggestion chips ──────────────────────────────────── */}
        <Panel className="rounded-2xl p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <MessageSquare size={16} strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-text-primary">
                Suggestion chips
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Empty-state prompts on the Klio chat. Leave blank to
                use the platform&rsquo;s defaults. EN is required; EL
                falls back to EN on Greek-locale visitors when blank.
                Max eight chips.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChips([])}
              disabled={config.chips.length === 0}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
              Use defaults
            </button>
          </div>
          <ChipsEditor value={config.chips} onChange={setChips} />
        </Panel>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function PersonaSlider({
  label,
  hint,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </span>
        <span className="text-[11px] text-text-tertiary">{hint}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-[11px] text-text-tertiary">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function ChipsEditor({
  value,
  onChange,
}: {
  value: KlioChip[];
  onChange: (next: KlioChip[]) => void;
}) {
  const addChip = () => {
    if (value.length >= 8) return;
    onChange([
      ...value,
      { en: { label: "", prompt: "" } },
    ]);
  };

  const update = (idx: number, patch: Partial<KlioChip>) => {
    const copy = [...value];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  const updateLocale = (
    idx: number,
    lang: "en" | "el",
    patch: { label?: string; prompt?: string },
  ) => {
    const copy = [...value];
    const existing = copy[idx][lang] ?? { label: "", prompt: "" };
    copy[idx] = { ...copy[idx], [lang]: { ...existing, ...patch } };
    onChange(copy);
  };

  const remove = (idx: number) => {
    const copy = [...value];
    copy.splice(idx, 1);
    onChange(copy);
  };

  if (value.length === 0) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-dashed border-line-soft bg-surface-2/40 px-4 py-6 text-center text-xs text-text-tertiary">
          No custom chips. Platform defaults will show on the chat
          screen.
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={addChip}
        >
          <Plus size={12} strokeWidth={1.75} aria-hidden />
          Add chip
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {value.map((chip, idx) => (
          <li
            key={idx}
            className="space-y-2 rounded-xl border border-line-soft bg-surface-2/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                Chip {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                aria-label="Remove chip"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-red-500"
              >
                <Trash2 size={12} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <ChipLocaleFields
              lang="en"
              label="English"
              labelValue={chip.en.label}
              promptValue={chip.en.prompt}
              onChange={(patch) => updateLocale(idx, "en", patch)}
            />
            <ChipLocaleFields
              lang="el"
              label="Greek (optional)"
              labelValue={chip.el?.label ?? ""}
              promptValue={chip.el?.prompt ?? ""}
              onChange={(patch) => {
                if (
                  !patch.label?.trim() &&
                  !patch.prompt?.trim() &&
                  (chip.el?.label ?? "").trim().length <= 1 &&
                  (chip.el?.prompt ?? "").trim().length <= 1
                ) {
                  // Drop the EL key entirely when both fields are
                  // empty after this keystroke — keeps the saved
                  // shape clean.
                  const { el: _drop, ...rest } = chip;
                  void _drop;
                  update(idx, rest);
                  return;
                }
                updateLocale(idx, "el", patch);
              }}
            />
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={addChip}
        disabled={value.length >= 8}
      >
        <Plus size={12} strokeWidth={1.75} aria-hidden />
        Add chip
      </Button>
    </div>
  );
}

function ChipLocaleFields({
  lang,
  label,
  labelValue,
  promptValue,
  onChange,
}: {
  lang: "en" | "el";
  label: string;
  labelValue: string;
  promptValue: string;
  onChange: (patch: { label?: string; prompt?: string }) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
      <Field label={`Label · ${label}`}>
        <Input
          value={labelValue}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={lang === "en" ? "Where's the gym?" : "Πού είναι το γυμναστήριο;"}
          maxLength={60}
        />
      </Field>
      <Field label="Prompt sent to Klio">
        <Input
          value={promptValue}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={
            lang === "en"
              ? "Where's the gym?"
              : "Πού είναι το γυμναστήριο και τι ωράριο έχει;"
          }
          maxLength={240}
        />
      </Field>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

function configsEqual(a: KlioConfig, b: KlioConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
