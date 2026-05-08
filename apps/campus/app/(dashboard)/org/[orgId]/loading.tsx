import { Box, Skeleton } from "@mui/material";
import { Page, PageContent } from "@klorad/ui";

export default function OrgLoading() {
  return (
    <Page>
      <PageContent>
        <Box sx={{ mt: 3 }}>
          <Skeleton variant="rounded" height={200} />
        </Box>
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={260} />
          ))}
        </Box>
      </PageContent>
    </Page>
  );
}
