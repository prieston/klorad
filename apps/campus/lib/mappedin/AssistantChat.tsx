"use client";

import { useState } from "react";
import { Button } from "@klorad/design-system";
import { translate, type Locale } from "@/app/lib/i18n-core";
import type { SpaceOption } from "./WayfindingControls";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantChatProps {
  locale: Locale;
  spaces: SpaceOption[];
  /** Focus a space (used for "show me X" / single-destination intents). */
  onFocus: (spaceId: string) => void;
  /** Draw a route (used for "from X to Y" intents). */
  onRoute: (fromId: string, toId: string, accessible: boolean) => void;
}

/**
 * Ask-the-assistant chat for the Navigate tab.
 *
 * Posts to `/api/assistant`, which parses the message and replies
 * with a short text + optionally an action (focus a space or draw a
 * route). The chat dispatches the action to the viewer's own
 * handlers — same call paths the dropdowns already use — so the map
 * reacts identically whether the visitor typed or clicked.
 *
 * The backend is a lightweight regex parser today; a Claude call
 * with tool use can plug in there later without changing this
 * component.
 */
export function AssistantChat({
  locale,
  spaces,
  onFocus,
  onRoute,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(locale, key);

  const submit = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          spaces: spaces.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
          })),
          locale,
        }),
      });
      if (!res.ok) throw new Error("assistant failed");
      const data = (await res.json()) as {
        reply: string;
        suggested?:
          | { action: "focus"; toId: string }
          | {
              action: "route";
              fromId: string;
              toId: string;
              accessible: boolean;
            };
      };
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      if (data.suggested?.action === "route") {
        onRoute(
          data.suggested.fromId,
          data.suggested.toId,
          data.suggested.accessible,
        );
      } else if (data.suggested?.action === "focus") {
        onFocus(data.suggested.toId);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: t("mappedin.askUnavailable") },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {t("mappedin.askAssistant")}
      </h3>

      {messages.length === 0 ? (
        <p className="text-xs italic leading-relaxed text-text-tertiary">
          {t("mappedin.askExamples")}
        </p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-surface-2 p-2 text-xs leading-relaxed">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "text-text-primary"
                  : "text-text-secondary"
              }
            >
              <span className="font-semibold">
                {m.role === "user" ? "You" : "Assistant"}:{" "}
              </span>
              {m.text}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder={t("mappedin.askPlaceholder")}
          disabled={sending}
          className="min-w-0 flex-1 rounded-lg border border-solid border-line-soft bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
        />
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={sending || !input.trim()}
        >
          {t("mappedin.askSend")}
        </Button>
      </div>
    </div>
  );
}
