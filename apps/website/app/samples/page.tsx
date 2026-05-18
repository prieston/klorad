import Link from "next/link";
import type { Metadata } from "next";
import { SamplesGrid } from "@/components/samples-grid";
import { getSampleWorlds } from "@/lib/samples";
import { Eyebrow, btnPrimary } from "@/components/ui";

export const metadata: Metadata = {
  title: "Worlds",
  description:
    "Explore published worlds built with Klorad — real applications of the geospatial platform across campus, mobility, heritage, and urban domains.",
  alternates: { canonical: "/samples" },
};

export default async function SamplesPage() {
  const sampleWorlds = await getSampleWorlds();

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 grid-field" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[600px] w-[600px] rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative z-10 mx-auto max-w-container px-6 py-24 md:px-8 md:py-32">
          <div className="max-w-2xl animate-fade-up">
            <Eyebrow>Worlds</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              Worlds built with Klorad.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              A growing collection of digital twins — real applications of the
              platform across campuses, corridors, cities, and heritage sites.
            </p>
          </div>
        </div>
      </section>

      {/* ── Grid ───────────────────────────────────────────── */}
      <section className="border-t border-line-soft py-20 md:py-28">
        <div className="mx-auto max-w-container px-6 md:px-8">
          {sampleWorlds.length > 0 ? (
            <SamplesGrid worlds={sampleWorlds} />
          ) : (
            <p className="py-20 text-center text-text-secondary">
              No worlds published yet — check back soon.
            </p>
          )}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-t border-line-soft py-28 md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative mx-auto max-w-container px-6 text-center md:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-light leading-[1.12] text-text-primary md:text-[44px]">
            Build the next one.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
            See how Klorad would model your world — book a walkthrough with the
            team.
          </p>
          <div className="mt-9 flex justify-center">
            <Link href="/contact" className={btnPrimary}>
              Schedule a demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
