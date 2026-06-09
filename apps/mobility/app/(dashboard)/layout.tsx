import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";

/**
 * Auth-gates everything under `/org/...`. The AppShell sidebar is
 * wrapped inside the per-org layout so the access gate (when the
 * org isn't enabled for Mobility) can render bare — without the
 * shell — and the user gets a clean recovery surface instead of
 * nav rails to dead routes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  return <>{children}</>;
}
