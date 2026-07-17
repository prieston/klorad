"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowRight, ArrowUp, Sparkles } from "lucide-react";

export interface AssistantSuggestion {
  /** Visible label on the suggestion chip. */
  label: string;
  /** Prompt sent to the assistant when tapped. */
  prompt: string;
}

export interface AssistantMessage<TAction = unknown> {
  role: "user" | "assistant";
  text: string;
  /** Structured deep-link cards / tool-use results the assistant
   *  surfaced for this turn. Rendered by the caller-supplied
   *  `renderActions` prop — the panel doesn't interpret them. */
  actions?: TAction[];
}

export interface AssistantPanelProps<TAction = unknown> {
  /**
   * Backend URL the panel POSTs each user message to. The endpoint
   * should return `{reply: string, actions?: TAction[]}`; anything
   * else in the request body (mapId, tenant, locale, tool schema) is
   * passed through as `extraBody`.
   */
  endpoint: string;
  /** Merged into every POST body so the backend can scope its tools
   *  to the caller's tenant. Common keys: `mapId`, `worldId`,
   *  `locale`, `projectId`. */
  extraBody?: Record<string, unknown>;
  /** Hero heading — shown until the first message. */
  heroTitle: string;
  /** Hero subtitle — shown until the first message. */
  heroSubtitle: string;
  /** Zero to N suggestion chips shown in the hero state. */
  suggestions: AssistantSuggestion[];
  /** Placeholder inside the input. Default: "Ask anything…". */
  placeholder?: string;
  /** Small caption below the input. Default: "Powered by Claude · Klorad". */
  poweredByLabel?: string;
  /** Copy shown when the backend errors. Default: "Sorry — the
   *  assistant is unavailable right now." */
  unavailableCopy?: string;
  /** User-message attribution — not currently rendered, reserved
   *  for future avatar / name shows. */
  youLabel?: string;
  /** Per-app renderer for the structured `actions[]` the assistant
   *  returns. Each vertical plugs in its own card set (Campus:
   *  KlioSourceCards; Mobility: ParisSourceCards). Return `null` to
   *  hide the row for a turn with no actions. */
  renderActions?: (actions: TAction[]) => ReactNode;
  /**
   * Layout mode.
   *
   *   flow (default) — the panel is a normal flex column in the
   *     document. Input uses `sticky` positioning; the document
   *     scrolls. Right for a page that's mostly hero + a few
   *     messages, or when the panel is embedded alongside other
   *     content.
   *   fill — the panel fills its parent's height. The thread grows
   *     to fill available space and scrolls internally; the input
   *     is pinned at the bottom of the panel (never leaves the
   *     viewport). Right for a dedicated "chat" tab like Mobility's
   *     Paris route. The parent must supply a bounded height (e.g.
   *     `h-[calc(100dvh-3.5rem)]`).
   */
  layout?: "flow" | "fill";
  /**
   * Extra bottom padding on the input container. Only used in `fill`
   * layout to reserve room for a mobile bottom nav — passed as a
   * Tailwind arbitrary padding class (e.g. `pb-[3.5rem]`) or plain
   * class string. Ignored in flow layout, which uses `sticky`
   * positioning with a hard-coded safe-area offset.
   */
  inputBottomPadding?: string;
}

/**
 * Generic full-screen assistant chat. Verticals mount this with
 * their own backend URL, hero copy, suggestions, and action
 * renderer. The panel owns:
 *
 * - Hero → thread transition when the first message lands
 * - Suggestion chips → send-on-tap
 * - Message thread with auto-scroll to the latest
 * - Sticky input that respects the mobile bottom nav's safe area
 * - Optimistic user-message render + spinner while the assistant
 *   replies
 *
 * The backend response shape is `{reply: string, actions?: T[]}`.
 * Actions are opaque to this component — the caller-supplied
 * `renderActions(actions)` decides how to render them (map deep-
 * links, buttons that trigger tools, etc.).
 *
 * Palette comes from the standard `--brand-*` CSS vars.
 */
