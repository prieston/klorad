import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "#0a0d10",
        color: "text.primary",
      }}
    >
      <Typography variant="h5" fontWeight={700}>
        Welcome to Campus Maps
      </Typography>
      <Typography variant="body2" color="text.secondary">
        You don&apos;t belong to any organization yet.
      </Typography>
      <Button variant="outlined" size="small" component={Link} href="mailto:support@klorad.com">
        Contact us to get started
      </Button>
    </Box>
  );
}
