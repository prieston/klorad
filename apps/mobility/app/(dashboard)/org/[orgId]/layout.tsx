import { redirect } from "next/navigation";
import Link from "next/link";
import { Ban } from "lucide-react";
import { Panel } from "@klorad/design-system";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const APP_KEY = "mobility";

/**
 * Per-org gate. Mobility is enabled per-organisation by an admin
 * (Klorad admin app updates `Organization.apps`). When a user lands
 * on `/org/<id>/…` for an org that doesn't have Mobility in its
 * `apps` array, we render an in-shell "not enabled" panel instead of
 * 404'ing — so they can use the sidebar's org switcher to jump to
 * one that does. The DashboardShell from the parent layout still
 * wraps this output, keeping nav + the switcher + the user menu in
 * reach.
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
      <div className="mx-auto flex w-full max-w-[640px] flex-col items-center px-6 py-12 text-center">
        <Panel className="w-full rounded-2xl p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-text-secondary">
            <Ban size={24} strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-text-primary">
            Klorad Mobility is not enabled for this organisation
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            {member
              ? `"${member.organization.name}" doesn't have access to the Mobility app. Ask your Klorad admin to enable it, or pick another organisation from the sidebar.`
              : "You are not a member of this organisation, or it doesn't exist."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Link
              href="/org"
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              Back to my workspaces
            </Link>
            <a
              href="mailto:support@klorad.com?subject=Enable%20Klorad%20Mobility"
              className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent"
            >
              Contact admin
            </a>
          </div>
        </Panel>
      </div>
    );
  }

  return <>{children}</>;
}
