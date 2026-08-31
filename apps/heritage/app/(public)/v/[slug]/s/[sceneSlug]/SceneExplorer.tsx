"use client";

import { useState } from "react";
import Link from "next/link";
import { uiStrings, viewerStrings } from "@/lib/heritage/ui-strings";
import { ArrowRight, Target } from "lucide-react";
import { ViewerCanvas } from "@/lib/heritage/ui/ViewerCanvas";

interface Proxy {
  id: string;
  shape: "box" | "sphere" | "cylinder" | "plane" | "mesh";
  transform: unknown;
  label: string | null;
  objectSlug: string | null;
  identifier: string | null;
  description: string | null;
}

/**
 * Canvas plus the list beside it.
 *
 * The list is not a fallback that appears when something fails — it is always
 * present and always complete. §10.1 requires a non-spatial equivalent for
 * every spatial function, and for a blind visitor no amount of photorealism
 * helps; the list is the honest answer. It doubles as the keyboard route into
 * the scene, which is the same requirement from the other direction.
 */
export function SceneExplorer({
  venueSlug,
  language,
  uiLanguage,
  layers,
  proxies,
  skippedSplats,
}: {
  venueSlug: string;
  language: string | null;
  /** Resolved display language — `language` stays the querystring value so
   *  links keep their explicit `?lang=`, which this must not inherit. */
  uiLanguage: string;
  layers: { id: string; url: string; transform?: unknown }[];
  proxies: Proxy[];
  skippedSplats: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = proxies.find((p) => p.id === selected) ?? null;
  const q = language ? `?lang=${language}` : "";
  const ui = uiStrings(uiLanguage);

  return (
    <>
      {layers.length > 0 ? (
        <ViewerCanvas
          className="mt-8"
          layers={layers}
          proxies={proxies.map((p) => ({
            id: p.id,
            shape: p.shape,
            transform: p.transform,
            label: p.label,
          }))}
          onSelectProxy={setSelected}
          height={480}
          label={ui("modelLabel")}
          strings={viewerStrings(uiLanguage, proxies.length)}
        />
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
          {skippedSplats > 0
            ? ui("splatNotPublished")
            : ui("noGeometry")}
        </p>
      )}

      {active ? (
        <aside className="mt-4 rounded-2xl border border-line-soft bg-bg p-5">
          <p className="text-sm font-medium text-text-primary">
            {active.label ?? ui("pointOfInterest")}
          </p>
          {active.identifier ? (
            <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
              {active.identifier}
            </p>
          ) : null}
          {active.description ? (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {active.description}
            </p>
          ) : null}
          {active.objectSlug ? (
            <Link
              href={`/v/${venueSlug}/o/${active.objectSlug}${q}`}
              className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              Open the full record
              <ArrowRight size={13} strokeWidth={1.8} aria-hidden />
            </Link>
          ) : null}
        </aside>
      ) : null}

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          <Target size={12} strokeWidth={1.8} aria-hidden />
          In this scene
          {proxies.length > 0 ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] tracking-normal text-accent">
              {proxies.length}
            </span>
          ) : null}
        </h2>
        {proxies.length === 0 ? (
          <p className="mt-3 text-sm text-text-tertiary">
            Nothing has been marked up in this scene yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft">
            {proxies.map((p) => (
              <li key={p.id} className="py-3">
                <button
                  type="button"
                  onClick={() => setSelected(p.id)}
                  className={`text-left text-sm ${
                    p.id === selected ? "text-accent" : "text-text-primary hover:text-accent"
                  }`}
                >
                  {p.label ?? ui("pointOfInterest")}
                </button>
                {p.description ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-tertiary">
                    {p.description}
                  </p>
                ) : null}
                {p.objectSlug ? (
                  <Link
                    href={`/v/${venueSlug}/o/${p.objectSlug}${q}`}
                    className="mt-1 inline-block text-xs text-accent hover:underline"
                  >
                    Full record
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
