import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardShell from "./components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return <DashboardShell>{children}</DashboardShell>;
}
