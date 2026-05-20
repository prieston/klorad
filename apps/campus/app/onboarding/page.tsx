import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { KloradMark, buttonClassName } from "@klorad/design-system";
import SignOutLink from "./SignOutLink";

export default async function OnboardingPage() {
  const session = await auth();

  const memberships = session?.user?.id
    ? await prisma.organizationMember.findMany({
        where: { userId: session.user.id as string },
        include: { organization: true },
      })
    : [];

  const hasOrgsWithoutCampus =
    memberships.length > 0 &&
    !memberships.some(
      (m) =>
        !m.organization.isPersonal &&
        (m.organization.apps ?? []).includes("campus"),
    );

  const title = hasOrgsWithoutCampus
    ? "Klorad Campus is not enabled on your organizations"
    : "Welcome to Klorad Campus";

  const description = hasOrgsWithoutCampus
    ? "Your account has access to Klorad, but none of your organizations have the Campus app enabled. Ask your admin to enable it, or contact us."
    : "You don't belong to any organization yet. Contact us to get started with a campus map for your institution.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-text-primary">
      <KloradMark className="h-10 w-auto" />
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        <p className="text-sm text-text-secondary">{description}</p>
        {session?.user?.email && (
          <p className="pt-2 text-xs text-text-tertiary">
            Signed in as {session.user.email}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <a
          href="mailto:support@klorad.com?subject=Enable%20Klorad%20Campus"
          className={buttonClassName()}
        >
          Contact us
        </a>
        {session?.user && <SignOutLink />}
      </div>
    </div>
  );
}
