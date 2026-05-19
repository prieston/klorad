import Link from "next/link";
import type { Metadata } from "next";
import { HeroWorld } from "@/components/hero-world";
import {
  Eyebrow,
  ArrowIcon,
  SectionHead,
  btnPrimary,
  btnGhost,
} from "@/components/ui";

export const metadata: Metadata = {
  description:
    "Klorad is a geospatial platform for digital twins, a shared foundation that turns real places into living, data-driven worlds. The engine behind Klorad Campus, Mobility, Virtual Heritage, and Urban.",
  alternates: { canonical: "/" },
};

const verticals = [
  {
    tag: "Campus",
    name: "Klorad Campus",
    promise: "Campuses people can navigate.",
    desc: "Indoor and outdoor wayfinding, room-level detail, points of interest. A campus that works on a screen as well as on foot.",
    href: "/campus",
  },
  {
    tag: "Mobility",
    name: "Klorad Mobility",
    promise: "Road networks, made legible.",
    desc: "Corridors, junctions, signaling and ITS telemetry as one continuous environment. See how a decision propagates before it is made.",
    href: "/mobility",
  },
  {
    tag: "Heritage",
    name: "Klorad Virtual Heritage",
    promise: "Heritage, reconstructed and understood.",
    desc: "Sites rebuilt as immersive, interpretable worlds for preservation, research, and the public.",
    href: "/virtual-heritage",
  },
  {
    tag: "Urban",
    name: "Klorad Urban",
    promise: "Cities and land, as a living model.",
    desc: "Urban infrastructure and land use unified into one twin for planning, coordination, and the decisions that shape territory.",
    href: "/urban",
  },
];

const engineFeatures = [
  {
    title: "One World model",
    desc: "A single, engine-agnostic model of scenes, objects, and observations. Define a world once.",
  },
  {
    title: "Three renderers",
    desc: "Three.js for built scenes, CesiumJS for the geospatial globe and 3D tiles, Mapbox for mapping. Same world, the right renderer.",
  },
  {
    title: "Live data",
    desc: "IoT and sensor telemetry stream into the world in real time. Twins that move with the thing they mirror.",
  },
  {
    title: "Immersive & XR",
    desc: "Worlds are XR-ready, explorable on a screen or stepped into.",
  },
  {
    title: "Multi-tenant",
    desc: "Organizations, projects, and access control built in from the core.",
  },
  {
    title: "The SDK",
    desc: "@klorad/api: a programmatic scene API with an extension for each vertical. Build your own world on the foundation.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <HeroWorld />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[620px] w-[620px] rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative z-10 mx-auto flex min-h-[88svh] max-w-container flex-col justify-center px-6 py-28 md:px-8">
          <div className="max-w-2xl animate-fade-up">
            <Eyebrow>The Klorad Platform</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              Build the virtual worlds of tomorrow.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              Klorad is a geospatial platform for digital twins, a shared
              foundation that turns real places into living, data-driven worlds.
            </p>
            <p className="mt-3 max-w-xl text-[15px] text-text-tertiary">
              Campuses, road networks, cities, heritage sites. One engine
              beneath them all.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/platform" className={btnPrimary}>
                Explore the platform
              </Link>
              <Link
                href="/samples"
                className="inline-flex items-center justify-center gap-1.5 px-2 py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                See what&apos;s built on Klorad
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── What Klorad is ─────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            center
            eyebrow="The model"
            title="Klorad is the foundation. The worlds are the products."
            intro="Every Klorad product is a digital twin built on the same engine: the same world model, the same geospatial core, the same live-data backbone. We built the hard part once, so each new world doesn't start from zero."
          />
          <div className="mt-16 flex flex-col items-center">
            <div className="glass-panel rounded-xl px-6 py-3 text-sm font-medium tracking-wide text-text-primary shadow-glass">
              KLORAD{" "}
              <span className="text-text-tertiary">· the world engine</span>
            </div>
            <div className="h-12 w-px bg-line-strong" />
            <div className="grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
              {verticals.map((v) => (
                <div
                  key={v.tag}
                  className="glass-panel rounded-lg px-3 py-3 text-center text-sm text-text-secondary"
                >
                  {v.tag}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Choose your world ──────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="Products"
            title="Choose your world."
            intro="Four products, one foundation. Each takes a domain into the digital-twin era."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {verticals.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                className="group glass-panel rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-glass"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                    {v.tag}
                  </span>
                  <ArrowIcon className="text-text-tertiary transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent" />
                </div>
                <h3 className="mt-5 text-xl font-medium text-text-primary">
                  {v.name}
                </h3>
                <p className="mt-1 text-[15px] text-text-secondary">
                  {v.promise}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-text-tertiary">
                  {v.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Inside the engine ──────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="The engine"
            title="One world model. Any way you need to render it."
            intro="The shared architecture beneath every Klorad product. The part you never have to build again."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line-soft bg-line-soft md:grid-cols-2 lg:grid-cols-3">
            {engineFeatures.map((f, i) => (
              <div key={f.title} className="bg-bg p-7">
                <span className="font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-lg font-medium text-text-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Worlds built with Klorad ───────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHead
              eyebrow="Showcase"
              title="Worlds built with Klorad."
              intro="A growing collection of digital twins. Explore what the platform makes possible."
            />
            <Link href="/samples" className={`${btnGhost} shrink-0`}>
              Browse the gallery
            </Link>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {verticals.slice(0, 3).map((v) => (
              <div
                key={v.tag}
                className="glass-panel relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl p-5"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 bg-accent-soft opacity-60"
                />
                <span className="relative text-xs uppercase tracking-[0.2em] text-accent">
                  {v.tag}
                </span>
                <span className="relative mt-1 text-sm text-text-secondary">
                  {v.promise}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Born from research ─────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="max-w-3xl">
            <Eyebrow>Origin</Eyebrow>
            <h2 className="mt-5 text-3xl font-light leading-[1.12] text-text-primary md:text-[42px]">
              Born from research.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-text-secondary md:text-lg">
              Klorad began as a doctoral thesis: a formal model for describing
              3D, geospatial worlds on one shared architecture, so each new
              project would not reinvent the same foundation. The platform is
              that model, in production.
            </p>
            <Link
              href="/research"
              className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Read the research
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-t border-line-soft py-28 md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft blur-3xl"
        />
        <div className="relative mx-auto max-w-container px-6 text-center md:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-light leading-[1.12] text-text-primary md:text-[44px]">
            Start building your world.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
            Tell us what you need to model, or explore how the platform fits
            together.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/contact" className={btnPrimary}>
              Schedule a demo
            </Link>
            <Link href="/platform" className={btnGhost}>
              Explore the platform
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
