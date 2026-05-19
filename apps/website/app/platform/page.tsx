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
  title: "Platform",
  description:
    "Klorad is the world engine: a geospatial platform with one World model, three rendering engines, live data, XR, and an SDK. The shared foundation beneath every Klorad product.",
  alternates: { canonical: "/platform" },
  openGraph: {
    title: "Platform | Klorad",
    description:
      "The world engine: one World model, three renderers, live data, XR, and an SDK.",
  },
};

const modelParts = ["Scenes", "Objects", "Observations", "Live data"];

const renderers = [
  {
    name: "Three.js",
    role: "Built scenes",
    desc: "Interiors, models, and designed environments, with full control over geometry, materials, and detail.",
  },
  {
    name: "CesiumJS",
    role: "The geospatial globe",
    desc: "Real-world terrain, 3D tiles, and planetary-scale context, accurate to coordinates.",
  },
  {
    name: "Mapbox",
    role: "Maps & plan view",
    desc: "Fast vector basemaps and extruded geometry for wayfinding and 2.5D work.",
  },
];

const capabilities = [
  {
    title: "Live data & IoT",
    desc: "Sensor and telemetry feeds stream into the world in real time. Twins that move with reality.",
  },
  {
    title: "XR-ready",
    desc: "Every world can be explored on a screen, or stepped into in immersive XR.",
  },
  {
    title: "Multi-tenant",
    desc: "Organizations, projects, roles, and access control built into the core.",
  },
  {
    title: "Config-driven UI",
    desc: "Panels, controls, and layout described as configuration, not rebuilt for every app.",
  },
  {
    title: "Assets & storage",
    desc: "A managed pipeline for models, imagery, and 3D tiles. Upload once, use across worlds.",
  },
  {
    title: "Coordinate-true",
    desc: "Everything anchored to real-world coordinates, consistent across every renderer.",
  },
];

const verticals = [
  { name: "Klorad Campus", href: "/campus" },
  { name: "Klorad Mobility", href: "/mobility" },
  { name: "Klorad Virtual Heritage", href: "/virtual-heritage" },
  { name: "Klorad Urban", href: "/urban" },
];

const codeSample = `import { createSceneAPI } from "@klorad/api";

// define a world once, render with any engine
const world = createSceneAPI({ engine: "cesium" });

world.objects.add(model);
world.events.on("select", inspect);`;

export default function PlatformPage() {
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
            <Eyebrow>The Platform</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              The world engine.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              Klorad is the shared foundation beneath every product: one model
              of 3D, geospatial worlds that you define once and render, stream
              live data into, and step into anywhere.
            </p>
            <p className="mt-3 max-w-xl text-[15px] text-text-tertiary">
              It is the part you never have to build again.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className={btnPrimary}>
                Schedule a demo
              </Link>
              <Link href="/samples" className={btnGhost}>
                See it in action
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── The World model ────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="The model"
            title="Define a world once."
            intro="At the center is a single abstraction, the World. Scenes, objects, observations, and live data, described independently of how they are drawn. It began as a doctoral class diagram; it is now the type at the heart of the platform."
          />
          <div className="mt-16 flex flex-col items-center">
            <div className="glass-panel rounded-xl px-6 py-3 text-sm font-medium tracking-wide text-text-primary shadow-glass">
              World <span className="text-text-tertiary">· the core model</span>
            </div>
            <div className="h-12 w-px bg-line-strong" />
            <div className="grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
              {modelParts.map((part) => (
                <div
                  key={part}
                  className="glass-panel rounded-lg px-3 py-3 text-center text-sm text-text-secondary"
                >
                  {part}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Three renderers ────────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="Rendering"
            title="One world. Three renderers."
            intro="The same world model drives three rendering engines. Klorad uses whichever fits the job, or all three within one project."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {renderers.map((r) => (
              <div key={r.name} className="glass-panel rounded-2xl p-7">
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                  {r.role}
                </span>
                <h3 className="mt-4 text-xl font-medium text-text-primary">
                  {r.name}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="Built in"
            title="Everything a world needs, from the core."
            intro="These are not add-ons. They are part of the foundation, available to every product and every world from day one."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line-soft bg-line-soft md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c, i) => (
              <div key={c.title} className="bg-bg p-7">
                <span className="font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-4 text-lg font-medium text-text-primary">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The SDK ────────────────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHead
                eyebrow="The SDK"
                title="A programmatic API, with an extension for every vertical."
                intro="@klorad/api turns the platform into code: a core scene API, plus an extension for each domain (campus, heritage, digital twin). Klorad's own products are built on it. So is anything you build."
              />
              <Link
                href="/research"
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                Read the research
                <ArrowIcon />
              </Link>
            </div>
            <pre className="glass-panel overflow-x-auto rounded-2xl p-6 font-mono text-[13px] leading-[1.7] text-text-secondary shadow-glass">
              {codeSample}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Proof ──────────────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="In production"
            title="The platform, proven."
            intro="Klorad is not a framework looking for a use. It ships as four products, each a world built on this foundation."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {verticals.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                className="group flex items-center justify-between glass-panel rounded-xl px-5 py-4 transition-colors hover:border-accent"
              >
                <span className="text-sm font-medium text-text-primary">
                  {v.name}
                </span>
                <ArrowIcon className="text-text-tertiary transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent" />
              </Link>
            ))}
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
            Build on Klorad.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
            Start with a product, or build a new world on the platform. Either
            way, the foundation is already there.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/contact" className={btnPrimary}>
              Schedule a demo
            </Link>
            <Link href="/samples" className={btnGhost}>
              Browse the worlds
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
