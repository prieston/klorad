/**
 * Per-campus Klio (AI assistant) configuration.
 *
 * Persisted under `Project.sceneData.klio`. Everything optional —
 * the assistant ships with sane defaults and the rector only fills
 * in what they want to override. Lives outside the assistant route
 * itself so the public chat (`KlioPanel`) and the admin authoring
 * screen (`/klio`) share the same parse + defaults code.
 *
 * Pure + isomorphic — no Prisma, no React. Safe to import from
 * server routes, client components, and `server-only` modules.
 */

import { ASSISTANT_TOOL_NAMES, type AssistantToolName } from "@/lib/assistant/tools";

/** Persona dimensions, both 1..5 scales. */
export interface KlioPersona {
  /** 1 = strict + formal · 5 = relaxed + casual. */
  formality: number;
  /** 1 = terse, 1-sentence answers · 5 = verbose, walk-through replies. */
  verbosity: number;
  /** Free-text additional instructions appended to the system prompt
   *  — e.g. "Always remind students about open office hours." */
  notes: string;
}

/** One suggestion chip — the empty-state "starter prompts" on Klio
 *  chat. Stored bilingual; the public surface picks the right
 *  language at render time and falls back to EN if EL is missing. */
export interface KlioChip {
  en: { label: string; prompt: string };
  el?: { label: string; prompt: string };
}

export interface KlioConfig {
  /** Per-tool kill switches. `false` disables; anything else means
   *  on. Stored as a sparse map so adding a new tool defaults to on. */
  tools: Record<AssistantToolName, boolean>;
  persona: KlioPersona;
  /** Empty array = use the built-in `DEFAULT_CHIPS` defined in the
   *  KlioPanel; non-empty overrides them. The split exists so a
   *  rector who deletes all chips still sees the platform defaults
   *  instead of an empty grid, which would make the chat look
   *  broken on first visit. */
  chips: KlioChip[];
}

export const DEFAULT_PERSONA: KlioPersona = {
  formality: 3,
  verbosity: 2,
  notes: "",
};

/** Returns a `tools` map with every known tool enabled. Source of
 *  truth for the admin UI's reset button and the parser's fallback
 *  when a row has never been saved. */
export function defaultTools(): Record<AssistantToolName, boolean> {
  const out = {} as Record<AssistantToolName, boolean>;
  for (const name of ASSISTANT_TOOL_NAMES) {
    out[name] = true;
  }
  return out;
}

export const DEFAULT_KLIO_CONFIG: KlioConfig = {
  tools: defaultTools(),
  persona: DEFAULT_PERSONA,
  chips: [],
};

const FORMALITY_CLAMP = clampRange(1, 5);
const VERBOSITY_CLAMP = clampRange(1, 5);

/** Validate + narrow whatever the JSON column hands us into a
 *  `KlioConfig`. Anything malformed is silently filled with the
 *  default; the assistant should keep answering even if a rector
 *  pasted nonsense into the DB through Prisma Studio. */
export function parseKlioConfig(value: unknown): KlioConfig {
  if (!value || typeof value !== "object") return DEFAULT_KLIO_CONFIG;
  const raw = value as Record<string, unknown>;
  return {
    tools: parseTools(raw.tools),
    persona: parsePersona(raw.persona),
    chips: parseChips(raw.chips),
  };
}

function parseTools(value: unknown): Record<AssistantToolName, boolean> {
  const out = defaultTools();
  if (!value || typeof value !== "object") return out;
  const raw = value as Record<string, unknown>;
  for (const name of ASSISTANT_TOOL_NAMES) {
    if (raw[name] === false) out[name] = false;
  }
  return out;
}

function parsePersona(value: unknown): KlioPersona {
  if (!value || typeof value !== "object") return DEFAULT_PERSONA;
  const raw = value as Record<string, unknown>;
  return {
    formality:
      typeof raw.formality === "number"
        ? FORMALITY_CLAMP(raw.formality)
        : DEFAULT_PERSONA.formality,
    verbosity:
      typeof raw.verbosity === "number"
        ? VERBOSITY_CLAMP(raw.verbosity)
        : DEFAULT_PERSONA.verbosity,
    notes:
      typeof raw.notes === "string" ? raw.notes.slice(0, 1000) : "",
  };
}

function parseChips(value: unknown): KlioChip[] {
  if (!Array.isArray(value)) return [];
  const out: KlioChip[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const en = parseChipLocale(e.en);
    if (!en) continue;
    const el = parseChipLocale(e.el);
    out.push(el ? { en, el } : { en });
  }
  return out.slice(0, 8);
}

function parseChipLocale(
  value: unknown,
): { label: string; prompt: string } | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  if (!label || !prompt) return null;
  return { label: label.slice(0, 60), prompt: prompt.slice(0, 240) };
}

function clampRange(min: number, max: number) {
  return (n: number) => {
    if (!Number.isFinite(n)) return Math.round((min + max) / 2);
    return Math.min(max, Math.max(min, Math.round(n)));
  };
}

/**
 * Persona dimensions translated into a system-prompt fragment. The
 * fragment is appended (no token-budget reason to drop it) to the
 * base prompt — Claude is happy folding behavioural tweaks in even
 * when they're terse.
 */
export function personaPromptFragment(persona: KlioPersona): string {
  const lines: string[] = [];
  if (persona.formality <= 2) {
    lines.push(
      "Use a formal, advisory tone — the way a department secretary writes.",
    );
  } else if (persona.formality >= 4) {
    lines.push(
      "Use a relaxed, friendly tone — the way a senior student would.",
    );
  }
  if (persona.verbosity <= 2) {
    lines.push(
      "Be very concise. One sentence is usually enough; never more than two.",
    );
  } else if (persona.verbosity >= 4) {
    lines.push(
      "It's fine to explain. Walk through the answer in 3-4 sentences, add helpful context.",
    );
  }
  if (persona.notes.trim()) {
    lines.push(`Additional campus instructions: ${persona.notes.trim()}`);
  }
  return lines.join("\n");
}
