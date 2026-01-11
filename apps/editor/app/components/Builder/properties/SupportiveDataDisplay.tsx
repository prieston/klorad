"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Link,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  ExpandMore,
  Image as ImageIcon,
  PictureAsPdf,
  Description,
  Link as LinkIcon,
} from "@mui/icons-material";
import useSWR from "swr";
import { type SupportiveData, modelFetcher } from "@/app/utils/api";
import { ImageModal, PDFModal } from "@/app/components/Viewers";

interface SupportiveDataDisplayProps {
  assetId?: string;
  projectId?: string;
}

export const SupportiveDataDisplay: React.FC<SupportiveDataDisplayProps> = ({
  assetId,
  projectId,
}) => {
  // Modal state
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);

  // Build URL with projectId query parameter for public access
  const assetUrl = useMemo(() => {
    if (!assetId) return null;
    const url = `/api/models/${assetId}`;
    if (projectId) {
      return `${url}?projectId=${projectId}`;
    }
    return url;
  }, [assetId, projectId]);

  const { data, error, isLoading } = useSWR(
    assetUrl,
    modelFetcher
  );

  if (!assetId) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ fontSize: "0.75rem" }}>
        Failed to load supportive data
      </Alert>
    );
  }

  const metadata = data?.metadata as any;
  const supportiveData: SupportiveData | undefined =
    metadata?.supportiveData;

  if (!supportiveData) {
    return null;
  }

  const hasAnyData =
    (supportiveData.images && supportiveData.images.length > 0) ||
    (supportiveData.pdfs && supportiveData.pdfs.length > 0) ||
    (supportiveData.textDescriptions &&
      supportiveData.textDescriptions.length > 0) ||
    (supportiveData.externalLinks &&
      supportiveData.externalLinks.length > 0);

  if (!hasAnyData) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "rgba(100, 116, 139, 0.8)",
          mb: 1.5,
        }}
      >
        Supportive Data
      </Typography>

      {/* Images Section */}
      {supportiveData.images && supportiveData.images.length > 0 && (
        <Accordion defaultExpanded sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ImageIcon sx={{ fontSize: "1.2rem" }} />
              <Typography variant="subtitle2">Images</Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", ml: 1 }}
              >
                ({supportiveData.images.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 2,
              }}
            >
              {supportiveData.images.map((image, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "scale(1.02)",
                      boxShadow: 3,
                    },
                  }}
                  onClick={() => {
                    setSelectedImageIndex(index);
                    setImageModalOpen(true);
                  }}
                >
                  <Box
                    component="img"
                    src={image.url}
                    alt={image.caption || `Image ${index + 1}`}
                    sx={{
                      width: "100%",
                      height: 150,
                      objectFit: "cover",
                      borderRadius: 1,
                    }}
                  />
                  {image.caption && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.688rem",
                        color: "text.secondary",
                        textAlign: "center",
                      }}
                    >
                      {image.caption}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* PDFs Section */}
      {supportiveData.pdfs && supportiveData.pdfs.length > 0 && (
        <Accordion defaultExpanded sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PictureAsPdf sx={{ fontSize: "1.2rem" }} />
              <Typography variant="subtitle2">PDFs</Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", ml: 1 }}
              >
                ({supportiveData.pdfs.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {supportiveData.pdfs.map((pdf, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 1.5,
                    cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": {
                      transform: "scale(1.01)",
                      boxShadow: 3,
                    },
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedPdfIndex(index);
                    setPdfModalOpen(true);
                  }}
                >
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <PictureAsPdf
                      sx={{ fontSize: "1.5rem", color: "error.main" }}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, mb: 0.5 }}
                      >
                        {pdf.title || `PDF ${index + 1}`}
                      </Typography>
                      <Link
                        href={pdf.url}
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedPdfIndex(index);
                          setPdfModalOpen(true);
                        }}
                        sx={{ fontSize: "0.75rem", cursor: "pointer" }}
                      >
                        Open PDF
                      </Link>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Text Descriptions Section */}
      {supportiveData.textDescriptions &&
        supportiveData.textDescriptions.length > 0 && (
          <Accordion defaultExpanded sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Description sx={{ fontSize: "1.2rem" }} />
                <Typography variant="subtitle2">Text Descriptions</Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", ml: 1 }}
                >
                  ({supportiveData.textDescriptions.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {supportiveData.textDescriptions.map((desc, index) => (
                  <Paper key={index} sx={{ p: 1.5 }}>
                    {desc.title && (
                      <Typography
                        variant="subtitle2"
                        sx={{ mb: 1, fontWeight: 600 }}
                      >
                        {desc.title}
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {desc.content}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

      {/* External Links Section */}
      {supportiveData.externalLinks &&
        supportiveData.externalLinks.length > 0 && (
          <Accordion defaultExpanded sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LinkIcon sx={{ fontSize: "1.2rem" }} />
                <Typography variant="subtitle2">External Links</Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", ml: 1 }}
                >
                  ({supportiveData.externalLinks.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {supportiveData.externalLinks.map((link, index) => (
                  <Paper key={index} sx={{ p: 1.5 }}>
                    <Link
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        display: "block",
                        mb: 0.5,
                      }}
                    >
                      {link.label}
                    </Link>
                    {link.description && (
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: "0.688rem",
                          color: "text.secondary",
                          display: "block",
                        }}
                      >
                        {link.description}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

      {/* Image Modal */}
      {supportiveData.images && supportiveData.images.length > 0 && (
        <ImageModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          images={supportiveData.images}
          initialIndex={selectedImageIndex}
        />
      )}

      {/* PDF Modal */}
      {supportiveData.pdfs && supportiveData.pdfs.length > 0 && (
        <PDFModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          pdfs={supportiveData.pdfs}
          initialIndex={selectedPdfIndex}
        />
      )}
    </Box>
  );
};
