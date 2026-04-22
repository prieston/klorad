import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Page, PageCard, PageContent, PageHeader, PageSection } from "@klorad/ui";
import { Avatar, Box, Stack, Typography } from "@mui/material";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const { name, email, image } = session.user;
  const initial = (name?.charAt(0) || email?.charAt(0) || "U").toUpperCase();

  return (
    <Page>
      <PageHeader title="Profile" />
      <PageContent>
        <PageSection title="Account" spacing="tight">
          <PageCard>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={image ?? undefined} sx={{ width: 64, height: 64 }}>
                {initial}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" fontWeight={700}>
                  {name ?? "User"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {email}
                </Typography>
              </Box>
            </Stack>
          </PageCard>
        </PageSection>
        <PageSection title="Preferences" spacing="tight">
          <PageCard>
            <Typography variant="body2" color="text.secondary">
              Language, default locale, and notification preferences will
              appear here.
            </Typography>
          </PageCard>
        </PageSection>
      </PageContent>
    </Page>
  );
}
