"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

/**
 * Logout button rendered inside the bare access-gate panel. Lives in
 * its own client component so the gate layout can stay a server
 * component (it does Prisma reads).
 */
export function AccessGateLogoutButton() {
  return (
    <button
      type="button"
      onClick={() =>
        void signOut({ callbackUrl: "/auth/signin" })
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
    >
      <LogOut size={14} strokeWidth={1.8} aria-hidden />
      Log out
    </button>
  );
}
