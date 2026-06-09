import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Organisation settings" };

export default async function OrgSettingsGeneralPage({
  params,
}: {
  params: Params;
}) {
  const { orgId } = await params;
  return (
    <ComingSoon
      eyebrow="Organisation"
      title="Settings."
      description="Org name, slug, branding defaults, billing plan. Lands in the next pass."
      backHref={`/org/${orgId}`}
      backLabel="Back to projects"
    />
  );
}
