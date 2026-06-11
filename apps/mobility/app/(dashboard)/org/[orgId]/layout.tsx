import { redirect } from "next/navigation";
import Link from "next/link";
import { Ban } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardShell from "../../components/DashboardShell";
import { AccessGateLogoutButton } from "./AccessGateActions";

const APP_KEY = "mobility";

/**
 * Per-org access gate. Mobility is enabled per-organisation by an
 * admin (Klorad admin app updates `Organization.apps`). When access
 * is granted, the page is wrapped in the `DashboardShell` sidebar.
 * When access is denied — or the user is not a member of the org —
 * we render a **bare panel** (no shell, no sidebar) so the user has
 * a clean recovery surface with Contact admin + Log out, rather
 * than nav rails to dead routes.
 */
export default async function OrgScopeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { orgId } = await params;

  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
    include: { organization: true },
  });

  const apps = member?.organization.apps ?? [];
  const hasAccess = !!member && apps.includes(APP_KEY);

  if (!hasAccess) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-6 py-12 text-center">
        <Panel className="w-full max-w-[560px] rounded-2xl p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
            <Ban size={24} strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-text-primary">
            Klorad Mobility is not enabled for this organisation
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            {member
              ? `"${member.organization.name}" doesn't have access to the Mobility app. Ask your Klorad admin to enable it, or sign out and switch accounts.`
              : "You are not a member of this organisation, or it doesn't exist."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <a
              href="mailto:support@klorad.com?subject=Enable%20Klorad%20Mobility"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              Contact admin
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent"
            >
              Back to home
            </Link>
            <AccessGateLogoutButton />
          </div>
        </Panel>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
