"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { PageCard, PageSection } from "@klorad/ui";

export default function AssetsTab() {
  return (
    <Stack spacing={4} sx={{ mt: 3 }}>
      <PageSection title="Floor Plans" spacing="tight">
        <PageCard>
          <EmptyBlock
            title="No floor plans yet"
            description="Upload floor-plan images (PNG or JPG) and georeference them onto a building. The public viewer will reveal them when visitors dive into a building."
            actionLabel="Upload floor plan"
          />
        </PageCard>
      </PageSection>

      <PageSection title="360° Photos" spacing="tight">
        <PageCard>
          <Typography variant="body2" color="text.secondary">
            360° virtual tours are available as an add-on. Contact us to enable
            production support — or, once enabled, upload panoramas here and
            link them from POIs.
          </Typography>
        </PageCard>
      </PageSection>

      <PageSection title="Media Library" spacing="tight">
        <PageCard>
          <EmptyBlock
            title="No media yet"
            description="POI images, documents, and videos live here. Drag files or upload to attach them to any POI."
            actionLabel="Upload media"
          />
        </PageCard>
      </PageSection>
    </Stack>
  );
}

function EmptyBlock({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 40, color: "text.secondary", opacity: 0.4 }} />
      <Typography variant="subtitle2" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
        {description}
      </Typography>
      <Button variant="outlined" size="small" disabled sx={{ mt: 1, textTransform: "none" }}>
        {actionLabel}
      </Button>
    </Box>
  );
}
