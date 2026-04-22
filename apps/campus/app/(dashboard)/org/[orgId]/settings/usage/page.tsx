import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Box } from "@mui/material";
import { MetricCard, Page, PageCard, PageContent, PageHeader, PageSection } from "@klorad/ui";
import MapIcon from "@mui/icons-material/Map";
import PlaceIcon from "@mui/icons-material/Place";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ApartmentIcon from "@mui/icons-material/Apartment";
import { Typography } from "@mui/material";

export default async function SettingsUsagePage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  return (
    <Page>
      <PageHeader title="Usage" />
      <PageContent>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
            },
          }}
        >
          <MetricCard icon={<MapIcon fontSize="small" />} value="—" label="Campus maps" />
          <MetricCard icon={<PlaceIcon fontSize="small" />} value="—" label="Total POIs" />
          <MetricCard icon={<ApartmentIcon fontSize="small" />} value="—" label="Floor plans" />
          <MetricCard icon={<VisibilityIcon fontSize="small" />} value="—" label="Views (30d)" />
        </Box>
        <PageSection title="Plan" spacing="tight">
          <PageCard>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Pro · €5k / yr
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Detailed usage, plan limits, and invoicing land here once
              billing is wired. Contact us to adjust your plan meanwhile.
            </Typography>
          </PageCard>
        </PageSection>
      </PageContent>
    </Page>
  );
}
