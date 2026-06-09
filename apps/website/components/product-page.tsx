import Link from "next/link";
import Image from "next/image";
import {
  Eyebrow,
  ArrowIcon,
  SectionHead,
  btnPrimary,
  btnGhost,
} from "@/components/ui";

/** Three-card grouping used by the Problem block. */
export type ProductProblem = {
  /** Optional eyebrow. Defaults to "The problem". */
  eyebrow?: string;
  title: string;
  body: string;
  cards: { title: string; desc: string }[];
  /** Optional closing line shown below the card grid. */
  close?: string;
};

/** Four-card grouping shared by International / Data Hub / Digital Twin. */
export type ProductStrategySection = {
  eyebrow?: string;
  title: string;
  body: string;
  cards: { title: string; desc: string }[];
  /** Optional small tag rendered above the heading. Used by the
   *  Digital Twin section to flag that the capabilities listed are
   *  sensor-dependent and on the roadmap, not shipped today. */
  tag?: string;
};

/** Small proof band linking to the research page. */
export type ProductCredibility = {
  body: string;
  cta: { label: string; href: string };
  /** Optional thumbnail. Path under /public, e.g. "/research/klorad-system-model.png". */
  image?: { src: string; alt: string };
};

export type ProductData = {
  /** Full product name, e.g. "Klorad Campus". */
  product: string;
  /** Optional hero background image (path under /public). */
  heroImage?: string;
  /** Hero headline, the promise. */
  promise: string;
  /** Hero subhead. */
  lede: string;
  /** Hero tertiary line, who it is for. */
  intro: string;
  /** Three core capability cards. */
  capabilities: { title: string; desc: string }[];
  /** Feature grid (ideally six). */
  features: { title: string; desc: string }[];
  /** One sentence tying the product back to the platform. */
  builtOn: string;
  /** Closing CTA headline. */
  ctaTitle: string;
  /**
   * Optional URL to a running instance. When present, surfaces a
   * "View live" button alongside the primary CTA in both the hero
   * and the closing section. Buyers click to see the product
   * before booking the audit.
   */
  liveUrl?: string;
  /** Visible label for the live link. Defaults to "View live demo". */
  liveLabel?: string;
  /**
   * Optional problem section rendered between Hero and Capabilities.
   * When present, the page reads problem then solution then proof.
   */
  problem?: ProductProblem;
  /** Optional strategic sections rendered between Features and the
   *  "Built on Klorad" band. Each section follows the same shape: a
   *  SectionHead with body, then a four-card grid. */
  internationalPresence?: ProductStrategySection;
  dataHub?: ProductStrategySection;
  digitalTwin?: ProductStrategySection;
  /** Small credibility band rendered just before "Built on Klorad". */
  credibility?: ProductCredibility;
};

/** Shared template for every Klorad product page (Campus, Mobility, etc). */
export function ProductPage({ data }: { data: ProductData }) {
  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        {data.heroImage && (
          <>
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 w-full md:w-[72%]"
            >
              <Image
                src={data.heroImage}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 100vw, 72vw"
                className="object-cover object-left-top"
              />
            </div>
            {/* theme-aware scrim. Keeps the hero text legible over the image. */}
            <div aria-hidden className="absolute inset-0 hero-image-scrim" />
          </>
        )}
        <div
          aria-hidden
          className={`absolute inset-0 grid-field${
            data.heroImage ? " grid-field-faded" : ""
          }`}
        />
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
              {data.liveUrl ? (
                <a
                  href={data.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnPrimary}
                >
                  {data.liveLabel ?? "View live demo"}
                </a>
              ) : (
                <Link href="/contact" className={btnPrimary}>
                  Book an Architecture Audit
                </Link>
              )}
              {data.liveUrl ? (
                <Link href="/contact" className={btnGhost}>
                  Book an Architecture Audit
                </Link>
              ) : (
                <Link href="/platform" className={btnGhost}>
                  Explore the Platform
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────── */}
      {data.problem && (
        <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
          <div className="mx-auto max-w-container px-6 md:px-8">
            <SectionHead
              eyebrow={data.problem.eyebrow ?? "The problem"}
              title={data.problem.title}
              intro={data.problem.body}
            />
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {data.problem.cards.map((c) => (
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
            {data.problem.close && (
              <p className="mt-10 max-w-3xl text-base leading-relaxed text-text-primary md:text-lg">
                {data.problem.close}
              </p>
            )}
          </div>
        </section>
      )}

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

      {/* ── International presence ─────────────────────────── */}
      <StrategySection section={data.internationalPresence} />

      {/* ── Data hub ───────────────────────────────────────── */}
      <StrategySection
        section={data.dataHub}
        background="bg-surface-2"
      />

      {/* ── Dynamic digital twin (roadmap) ─────────────────── */}
      <StrategySection section={data.digitalTwin} />

      {/* ── Credibility ────────────────────────────────────── */}
      {data.credibility && (
        <section className="border-t border-line-soft bg-surface-2 py-16 md:py-20">
          <div className="mx-auto max-w-container px-6 md:px-8">
            <div className="glass-panel flex flex-col items-start gap-6 rounded-2xl p-7 md:flex-row md:items-center md:gap-8 md:p-9">
              {data.credibility.image && (
                <div className="shrink-0 overflow-hidden rounded-xl border border-line-soft bg-bg">
                  <Image
                    src={data.credibility.image.src}
                    alt={data.credibility.image.alt}
                    width={180}
                    height={92}
                    sizes="180px"
                    className="h-auto w-[180px]"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Eyebrow>Peer-reviewed</Eyebrow>
                <p className="mt-3 text-base leading-relaxed text-text-primary md:text-lg">
                  {data.credibility.body}
                </p>
                <Link
                  href={data.credibility.cta.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  {data.credibility.cta.label}
                  <ArrowIcon />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

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
            See {data.product} mapped to your needs. Book an architecture
            audit with the team.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {data.liveUrl ? (
              <a
                href={data.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={btnPrimary}
              >
                {data.liveLabel ?? "View live demo"}
              </a>
            ) : (
              <Link href="/contact" className={btnPrimary}>
                Book an Architecture Audit
              </Link>
            )}
            {data.liveUrl ? (
              <Link href="/contact" className={btnGhost}>
                Book an Architecture Audit
              </Link>
            ) : (
              <Link href="/samples" className={btnGhost}>
                Browse the worlds
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Shared layout for the International / Data Hub / Digital Twin
 *  sections. They have the same shape (head with optional tag, body,
 *  four-card grid) so they share one renderer. */
function StrategySection({
  section,
  background,
}: {
  section?: ProductStrategySection;
  background?: string;
}) {
  if (!section) return null;
  return (
    <section
      className={`border-t border-line-soft py-24 md:py-32${
        background ? ` ${background}` : ""
      }`}
    >
      <div className="mx-auto max-w-container px-6 md:px-8">
        <div className="max-w-3xl">
          {section.tag && (
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-accent">
              <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
              {section.tag}
            </span>
          )}
          {section.eyebrow && <Eyebrow>{section.eyebrow}</Eyebrow>}
          <h2 className="mt-5 text-3xl font-light leading-[1.12] text-text-primary md:text-[42px]">
            {section.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-text-secondary md:text-lg">
            {section.body}
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {section.cards.map((c) => (
            <div key={c.title} className="glass-panel rounded-2xl p-6">
              <h3 className="text-base font-medium text-text-primary">
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
  );
}
