"use client";

import { useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import { Send } from "lucide-react";
import {
  Button,
  Field,
  Input,
  Panel,
  Textarea,
} from "@klorad/design-system";

export interface NotifyFormProps {
  mapId: string;
  /** False when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` isn't set on the server. */
  enabled: boolean;
}

/**
 * Admin form for firing a one-off web push to every subscriber on
 * this campus. Title / body / optional click-through URL.
 *
 * Visible always, but disabled when push isn't configured — better
 * than hiding the surface because operators need to *see* that the
 * feature exists before they go set up VAPID keys.
 */
export function NotifyForm({ mapId, enabled }: NotifyFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!enabled) return;
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/maps/${mapId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      const r = json.result ?? {};
      toast.success(
        `Sent to ${r.attempted ?? 0} subscriber(s) · ${r.delivered ?? 0} delivered · ${r.pruned ?? 0} pruned.`,
      );
      setTitle("");
      setBody("");
      setUrl("");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel className="mt-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Push a notification
          </h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Fires once to every visitor who tapped “Get notifications”
            on this campus. {enabled ? null : (
              <span className="ml-1 text-red-600">
                Disabled — set VAPID_* env vars to enable.
              </span>
            )}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fire drill at 10:30"
            disabled={!enabled || submitting}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Click-through URL (optional)">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/campus/<token>/events/<id>"
            disabled={!enabled || submitting}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Body">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Quick details students need to know."
              rows={3}
              disabled={!enabled || submitting}
              maxLength={280}
              required
            />
          </Field>
        </div>
        <div className="md:col-span-2 flex items-center justify-end pt-1">
          <Button type="submit" disabled={!enabled || submitting}>
            <span className="inline-flex items-center gap-1.5">
              <Send size={14} strokeWidth={1.75} />
              {submitting ? "Sending…" : "Send notification"}
            </span>
          </Button>
        </div>
      </form>
    </Panel>
  );
}
