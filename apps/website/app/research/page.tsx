import Link from "next/link";
import type { Metadata } from "next";
import {
  Eyebrow,
  ArrowIcon,
  SectionHead,
  btnPrimary,
  btnGhost,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Klorad began as a doctoral thesis — a formal model for describing 3D, geospatial worlds on one shared architecture. The platform is that research, in production.",
  alternates: { canonical: "/research" },
};

const principles = [
  {
    title: "Define once",
    desc: "A world is described independently of how it is drawn — geometry, data, and meaning, not rendering quirks.",
  },
  {
    title: "Render anywhere",
    desc: "The same model targets any engine. The choice of renderer is a detail, not a rewrite.",
  },
  {
    title: "Build on shared ground",
    desc: "Every project inherits the same foundation, so effort goes to the new problem — not the plumbing.",
  },
];

export default function ResearchPage() {
  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 grid-field" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[600px] w-[600px] rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative z-10 mx-auto max-w-container px-6 py-28 md:px-8 md:py-36">
          <div className="max-w-2xl animate-fade-up">
            <Eyebrow>Research</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              Where Klorad began.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              Klorad did not start as a product. It started as a question in a
              doctoral thesis — and an architecture built to answer it.
            </p>
          </div>
        </div>
      </section>

      {/* ── The problem ────────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="The problem"
            title="Every 3D, geospatial project rebuilds the same foundation."
            intro="Across years of research, one pattern kept repeating. Each new study, each new demonstrator, began the same way — rebuilding 3D scenes, geospatial plumbing, and software architecture from scratch before the real question could be asked. The foundation was reinvented every time."
          />
        </div>
      </section>

      {/* ── The thesis ─────────────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="The thesis"
            title="A formal model for 3D worlds."
            intro="The doctoral work produced a class diagram — a single, formal way to describe 3D, geospatial worlds and the architecture that renders them. Define the model once, and any number of worlds can share it. The thesis argued that the foundation should be designed, not reinvented."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {principles.map((p) => (
              <div key={p.title} className="glass-panel rounded-2xl p-7">
                <h3 className="text-xl font-medium text-text-primary">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── From research to product ───────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="glass-panel rounded-3xl p-10 md:p-14">
            <Eyebrow>From research to product</Eyebrow>
            <p className="mt-5 max-w-3xl text-2xl font-light leading-[1.3] text-text-primary md:text-3xl">
              Klorad is that model, in production. The class diagram became the
              World type at the core of the platform — and the foundation
              beneath Campus, Mobility, Virtual Heritage, and Urban.
            </p>
            <Link
              href="/platform"
              className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Explore the platform
              <ArrowIcon />
            </Link>
          </div>
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
            From a thesis to your world.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
            Read the thinking behind the platform, or talk to the team about
            building on it.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/journal" className={btnPrimary}>
              Read the journal
            </Link>
            <Link href="/contact" className={btnGhost}>
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
