import Link from "next/link";
import type { Metadata } from "next";
import { Eyebrow, SectionHead, btnPrimary, btnGhost } from "@/components/ui";

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Partner with Klorad — deliver geospatial digital-twin solutions on a platform you don't have to build. You bring the domain expertise; Klorad provides the foundation.",
  alternates: { canonical: "/partners" },
};

const reasons = [
  {
    title: "A platform, not a build",
    desc: "Deliver digital-twin solutions without building or maintaining engines, data pipelines, or visualization stacks. The foundation is already there.",
  },
  {
    title: "For real projects",
    desc: "Klorad is built for substantial work — infrastructure, mobility, heritage, land. Not experiments: deployments.",
  },
  {
    title: "You own the service",
    desc: "Consulting, integrations, methodology, and client relationships stay yours. Klorad accelerates delivery; your value stays at the centre.",
  },
];

const lookingFor = [
  "Deep expertise in a domain — mobility, infrastructure, heritage, planning, engineering",
  "Experience delivering to enterprise and public-sector clients",
  "The ability to coordinate stakeholders, requirements, and timelines",
  "A commitment to long-term, professional collaboration",
];

export default function PartnersPage() {
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
            <Eyebrow>Partners</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              Deliver more, build less.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              Klorad partners with engineering firms, domain specialists, and
              integrators who bring real expertise to complex environments — and
              need a platform they don&apos;t have to build.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className={btnPrimary}>
                Become a partner
              </Link>
              <Link href="/platform" className={btnGhost}>
                See the platform
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why partner ────────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="Why partner"
            title="You bring the expertise. We bring the foundation."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {reasons.map((r) => (
              <div key={r.title} className="glass-panel rounded-2xl p-7">
                <h3 className="text-xl font-medium text-text-primary">
                  {r.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who we look for ────────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <SectionHead
              eyebrow="Who we look for"
              title="Selected with discipline."
              intro="We collaborate where domain expertise genuinely matters — with organisations that understand their environments and can deliver responsibly."
            />
            <div className="glass-panel rounded-2xl p-8">
              <ul className="space-y-4">
                {lookingFor.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-relaxed text-text-secondary"
                  >
                    <span className="mt-0.5 text-accent">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
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
            Interested in partnership?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
            Let&apos;s explore how Klorad can become the backbone of the
            solutions you deliver.
          </p>
          <div className="mt-9 flex justify-center">
            <Link href="/contact" className={btnPrimary}>
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
