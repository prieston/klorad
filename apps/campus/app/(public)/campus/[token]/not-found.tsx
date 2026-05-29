import { KloradMark } from "@klorad/design-system";

/**
 * Branded 404 for a campus that doesn't exist — replaces Next's
 * generic page when `notFound()` is called from `/campus/[token]/*`
 * (the home, the map, the redirect). No locale context here — Next's
 * not-found segment is static — so it renders in English.
 */
export default function CampusNotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-16 text-center">
      <KloradMark className="h-10 w-10" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-text-primary">
        Campus not found
      </h1>
      <p className="mt-3 max-w-sm text-sm text-text-secondary">
        The link you followed may be wrong, or this campus no longer
        exists.
      </p>
      <p className="mt-8 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary">
        Powered by Klorad
      </p>
    </main>
  );
}
