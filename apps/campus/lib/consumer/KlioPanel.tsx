"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles, ArrowRight } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export interface KlioPanelProps {
  /** Project id — every assistant call is scoped to this campus. */
  mapId: string;
  /** Campus display name — fed to the system prompt + hello copy. */
  campusName: string;
  /** UI locale — drives all visible strings + the assistant locale param. */
  locale: "en" | "el";
  /** Where the deep links land when the assistant suggests a route. */
  mapHref: string;
}

interface Suggestion {
  /** Visible label. */
  label: string;
  /** Prompt sent to the assistant when tapped. */
  prompt: string;
}

const COPY = {
  en: {
    hi: "Hi, I'm Klio.",
    sub: "Ask me where things are, opening hours, what's on, or for a route.",
    placeholder: "Ask anything about campus…",
    suggestions: [
      { label: "Where's the gym?", prompt: "Where's the gym?" },
      { label: "Events this week", prompt: "What events are happening this week?" },
      {
        label: "Step-free route to the Library",
        prompt: "Give me a step-free route to the Library.",
      },
      { label: "What's for lunch?", prompt: "What's available for lunch today?" },
    ] satisfies Suggestion[],
    poweredBy: "Powered by Claude · Klorad",
    openMap: "Open the map",
    unavailable: "Sorry — Klio is unavailable right now.",
    you: "You",
  },
  el: {
    hi: "Γεια, είμαι η Κλειώ.",
    sub: "Ρωτήστε με πού βρίσκονται τα μέρη, ωράρια, εκδηλώσεις ή ζητήστε διαδρομή.",
    placeholder: "Ρωτήστε ό,τι θέλετε για την πανεπιστημιούπολη…",
    suggestions: [
      { label: "Πού είναι το γυμναστήριο;", prompt: "Πού είναι το γυμναστήριο;" },
      { label: "Εκδηλώσεις αυτή την εβδομάδα", prompt: "Ποιες εκδηλώσεις γίνονται αυτή την εβδομάδα;" },
      {
        label: "Προσβάσιμη διαδρομή στη Βιβλιοθήκη",
        prompt: "Δώσε μου προσβάσιμη διαδρομή προς τη Βιβλιοθήκη.",
      },
      { label: "Τι έχει για μεσημεριανό;", prompt: "Τι έχει για μεσημεριανό σήμερα;" },
    ] satisfies Suggestion[],
    poweredBy: "Με τη βοήθεια του Claude · Klorad",
    openMap: "Άνοιγμα χάρτη",
    unavailable: "Συγγνώμη — η Κλειώ δεν είναι διαθέσιμη αυτή τη στιγμή.",
    you: "Εσείς",
  },
} as const;

/**
 * Full-screen Klio chat — the campus assistant's home tab.
 *
 * Reuses `/api/assistant` under the hood (same backend the home chat
 * input and the map's Navigate tab call). Without a campus context
 * (no `spaces[]` here — we're off-map), the assistant only has the
 * `query_*` tools available; place-bound answers degrade to a
 * "Open the map" affordance that deep-links into MappedIn.
 *
 * Empty state mirrors the mockup: hero ("Hi, I'm Klio"), four
 * suggested-prompt pills, a chat thread, an input + send button.
 */
export function KlioPanel({ mapId, campusName, locale, mapHref }: KlioPanelProps) {
  const copy = COPY[locale];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep the chat scrolled to the latest message.
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
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: copy.unavailable },
      ]);
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

  return (
    <section className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 pt-6 md:px-6">
      {/* Hero — only when no chat history yet. */}
      {messages.length === 0 ? (
        <div>
          <span
            aria-hidden
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-white"
          >
            <Sparkles size={22} strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--brand-text)] md:text-4xl">
            {copy.hi}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--brand-text-muted)]">
            {copy.sub}
          </p>

          <ul className="mt-6 space-y-2.5">
            {copy.suggestions.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => void send(s.prompt)}
                  disabled={sending}
                  className="group flex w-full items-center gap-3 rounded-full border border-[var(--brand-line)] bg-white px-4 py-3 text-left text-sm font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)] disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-page)] text-[var(--brand-primary)] transition-colors group-hover:bg-[var(--brand-primary)] group-hover:text-white"
                  >
                    <ArrowRight size={14} strokeWidth={2} />
                  </span>
                  <span className="flex-1">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Chat thread. */}
      {messages.length > 0 ? (
        <div
          ref={threadRef}
          className="flex flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4 text-sm shadow-sm"
          style={{ maxHeight: "min(60vh, 420px)" }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "self-end" : "self-start"}
            >
              {m.role === "user" ? (
                <span
                  className="inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {m.text}
                </span>
              ) : (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[var(--brand-page)] px-3.5 py-2 leading-relaxed text-[var(--brand-text)]">
                  {m.text}
                  {/map\b|χάρτ/i.test(m.text) ? (
                    <>
                      {" "}
                      <Link
                        href={mapHref}
                        className="text-[var(--brand-primary)] underline-offset-2 hover:underline"
                      >
                        {copy.openMap} →
                      </Link>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          {sending ? (
            <div className="self-start rounded-2xl bg-[var(--brand-page)] px-3.5 py-2 text-xs text-[var(--brand-text-muted)]">
              …
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Input. */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] mx-auto w-full max-w-[760px] md:bottom-6">
        <div className="flex items-center gap-2 rounded-full border border-[var(--brand-line)] bg-white px-4 py-2 shadow-sm">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={copy.placeholder}
            disabled={sending}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--brand-text)] outline-none placeholder:text-[var(--brand-text-muted)] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--brand-text-muted)]">
          {copy.poweredBy}
        </p>
      </div>
    </section>
  );
}
