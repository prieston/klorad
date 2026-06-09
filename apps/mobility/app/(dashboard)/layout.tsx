import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import DashboardShell from "./components/DashboardShell";

/**
 * Dashboard shell — auth-gates everything under `/org/...` and
 * wraps the page in the AppShell sidebar so org + project nav is
 * always one click away.
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
  return <DashboardShell>{children}</DashboardShell>;
}
