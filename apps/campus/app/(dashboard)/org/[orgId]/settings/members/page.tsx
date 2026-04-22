import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Page, PageCard, PageContent, PageHeader, PageSection } from "@klorad/ui";
import { Stack, Typography } from "@mui/material";

export default async function SettingsMembersPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return (
    <Page>
      <PageHeader title="Members" />
      <PageContent>
        <PageSection title="Team" spacing="tight">
          <PageCard>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Invite teammates
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Invite marketing, facilities, or international office staff as
                Admin, Editor, or Viewer. Coming next.
              </Typography>
            </Stack>
          </PageCard>
        </PageSection>
      </PageContent>
    </Page>
  );
}
