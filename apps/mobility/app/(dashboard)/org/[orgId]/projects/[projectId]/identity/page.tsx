import { ComingSoon } from "@/app/(dashboard)/components/ComingSoon";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Identity" };

export default async function IdentityPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
  return (
    <ComingSoon
      eyebrow="Identity"
      title="Project branding."
      description="Logo, primary colour, default map centre + zoom. Drives the white-label theming via @klorad/design-system/palette."
      backHref={`/org/${orgId}/projects/${projectId}`}
      backLabel="Back to operator console"
    />
  );
}
