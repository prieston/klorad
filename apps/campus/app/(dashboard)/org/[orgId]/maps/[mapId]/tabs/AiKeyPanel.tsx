"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Bot, Eye, EyeOff, RotateCw, Trash2 } from "lucide-react";
import { Button, Field, Input, Panel } from "@klorad/design-system";

interface Props {
  mapId: string;
}

interface Status {
  hasKey: boolean;
  masked: string | null;
  secretsEnabled: boolean;
}

/**
 * AI Assistant settings panel.
 *
 * Lets a campus admin paste their own Anthropic API key. The key is
 * encrypted at rest (`SECRETS_KEY`-derived AES-256-GCM via
 * `lib/secrets.ts`) and never returned to the client in plaintext —
 * only a masked slug for display.
 *
 * Empty + the platform `ANTHROPIC_API_KEY` is set → chat uses the
 * platform key. Both set → the campus key wins.
 *
 * Test button hits Claude Haiku with a 1-token call so the admin
 * knows the key works *before* a student tries it.
 */
export function AiKeyPanel({ mapId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);

  useEffect(() => {
    void fetch(`/api/maps/${mapId}/ai-settings`)
      .then((r) => r.json())
      .then((s: Status) => setStatus(s))
      .catch(() => undefined);
  }, [mapId]);

  const save = async () => {
    const apiKey = draft.trim();
    if (!apiKey) {
      toast.error("Paste a key first.");
      return;
    }
    setBusy("save");
    try {
      const res = await fetch(`/api/maps/${mapId}/ai-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setStatus({
        hasKey: body.hasKey,
        masked: body.masked,
        secretsEnabled: true,
      });
      setDraft("");
      setReveal(false);
      toast.success("Key saved");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const res = await fetch(`/api/maps/${mapId}/ai-settings/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft.trim() ? { apiKey: draft.trim() } : {}),
      });
      const body = (await res.json()) as {
        ok: boolean;
        error?: string;
      };
      if (body.ok) toast.success("Key works.");
      else toast.error(body.error ?? "Key failed.");
    } catch (e) {
      console.error(e);
      toast.error("Test failed");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm("Remove the stored key? The chat will fall back to the platform key.")) {
      return;
    }
    setBusy("remove");
    try {
      const res = await fetch(`/api/maps/${mapId}/ai-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: null }),
      });
      if (!res.ok) throw new Error("Remove failed");
      setStatus({ hasKey: false, masked: null, secretsEnabled: status?.secretsEnabled ?? false });
      toast.success("Key removed");
    } catch (e) {
      console.error(e);
      toast.error("Remove failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel className="rounded-2xl p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Bot size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Anthropic API key
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Powers the campus assistant. Usage and cost stay scoped to
            this campus — the key only leaves your browser to be
            encrypted at rest. Get one at{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              console.anthropic.com
            </a>
            .
          </p>
        </div>
      </div>

      {status === null ? (
        <p className="mt-4 text-xs text-text-tertiary">Loading…</p>
      ) : (
        <>
          {!status.secretsEnabled ? (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
              <code className="font-mono">SECRETS_KEY</code> isn’t set
              on the server — saving a key is disabled. Generate one
              with{" "}
              <code className="font-mono">openssl rand -hex 32</code>{" "}
              and add it to <code>.env.local</code>, then restart.
            </p>
          ) : null}

          {status.hasKey && status.masked ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-solid border-line-soft bg-surface-2 px-3 py-2.5">
              <span className="flex items-center gap-2 font-mono text-xs text-text-secondary">
                <Bot size={14} strokeWidth={1.75} className="text-accent" />
                {status.masked}
              </span>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-1 hover:text-red-600 disabled:opacity-40"
                aria-label="Remove key"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          ) : null}

          <Field
            label={status.hasKey ? "Replace with a new key" : "Add a key"}
            className="mt-4"
          >
            <div className="flex items-center gap-2">
              <Input
                type={reveal ? "text" : "password"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-ant-…"
                disabled={!status.secretsEnabled || busy !== null}
                autoComplete="off"
                className="flex-1 font-mono"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                aria-label={reveal ? "Hide" : "Reveal"}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-solid border-line-soft text-text-tertiary transition-colors hover:border-accent hover:text-accent"
              >
                {reveal ? (
                  <EyeOff size={14} strokeWidth={1.75} />
                ) : (
                  <Eye size={14} strokeWidth={1.75} />
                )}
              </button>
            </div>
          </Field>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!status.secretsEnabled || !draft.trim() || busy !== null}
            >
              {busy === "save" ? "Saving…" : "Save key"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void test()}
              disabled={busy !== null || (!draft.trim() && !status.hasKey)}
            >
              <span className="inline-flex items-center gap-1.5">
                <RotateCw
                  size={14}
                  strokeWidth={1.75}
                  className={busy === "test" ? "animate-spin" : ""}
                />
                {busy === "test" ? "Testing…" : "Test"}
              </span>
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
