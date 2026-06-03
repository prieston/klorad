import Link from "next/link";
import type { Metadata } from "next";
import { ArrowIcon, Eyebrow, SectionHead } from "@/components/ui";
import {
  liveDemos,
  merginModeVideos,
  publications,
} from "@/lib/journalContent";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "What gets built on Klorad, the research it stands on, and the projects it grew out of.",
  alternates: { canonical: "/journal" },
};

export default function JournalIndexPage() {
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
            <Eyebrow>Journal</Eyebrow>
            <h1 className="mt-6 text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
              From the work.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              What gets built on Klorad, the research it stands on, and the
              projects it grew out of.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section A — Built on Klorad ─────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="Built on Klorad"
            title="Real worlds, running in the browser."
            intro="Open any of them — they're live. Tip: toggle Preview Mode off to move freely — scroll to zoom, hold the scroll-wheel and drag to look around; use Next / Previous to step through viewpoints."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {liveDemos.map((demo) => (
              <article
                key={demo.href}
                className="glass-panel flex flex-col rounded-2xl p-7"
              >
                <h3 className="text-xl font-medium text-text-primary">
                  {demo.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary">
                  {demo.description}
                </p>
                <a
                  href={demo.href}
                  target="_blank"
                  rel="noopener"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  Open the world
                  <ArrowIcon />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section B — Research library ───────────────────── */}
      <section className="border-t border-line-soft bg-surface-2 py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="The research"
            title="The peer-reviewed work behind the platform."
          />
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-text-tertiary">
            The 2025 system-model paper is featured on{" "}
            <Link
              href="/research"
              className="text-accent transition-colors hover:text-accent-hover"
            >
              Proven R&amp;D
            </Link>{" "}
            with the architecture diagram.
          </p>
          <ol className="mt-10 divide-y divide-line-soft">
            {publications.map((pub) => (
              <li key={pub.title} className="py-7 first:pt-0">
                <h3 className="text-lg font-medium leading-snug text-text-primary md:text-xl">
                  {pub.href ? (
                    <a
                      href={pub.href}
                      target="_blank"
                      rel="noopener"
                      className="transition-colors hover:text-accent"
                    >
                      {pub.title}
                    </a>
                  ) : (
                    pub.title
                  )}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {pub.description}
                </p>
                <p className="mt-2 text-xs italic leading-relaxed text-text-tertiary">
                  {pub.citation}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Section C — Projects ───────────────────────────── */}
      <section className="border-t border-line-soft py-24 md:py-32">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <SectionHead
            eyebrow="Projects"
            title="Research projects the platform grew out of and feeds into."
          />

          {/* C1 — Mergin' Mode */}
          <div className="mt-16">
            <h3 className="text-2xl font-medium text-text-primary md:text-3xl">
              Mergin&apos; Mode
            </h3>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary md:text-lg">
              Mergin&apos; Mode was an EU-co-financed (ERDF) research project:
              demonstrate monuments by merging real and virtual in mixed
              reality, served as location-based experiences on mobile devices —
              built entirely on OGC geospatial standards and JavaScript APIs.
              It pairs an authoring tool with an end-user app, toward a
              &ldquo;web of cultural data&rdquo; that activates on a phone the
              way maps do.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {merginModeVideos.map((video) => (
                <figure
                  key={video.id}
                  className="glass-panel overflow-hidden rounded-2xl p-3"
                >
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                      title={video.caption}
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      loading="lazy"
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                  <figcaption className="mt-3 px-2 pb-1 text-xs uppercase tracking-[0.18em] text-text-tertiary">
                    {video.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          {/* C2 — FIREFLY */}
          <div className="mt-20">
            <div className="glass-panel rounded-3xl p-10 md:p-14">
              <Eyebrow>FIREFLY</Eyebrow>
              <p className="mt-5 max-w-3xl text-xl font-light leading-relaxed text-text-primary md:text-2xl">
                A research project with the &ldquo;Athena&rdquo; Research
                Center, FIREFLY targets intelligent, real-time modelling of the
                cognitive abilities of elderly people — pushing the
                technological groundwork that platforms like Klorad build on.
              </p>
              <a
                href="http://firefly.prieston.gr/"
                target="_blank"
                rel="noopener"
                className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              >
                Visit FIREFLY
                <ArrowIcon />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
