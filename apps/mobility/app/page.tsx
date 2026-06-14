import Link from "next/link";
import { auth } from "@/auth";

/**
 * Landing page. Once a session exists we redirect into the
 * operator dashboard via the org switcher. Without a session we
 * show a friendly entry point.
 *
 * PR 7 (this scaffold) doesn't ship the org dashboard yet — that
 * arrives in PR 8 (Data Source settings) and PR 10 (operator
 * console). The landing here is intentionally minimal.
 */
export default async function MobilityLandingPage() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-[80dvh] w-full max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16 md:px-10">
      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        Klorad Mobility
      </span>
      <h1 className="text-4xl font-light leading-[1.05] text-text-primary md:text-6xl">
        Live traffic management,
        <br />
        one console.
      </h1>
      <p className="max-w-xl text-base leading-relaxed text-text-secondary md:text-lg">
        Operator dashboard for ATMS-connected agencies. Cameras, dynamic
        signs, alerts, and a public traveller map. Built on the same Klorad
        platform as Campus.
      </p>
      {session?.user ? (
        <Link
          href="/org"
          className="mt-2 inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Open the dashboard
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
