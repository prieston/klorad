import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Page, PageCard, PageContent, PageHeader, PageSection } from "@klorad/ui";
import { Stack, Typography } from "@mui/material";

export default async function SettingsGeneralPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return (
    <Page>
      <PageHeader title="Organization settings" />
      <PageContent>
        <PageSection title="General" spacing="tight">
          <PageCard>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Org name, slug, default language
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Organization-level settings live here — name, slug, default
                language, timezone. Coming next.
              </Typography>
            </Stack>
          </PageCard>
        </PageSection>
      </PageContent>
    </Page>
  );
}
