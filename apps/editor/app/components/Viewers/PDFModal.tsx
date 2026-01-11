"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
  Alert,
  Link,
} from "@mui/material";
import { Close, NavigateBefore, NavigateNext, Download } from "@mui/icons-material";

interface PDFModalProps {
  open: boolean;
  onClose: () => void;
  pdfs: Array<{ url: string; title?: string }>;
  initialIndex?: number;
}

export const PDFModal: React.FC<PDFModalProps> = ({
  open,
  onClose,
  pdfs,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [pdfError, setPdfError] = useState(false);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setPdfError(false);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < pdfs.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setPdfError(false);
    }
  }, [currentIndex, pdfs.length]);

  // Reset index when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setPdfError(false);
    }
  }, [open, initialIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        handlePrevious();
      } else if (e.key === "ArrowRight" && currentIndex < pdfs.length - 1) {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, pdfs.length, onClose, handlePrevious, handleNext]);

  const currentPdf = pdfs[currentIndex];

  if (!currentPdf) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: "90vw",
          maxHeight: "90vh",
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          position: "relative",
        },
      }}
      BackdropProps={{
        sx: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <Box sx={{ flex: 1 }}>
          {currentPdf.title && (
            <Typography
              variant="h6"
              sx={{
                color: "white",
                fontWeight: 600,
                mb: 0.5,
              }}
            >
              {currentPdf.title}
            </Typography>
          )}
          {pdfs.length > 1 && (
            <Typography
              variant="caption"
              sx={{
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              {currentIndex + 1} / {pdfs.length}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Link
            href={currentPdf.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "white",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              "&:hover": {
                opacity: 0.8,
              },
            }}
          >
            <Download fontSize="small" />
            <Typography variant="caption">Download</Typography>
          </Link>
          <IconButton
            onClick={onClose}
            sx={{
              color: "white",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>
      </Box>

      {/* Navigation Buttons */}
      {pdfs.length > 1 && (
        <>
          <Button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            sx={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
              minWidth: 40,
              minHeight: 40,
              color: "white",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.7)",
              },
              "&:disabled": {
                color: "rgba(255, 255, 255, 0.3)",
              },
            }}
          >
            <NavigateBefore />
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentIndex === pdfs.length - 1}
            sx={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
              minWidth: 40,
              minHeight: 40,
              color: "white",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.7)",
              },
              "&:disabled": {
                color: "rgba(255, 255, 255, 0.3)",
              },
            }}
          >
            <NavigateNext />
          </Button>
        </>
      )}

      <DialogContent
        sx={{
          p: 0,
          height: "calc(90vh - 80px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {pdfError ? (
          <Alert
            severity="error"
            sx={{
              m: 2,
              backgroundColor: "rgba(211, 47, 47, 0.1)",
              color: "white",
            }}
            action={
              <Link
                href={currentPdf.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: "white",
                  textDecoration: "underline",
                }}
              >
                Download
              </Link>
            }
          >
            Unable to display PDF. Please download to view.
          </Alert>
        ) : (
          <Box
            component="iframe"
            src={`${currentPdf.url}#toolbar=0`}
            sx={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            onError={() => setPdfError(true)}
            title={currentPdf.title || `PDF ${currentIndex + 1}`}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
