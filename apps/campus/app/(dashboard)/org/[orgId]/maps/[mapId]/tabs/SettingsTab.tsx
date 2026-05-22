"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import useSWR, { mutate } from "swr";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toast } from "react-toastify";
import { Button, Field, IconButton, Input, Panel, Textarea } from "@klorad/design-system";
import type { Branding, SceneData } from "@klorad/api";
import MembersPanel from "./MembersPanel";

interface Props {
  orgId: string;
  mapId: string;
  map: {
    id: string;
    name: string;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServerMap {
  id: string;
  name: string;
  sceneData?: Partial<SceneData>;
}

export default function SettingsTab({ orgId, mapId, map }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/campus/${mapId}`;
  const embedCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;

  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const copy = (text: string, kind: "url" | "embed") => {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  // Load current branding from the saved sceneData
  const { data: serverMap } = useSWR<ServerMap>(`/api/maps/${mapId}`, fetcher);
  const [branding, setBranding] = useState<Branding>({});
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    if (serverMap?.sceneData?.branding)
      setBranding(serverMap.sceneData.branding);
  }, [serverMap]);

  const handleSaveBranding = async () => {
    setSavingBrand(true);
    try {
      const nextSceneData: Partial<SceneData> = {
        ...(serverMap?.sceneData ?? {}),
        branding,
      };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData: nextSceneData }),
      });
      if (!res.ok) throw new Error("Save failed");
      await mutate(`/api/maps/${mapId}`);
      toast.success("Branding saved");
    } catch {
      toast.error("Could not save branding");
    } finally {
      setSavingBrand(false);
    }
  };

  return (
    <div className="space-y-8 pt-6">
      <Section title="General">
        <Panel className="rounded-2xl p-6">
          <Field label="Campus name">
            <Input defaultValue={map.name} />
          </Field>
          <p className="mt-2 text-xs text-text-tertiary">
            Name changes save automatically (not yet wired — placeholder).
          </p>
        </Panel>
      </Section>

      <Section title="Branding">
        <Panel className="space-y-5 rounded-2xl p-6">
          <Field
            label="Public display name"
            hint="Overrides the campus name in the public viewer header. Leave blank to use the campus name above."
          >
            <Input
              placeholder={map.name}
              value={branding.name ?? ""}
              onChange={(e) =>
                setBranding((b) => ({ ...b, name: e.target.value }))
              }
            />
          </Field>
          <Field
            label="Logo URL"
            hint="Paste a public URL to your university's logo (SVG or PNG, roughly 240×60). Shown top-left on the public viewer."
          >
            <Input
              placeholder="https://…/logo.svg"
              value={branding.logo ?? ""}
              onChange={(e) =>
                setBranding((b) => ({ ...b, logo: e.target.value }))
              }
            />
          </Field>
          <Field
            label="Primary color"
            hint="Hex code (e.g. #6B9CD8). Recolors pins, routes, buttons, and highlights on the public viewer."
          >
            <div className="flex items-center gap-2">
              <Input
                className="max-w-[180px]"
                placeholder="#6B9CD8"
                value={branding.primaryColor ?? ""}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, primaryColor: e.target.value }))
                }
              />
              {branding.primaryColor && (
                <span
                  className="h-9 w-9 shrink-0 rounded-md border border-line-soft"
                  style={{ backgroundColor: branding.primaryColor }}
                />
              )}
            </div>
          </Field>

          {branding.logo && (
            <div>
              <div className="mb-1.5 text-xs text-text-tertiary">
                Logo preview
              </div>
              <div className="inline-flex items-center rounded-lg border border-line-soft bg-surface-2 px-5 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={branding.logo}
                  alt="Logo preview"
                  style={{ maxHeight: 40, maxWidth: 280, display: "block" }}
                />
              </div>
            </div>
          )}

          <Button size="sm" onClick={handleSaveBranding} disabled={savingBrand}>
            {savingBrand ? "Saving…" : "Save branding"}
          </Button>
        </Panel>
      </Section>

      <Section title="Sharing">
        <Panel className="rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-primary">
            Public link
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Share this link to let anyone view the interactive campus map.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input readOnly value={publicUrl} className="flex-1" />
            <IconButton
              variant="secondary"
              aria-label="Copy link"
              title="Copy link"
              onClick={() => copy(publicUrl, "url")}
            >
              <ContentCopyIcon
                fontSize="small"
                className={copied === "url" ? "text-emerald-500" : undefined}
              />
            </IconButton>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in new tab"
              title="Open in new tab"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-strong text-text-primary transition-colors hover:border-accent hover:text-accent"
            >
              <OpenInNewIcon fontSize="small" />
            </a>
          </div>
        </Panel>
      </Section>

      <Section title="Embed">
        <Panel className="rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-text-primary">
            Embed code
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Paste this snippet into any webpage to embed the campus map.
          </p>
          <Textarea
            readOnly
            rows={3}
            value={embedCode}
            className="mt-3 font-mono text-xs"
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => copy(embedCode, "embed")}
          >
            <ContentCopyIcon fontSize="small" />
            {copied === "embed" ? "Copied!" : "Copy embed code"}
          </Button>
        </Panel>
      </Section>

      <Section title="Members">
        <MembersPanel orgId={orgId} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  );
}
