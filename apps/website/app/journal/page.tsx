import Link from "next/link";
import type { Metadata } from "next";
import { journalPosts } from "@/lib/journalPosts";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes from the work of building and deploying Klorad: field observations and architectural reasoning.",
  alternates: { canonical: "/journal" },
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });

export default function JournalIndexPage() {
  const posts = [...journalPosts].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

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
              Field notes.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-text-secondary md:text-xl">
              Notes from the work of building and deploying Klorad: field
              observations and architectural reasoning.
            </p>
          </div>
        </div>
      </section>

      {/* ── Posts ──────────────────────────────────────────── */}
      <section className="border-t border-line-soft py-20 md:py-28">
        <div className="mx-auto max-w-container px-6 md:px-8">
          <div className="mx-auto max-w-3xl divide-y divide-line-soft">
            {posts.map((post) => (
              <article key={post.slug} className="py-10 first:pt-0">
                <div className="text-xs uppercase tracking-[0.24em] text-text-tertiary">
                  {dateFormatter.format(new Date(post.date))}
                </div>
                <h2 className="mt-3 text-2xl font-light text-text-primary md:text-3xl">
                  <Link
                    href={`/journal/${post.slug}`}
                    className="transition-colors hover:text-accent"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-3 leading-relaxed text-text-secondary">
                  {post.excerpt}
                </p>
                <Link
                  href={`/journal/${post.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  Read
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
