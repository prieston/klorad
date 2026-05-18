import Link from "next/link";
import {
  Eyebrow,
  ArrowIcon,
  SectionHead,
  btnPrimary,
  btnGhost,
} from "@/components/ui";

export type ProductData = {
  /** Full product name, e.g. "Klorad Campus". */
  product: string;
  /** Hero headline — the promise. */
  promise: string;
  /** Hero subhead. */
  lede: string;
  /** Hero tertiary line — who it is for. */
  intro: string;
  /** Three core capability cards. */
  capabilities: { title: string; desc: string }[];
  /** Feature grid (ideally six). */
  features: { title: string; desc: string }[];
  /** One sentence tying the product back to the platform. */
  builtOn: string;
  /** Closing CTA headline. */
  ctaTitle: string;
};

/** Shared template for every Klorad product page (Campus, Mobility, …). */
export function ProductPage({ data }: { data: ProductData }) {
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
            <Eyebrow>{data.product}</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              {data.promise}
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              {data.lede}
            </p>
            <p className="mt-3 max-w-xl text-[15px] text-text-tertiary">
              {data.intro}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className={btnPrimary}>
                Schedule a demo
              </Link>
              <Link href="/platform" className={btnGhost}>
                See the platform
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="What it does"
            title={`What ${data.product} does.`}
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {data.capabilities.map((c) => (
              <div key={c.title} className="glass-panel rounded-2xl p-7">
                <h3 className="text-xl font-medium text-text-primary">
                  {c.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead eyebrow="Features" title={`Inside ${data.product}.`} />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line-soft bg-line-soft md:grid-cols-2 lg:grid-cols-3">
            {data.features.map((f, i) => (
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

      {/* ── Built on Klorad ────────────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="glass-panel rounded-3xl p-10 md:p-14">
            <Eyebrow>Built on Klorad</Eyebrow>
            <p className="mt-5 max-w-3xl text-2xl font-light leading-[1.3] text-text-primary md:text-3xl">
              {data.builtOn}
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
            {data.ctaTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
            See {data.product} mapped to your needs — book a walkthrough with
            the team.
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
