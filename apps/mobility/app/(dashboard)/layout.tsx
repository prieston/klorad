import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";

/**
 * Dashboard shell — auth-gates everything under `/org/...`. Sign-in
 * page lives at /auth/signin (NextAuth default).
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