export function AssistantPanel<TAction = unknown>({
  endpoint,
  extraBody,
  heroTitle,
  heroSubtitle,
  suggestions,
  placeholder = "Ask anything…",
  poweredByLabel = "Powered by Claude · Klorad",
  unavailableCopy = "Sorry — the assistant is unavailable right now.",
  renderActions,
  layout = "flow",
  inputBottomPadding,
}: AssistantPanelProps<TAction>) {
  const [messages, setMessages] = useState<AssistantMessage<TAction>[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, sending]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history,
          ...(extraBody ?? {}),
        }),
      });
      if (!res.ok) throw new Error("assistant failed");
      const data = (await res.json()) as {
        reply: string;
        actions?: TAction[];
      };
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.reply, actions: data.actions },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: unavailableCopy }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const isFill = layout === "fill";

  const hero = (
    <div>
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        style={{ background: "var(--brand-primary-fill, #4a3fac)" }}
      >
        <Sparkles size={22} strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--brand-text,#1a1a1a)] md:text-4xl">
        {heroTitle}
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--brand-text-muted,#6b6b6b)]">
        {heroSubtitle}
      </p>

      {suggestions.length > 0 && (
        <ul className="mt-6 space-y-2.5">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => void send(s.prompt)}
                disabled={sending}
                className="group flex w-full items-center gap-3 rounded-full border border-[var(--brand-line,#e6e6ea)] bg-white px-4 py-3 text-left text-sm font-medium text-[var(--brand-text,#1a1a1a)] transition-colors hover:border-[var(--brand-primary,#534ab7)] disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--brand-primary,#534ab7)] transition-colors group-hover:text-white"
                  style={{
                    background: "var(--brand-page, #f5f5f7)",
                  }}
                >
                  <ArrowRight size={14} strokeWidth={2} />
                </span>
                <span className="flex-1">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const thread = (
    <div
      ref={threadRef}
      // Fill mode owns its scroll via `flex-1 overflow-y-auto` on the
      // wrapper — the thread itself is just a flex column with no cap.
      // Flow mode keeps the historic behaviour: a bounded thread box
      // that scrolls internally within the page's document scroll.
      className={
        isFill
          ? "flex flex-col gap-3 rounded-2xl bg-white p-4 text-sm shadow-sm"
          : "flex flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4 text-sm shadow-sm"
      }
      style={isFill ? undefined : { maxHeight: "min(60vh, 420px)" }}
    >
      {messages.map((m, i) => (
        <div
          key={i}
          className={m.role === "user" ? "self-end" : "self-start"}
        >
          {m.role === "user" ? (
            <span
              className="inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm text-white"
              style={{
                backgroundColor: "var(--brand-primary-fill, #4a3fac)",
              }}
            >
              {m.text}
            </span>
          ) : (
            <div className="max-w-[85%]">
              <div
                className="whitespace-pre-wrap rounded-2xl px-3.5 py-2 leading-relaxed text-[var(--brand-text,#1a1a1a)]"
                style={{ background: "var(--brand-page, #f5f5f7)" }}
              >
                {m.text}
              </div>
              {renderActions && m.actions && m.actions.length > 0
                ? renderActions(m.actions)
                : null}
            </div>
          )}
        </div>
      ))}
      {sending ? (
        <div
          className="self-start rounded-2xl px-3.5 py-2 text-xs text-[var(--brand-text-muted,#6b6b6b)]"
          style={{ background: "var(--brand-page, #f5f5f7)" }}
        >
          …
        </div>
      ) : null}
    </div>
  );

  const inputBar = (
    <div className="flex items-center gap-2 rounded-full border border-[var(--brand-line,#e6e6ea)] bg-white px-4 py-2 shadow-sm">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={sending}
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--brand-text,#1a1a1a)] outline-none placeholder:text-[var(--brand-text-muted,#6b6b6b)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#534ab7)] disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => void send(input)}
        disabled={sending || !input.trim()}
        aria-label="Send"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: "var(--brand-primary-fill, #4a3fac)" }}
      >
        <ArrowUp size={16} strokeWidth={2} />
      </button>
    </div>
  );

  const poweredBy = (
    <p className="mt-2 text-center text-[10px] text-[var(--brand-text-muted,#6b6b6b)]">
      {poweredByLabel}
    </p>
  );

  if (isFill) {
    // Fill mode — the panel is a full-height flex column. The parent
    // MUST supply a bounded height (e.g. `h-[calc(100dvh-3.5rem)]`);
    // without one, the panel collapses to its content height and the
    // scroll semantics fall back to flow mode implicitly.
    return (
      <section className="mx-auto flex h-full max-w-[760px] flex-col px-4 md:px-6">
        <div className="flex-1 min-h-0 overflow-y-auto py-6">
          {messages.length === 0 ? hero : thread}
        </div>
        <div
          className={`shrink-0 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
            inputBottomPadding ?? ""
          }`}
        >
          {inputBar}
          {poweredBy}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-6 md:px-6">
      {messages.length === 0 ? hero : null}
      {messages.length > 0 ? thread : null}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] mx-auto w-full max-w-[760px] md:bottom-6">
        {inputBar}
        {poweredBy}
      </div>
    </section>
  );
}
