"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SampleImage } from "@/components/sample-image";
import type { SampleWorld } from "@/lib/samples";

function chipClass(active: boolean) {
  return `rounded-full border px-4 py-1.5 text-sm transition-colors ${
    active
      ? "border-accent bg-accent-soft text-text-primary"
      : "border-line-strong text-text-secondary hover:border-accent hover:text-text-primary"
  }`;
}

function CardBody({ world }: { world: SampleWorld }) {
  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
        <SampleImage
          src={world.imageThumbnail || "/images/samples/default.jpg"}
          alt={world.title}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        {world.category && (
          <div className="text-xs uppercase tracking-[0.2em] text-accent">
            {world.category}
          </div>
        )}
        <h3 className="mt-2 line-clamp-2 text-base font-medium text-text-primary">
          {world.title}
        </h3>
        {world.url && (
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-text-secondary transition-colors group-hover:text-text-primary">
            View →
          </span>
        )}
      </div>
    </>
  );
}

export function SamplesGrid({ worlds }: { worlds: SampleWorld[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    worlds.forEach((w) => {
      if (w.category) set.add(w.category);
    });
    return Array.from(set).sort();
  }, [worlds]);

  const filtered = useMemo(
    () => (selected ? worlds.filter((w) => w.category === selected) : worlds),
    [worlds, selected],
  );

  return (
    <>
      {categories.length > 0 && (
        <div className="mb-10 flex flex-wrap gap-2.5">
          <button onClick={() => setSelected(null)} className={chipClass(selected === null)}>
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelected(category)}
              className={chipClass(selected === category)}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((world) =>
            world.url ? (
              <Link
                key={world.id}
                href={world.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group glass-panel flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-accent"
              >
                <CardBody world={world} />
              </Link>
            ) : (
              <div
                key={world.id}
                className="group glass-panel relative flex flex-col overflow-hidden rounded-2xl"
              >
                <CardBody world={world} />
                <div className="absolute right-3 top-3 rounded-full bg-glass px-2.5 py-1 text-xs uppercase tracking-[0.1em] text-text-tertiary backdrop-blur">
                  Coming soon
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="py-24 text-center text-text-secondary">
          No worlds found in this category.
        </p>
      )}
    </>
  );
}
