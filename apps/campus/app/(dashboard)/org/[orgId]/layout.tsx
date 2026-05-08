import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Page, PageCard, PageContent } from "@klorad/ui";
import { Box, Button, Stack, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import Link from "next/link";

export default async function OrgLayout({
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
    where: { userId: session.user.id as string, organizationId: orgId },
    include: { organization: true },
  });

  // Not a member → hide existence (avoid enumeration) by treating as
  // access-denied the same way a non-campus org is treated.
  const apps = member?.organization.apps ?? [];
  const hasAccess = !!member && apps.includes("campus");

  if (!hasAccess) {
    return (
      <Page>
        <PageContent sx={{ mt: 0 }}>
          <PageCard>
            <Stack spacing={2} alignItems="center" sx={{ py: 6, textAlign: "center" }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "action.hover",
                  color: "text.secondary",
                }}
              >
                <BlockIcon />
              </Box>
              <Typography variant="h6" fontWeight={700}>
                Klorad Campus is not enabled for this organization
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
                {member
                  ? `"${member.organization.name}" doesn't have access to the Campus app. Ask your admin to enable it, or pick another organization from the sidebar.`
                  : "You are not a member of this organization, or it doesn't exist."}
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <Button
                  component={Link}
                  href="/"
                  variant="contained"
                  sx={{ textTransform: "none" }}
                >
                  Back to my workspaces
                </Button>
                <Button
                  component={Link}
                  href="mailto:support@klorad.com?subject=Enable%20Topos%20Campus"
                  variant="outlined"
                  sx={{ textTransform: "none" }}
                >
                  Contact admin
                </Button>
              </Stack>
            </Stack>
          </PageCard>
        </PageContent>
      </Page>
    );
  }

  return <>{children}</>;
}
