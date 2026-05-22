import { KloradMark } from "@klorad/design-system";

/**
 * Friendly "coming soon" placeholder for an unpublished campus —
 * shared by the public home and map routes. No internal data leaked:
 * the visitor sees only the campus name (already known via the URL).
 */
export default function NotPublishedPlaceholder({ name }: { name: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-16 text-center">
      <KloradMark className="h-10 w-10" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">
        {name}
      </h1>
      <p className="mt-3 max-w-sm text-sm text-text-secondary">
        This campus isn&apos;t published yet. The author is still building
        it — check back soon.
      </p>
      <p className="mt-8 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary">
        Powered by Klorad
      </p>
    </main>
  );
}
