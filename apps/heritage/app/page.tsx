import Link from "next/link";
import { KloradMark } from "@klorad/design-system";
import { auth } from "@/auth";

/**
 * Landing page for the curator-facing half of Heritage. The visitor-facing
 * half lives under `/v/[slug]` and is reached by QR or a direct link
 * (§7.1.10), never through here.
 */
export default async function HeritageLandingPage() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-[80dvh] w-full max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16 md:px-10">
      <span className="inline-flex items-center gap-2.5 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <KloradMark className="h-4 w-auto" title="" />
        Klorad Heritage
      </span>
      <h1 className="text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
        Captured reality,
        <br />
        with its record intact.
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
        Scanned sites and captured artifacts, delivered in a browser and in a
        headset — holding the provenance, the rights and the aggregation feed
        behind them. Built on the same Klorad platform as Campus.
      </p>
      {session?.user ? (
        <Link
          href="/org"
          className="mt-2 inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Open the curator console
        </Link>
      ) : (
        <Link
          href="/auth/signin"
          className="mt-2 inline-flex items-center justify-center rounded-md border border-line-strong px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
        >
          Sign in
        </Link>
      )}
    </main>
  );
}
