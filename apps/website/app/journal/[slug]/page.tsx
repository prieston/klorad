import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJournalPost, journalPosts } from "@/lib/journalPosts";

type JournalEntryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return journalPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(
  props: JournalEntryPageProps,
): Promise<Metadata> {
  const params = await props.params;
  const post = getJournalPost(params.slug);

  if (!post) {
    return { title: "Journal" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://klorad.com";

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      url: `${siteUrl}/journal/${params.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
    alternates: {
      canonical: `/journal/${params.slug}`,
    },
  };
}

export default async function JournalEntryPage(props: JournalEntryPageProps) {
  const params = await props.params;
  const post = getJournalPost(params.slug);

  if (!post) {
    notFound();
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(new Date(post.date));

  return (
    <article className="mx-auto max-w-[720px] px-6 py-20 md:py-28">
      <Link
        href="/journal"
        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        ← Journal
      </Link>

      <header className="mt-8 space-y-5 border-b border-line-soft pb-10">
        <div className="text-xs uppercase tracking-[0.24em] text-text-tertiary">
          {dateLabel}
        </div>
        <h1 className="text-[34px] font-light leading-[1.1] text-text-primary md:text-[44px]">
          {post.title}
        </h1>
        <p className="text-lg leading-relaxed text-text-secondary">
          {post.excerpt}
        </p>
      </header>

      <div className="mt-10 space-y-6 text-[17px] leading-[1.7] text-text-secondary">
        {post.body.split("\n\n").map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <footer className="mt-14 border-t border-line-soft pt-8 text-xs uppercase tracking-[0.28em] text-text-tertiary">
        Klorad Journal — field observations and architectural reasoning.
      </footer>
    </article>
  );
}
