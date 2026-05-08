import { Box, Stack, Typography } from "@mui/material";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SignOutLink from "./SignOutLink";
import { Button } from "@mui/material";

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
      (m) => !m.organization.isPersonal && (m.organization.apps ?? []).includes("campus")
    );

  const title = hasOrgsWithoutCampus
    ? "Klorad Campus is not enabled on your organizations"
    : "Welcome to Klorad Campus";

  const description = hasOrgsWithoutCampus
    ? "Your account has access to Klorad, but none of your organizations have the Campus app enabled. Ask your admin to enable it, or contact us."
    : "You don't belong to any organization yet. Contact us to get started with a campus map for your institution.";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        bgcolor: "#0a0d10",
        color: "text.primary",
        px: 3,
        textAlign: "center",
      }}
    >
      <Image
        src="/images/logo/klorad-campus-logo-white.svg"
        alt="Klorad Campus"
        width={180}
        height={40}
        priority
        style={{ objectFit: "contain", height: "auto" }}
      />
      <Stack spacing={1} sx={{ maxWidth: 460 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {session?.user?.email && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Signed in as {session.user.email}
          </Typography>
        )}
      </Stack>
      <Stack direction="row" spacing={1.5}>
        <Button
          variant="contained"
          component={Link}
          href="mailto:support@klorad.com?subject=Enable%20Klorad%20Campus"
          sx={{ textTransform: "none" }}
        >
          Contact us
        </Button>
        {session?.user && <SignOutLink />}
      </Stack>
    </Box>
  );
}
