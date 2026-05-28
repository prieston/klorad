"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface SuggestedAction {
  action: "focus" | "route";
  toId?: string;
}

export interface AssistantInputProps {
  /** Project id — every assistant call is scoped to this campus. */
  mapId: string;
  /** Campus display name — fed to the system prompt. */
  campusName: string;
  /** UI locale — passed through to the API. */
  locale: "en" | "el";
  /** Where the "Open the map" link should land. */
  mapHref: string;
}

/**
 * Always-visible chat input for the consumer home (Arc 6 of
 * [[campus-consumer-pivot]]).
 *
 * Posts to `/api/assistant` with no `spaces` array — the LLM only
 * has the four `query_*` tools available on the home (news, events,
 * clubs, dining); place-related answers degrade to a "Open the map"
 * suggestion that links to `/campus/[token]/map`.
 *
 * Without `ANTHROPIC_API_KEY` the server falls back to a basic
 * regex parser that doesn't know about news / events / clubs /
 * dining. The placeholder reflects that ("Try the dropdowns above"
 * pattern) — the input still works but only handles map-bound
 * queries usefully, and only on the map page.
 */
export function AssistantInput({
  mapId,
  campusName,
  locale,
  mapHref,
}: AssistantInputProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder =
    locale === "el"
      ? "Ρωτήστε ό,τι θέλετε για την πανεπιστημιούπολη…"
      : "Ask anything about campus…";

  const submit = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          mapId,
          campusName,
          locale,
          history,
        }),
      });
      if (!res.ok) throw new Error("assistant failed");
      const data = (await res.json()) as {
        reply: string;
        suggested?: SuggestedAction;
      };
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            locale === "el"
              ? "Συγγνώμη — ο βοηθός δεν είναι διαθέσιμος αυτή τη στιγμή."
              : "Sorry — the assistant is unavailable right now.",
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <section className="mx-auto max-w-[1280px] px-4 pt-2 md:px-6">
      <div className="rounded-2xl border border-[var(--brand-line)] bg-white p-4 md:p-5">
        {messages.length === 0 ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--brand-text-muted)]">
            <Sparkles size={14} strokeWidth={1.75} className="text-[var(--brand-primary)]" />
            {locale === "el"
              ? "Δοκιμάστε: «εκδηλώσεις απόψε», «πού να φάω», «τι νέα για τη βιβλιοθήκη»"
              : "Try: \"events tonight\", \"where to eat\", \"news about the library\""}
          </div>
        ) : (
          <div className="mb-3 max-h-72 space-y-3 overflow-y-auto rounded-xl bg-[var(--brand-page)] p-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "text-right"
                    : "text-[var(--brand-text)]"
                }
              >
                {m.role === "user" ? (
                  <span
                    className="inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-white"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    {m.text}
                  </span>
                ) : (
                  <span className="block whitespace-pre-wrap leading-relaxed">
                    {m.text}
                    {/* Cheap "open the map" affordance when the assistant
                        mentions the map / suggests focusing somewhere. */}
                    {/map\b|directions?\b/i.test(m.text) ? (
                      <>
                        {" "}
                        <Link
                          href={mapHref}
                          className="text-[var(--brand-primary)] underline-offset-2 hover:underline"
                        >
                          Open the map →
                        </Link>
                      </>
                    ) : null}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            placeholder={placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            className="min-w-0 flex-1 rounded-full border border-[var(--brand-line)] bg-white px-4 py-2.5 text-sm text-[var(--brand-text)] outline-none transition-colors placeholder:text-[var(--brand-text-muted)] focus:border-[var(--brand-primary)] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <ArrowUp size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  );
}
