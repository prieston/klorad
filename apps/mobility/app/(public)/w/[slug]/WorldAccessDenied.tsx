"use client";

import { signOut } from "next-auth/react";
import { Lock } from "lucide-react";

/**
 * Rendered when a signed-in viewer hits an `authenticated` world they
 * aren't a member of. We never confirm or deny *which* org the world
 * belongs to — the message is intentionally generic so the page
 * doubles as the not-found surface for membership probes.
 *
 * The "switch account" action signs the viewer out and bounces them
 * to the sign-in page with the same world URL as the callback, so
 * the natural flow is one tap → re-auth as the right account → world.
 */
export function WorldAccessDenied({ slug }: { slug: string }) {
  const callback = `/auth/signin?callbackUrl=${encodeURIComponent(`/w/${slug}`)}`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1220] px-6 text-center text-white">
      <div className="max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
          <Lock size={18} strokeWidth={1.7} aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Access required</h1>
        <p className="mt-2 text-sm text-white/70">
          This world is restricted to members of the owning organisation.
          If you should have access, switch to the correct account.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: callback })}
          className="mt-5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
        >
          Switch account
        </button>
      </div>
    </main>
  );
}
