"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  Button,
} from "@mui/material";
import { Close, ZoomIn, ZoomOut, NavigateBefore, NavigateNext } from "@mui/icons-material";

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  images: Array<{ url: string; caption?: string }>;
  initialIndex?: number;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  open,
  onClose,
  images,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [imageLoading, setImageLoading] = useState(true);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setZoom(1);
      setImageLoading(true);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setZoom(1);
      setImageLoading(true);
    }
  }, [currentIndex, images.length]);

  // Reset zoom and index when modal opens/closes or images change
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setImageLoading(true);
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
      } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, images.length, onClose, handlePrevious, handleNext]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          maxWidth: "90vw",
          maxHeight: "90vh",
          width: "auto",
          height: "auto",
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
      {/* Close Button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          color: "white",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
          },
        }}
      >
        <Close />
      </IconButton>

      {/* Zoom Controls */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 1,
          display: "flex",
          gap: 1,
        }}
      >
        <IconButton
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          sx={{
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
          <ZoomOut />
        </IconButton>
        <IconButton
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          sx={{
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
          <ZoomIn />
        </IconButton>
      </Box>

      {/* Navigation Buttons */}
      {images.length > 1 && (
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
            disabled={currentIndex === images.length - 1}
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
          p: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 400,
          minHeight: 300,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Loading Spinner */}
        {imageLoading && (
          <CircularProgress
            sx={{
              position: "absolute",
              color: "white",
            }}
          />
        )}

        {/* Image */}
        <Box
          component="img"
          src={currentImage.url}
          alt={currentImage.caption || `Image ${currentIndex + 1}`}
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
          sx={{
            maxWidth: "85vw",
            maxHeight: "85vh",
            objectFit: "contain",
            transform: `scale(${zoom})`,
            transition: "transform 0.2s ease-in-out",
            display: imageLoading ? "none" : "block",
          }}
        />

        {/* Caption */}
        {currentImage.caption && (
          <Typography
            variant="body2"
            sx={{
              mt: 2,
              color: "white",
              textAlign: "center",
              maxWidth: "85vw",
            }}
          >
            {currentImage.caption}
          </Typography>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <Typography
            variant="caption"
            sx={{
              mt: 1,
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            {currentIndex + 1} / {images.length}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
