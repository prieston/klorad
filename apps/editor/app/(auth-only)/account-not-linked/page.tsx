import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import NoOrganizationAccess from "@/app/components/NoOrganizationAccess";

export const dynamic = "force-dynamic";

export default async function AccountNotLinkedPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return null; // Layout will handle redirect
  }

  // Fetch user's firstName
  const user = await (prisma.user.findUnique as any)({
    where: { id: session.user.id },
    select: { name: true },
  }) as { name: string | null } | null;

  const firstName = user?.name?.split(" ")[0] || null;

  return <NoOrganizationAccess firstName={firstName} />;
}



