import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id as string },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });

  if (membership) redirect(`/org/${membership.organizationId}/maps`);

  redirect("/onboarding");
}
