"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  LinearProgress,
  Link,
} from "@mui/material";
import {
  ExpandMore,
  Add,
  Delete,
  Image as ImageIcon,
  PictureAsPdf,
  Description,
  Link as LinkIcon,
  CloudUpload,
  Save,
  Close,
} from "@mui/icons-material";
import { textFieldStyles, showToast } from "@klorad/ui";
import {
  getSupportiveDataUploadUrl,
  uploadToSignedUrl,
  updateModelMetadata,
  type SupportiveData,
  type Asset,
} from "@/app/utils/api";

interface SupportiveDataSectionProps {
  asset: Asset;
  onUpdate: () => void; // Callback to refresh asset data
}

export const SupportiveDataSection: React.FC<SupportiveDataSectionProps> = ({
  asset,
  onUpdate,
}) => {
  const initialSupportiveData: SupportiveData =
    ((asset.metadata as Record<string, unknown>)
      ?.supportiveData as SupportiveData) || {};
  const [supportiveData, setSupportiveData] = useState<SupportiveData>(
    initialSupportiveData
  );
  const [lastSavedData, setLastSavedData] = useState<SupportiveData>(
    initialSupportiveData
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Sync with asset metadata when asset changes
  useEffect(() => {
    const metadata = asset.metadata as Record<string, unknown>;
    const newData = (metadata?.supportiveData as SupportiveData) || {};
    setSupportiveData(newData);
    setLastSavedData(newData);
  }, [asset.id, asset.metadata]);

  const saveSupportiveData = useCallback(
    async (newData: SupportiveData) => {
      try {
        const currentMetadata = (asset.metadata || {}) as Record<
          string,
          unknown
        >;
        await updateModelMetadata(asset.id, {
          metadata: {
            ...currentMetadata,
            supportiveData: newData,
          },
        });
        setSupportiveData(newData);
        setLastSavedData(newData);
        onUpdate();
        showToast("Supportive data updated successfully", "success");
      } catch (error) {
        console.error("Error saving supportive data:", error);
        showToast("Failed to save supportive data", "error");
      }
    },
    [asset.id, asset.metadata, onUpdate]
  );

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("Image size must be less than 10MB", "error");
      return;
    }

    setUploading(`image-${file.name}`);
    setUploadProgress(0);

    try {
      const { signedUrl, acl } = await getSupportiveDataUploadUrl({
        fileName: file.name,
        fileType: file.type,
      });

      await uploadToSignedUrl(signedUrl, file, {
        contentType: file.type,
        acl,
        onProgress: setUploadProgress,
      });

      const imageUrl = signedUrl.split("?")[0];
      const newImages = [
        ...(supportiveData.images || []),
        {
          url: imageUrl,
          caption: "",
          uploadedAt: new Date().toISOString(),
        },
      ];

      await saveSupportiveData({
        ...supportiveData,
        images: newImages,
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      showToast("Failed to upload image", "error");
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      showToast("Please select a PDF file", "error");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showToast("PDF size must be less than 50MB", "error");
      return;
    }

    setUploading(`pdf-${file.name}`);
    setUploadProgress(0);

    try {
      const { signedUrl, acl } = await getSupportiveDataUploadUrl({
        fileName: file.name,
        fileType: file.type,
      });

      await uploadToSignedUrl(signedUrl, file, {
        contentType: file.type,
        acl,
        onProgress: setUploadProgress,
      });

      const pdfUrl = signedUrl.split("?")[0];
      const newPdfs = [
        ...(supportiveData.pdfs || []),
        {
          url: pdfUrl,
          title: file.name.replace(".pdf", ""),
          uploadedAt: new Date().toISOString(),
        },
      ];

      await saveSupportiveData({
        ...supportiveData,
        pdfs: newPdfs,
      });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      showToast("Failed to upload PDF", "error");
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handleDeleteImage = async (index: number) => {
    const newImages =
      supportiveData.images?.filter((_, i) => i !== index) || [];
    await saveSupportiveData({
      ...supportiveData,
      images: newImages.length > 0 ? newImages : undefined,
    });
  };

  const handleDeletePdf = async (index: number) => {
    const newPdfs = supportiveData.pdfs?.filter((_, i) => i !== index) || [];
    await saveSupportiveData({
      ...supportiveData,
      pdfs: newPdfs.length > 0 ? newPdfs : undefined,
    });
  };

  const handleUpdateImageCaption = (index: number, caption: string) => {
    if (!supportiveData.images) return;
    const newImages = [...supportiveData.images];
    newImages[index] = { ...newImages[index], caption };
    setSupportiveData({
      ...supportiveData,
      images: newImages,
    });
  };

  const handleSaveImageCaption = async (_index: number) => {
    await saveSupportiveData(supportiveData);
  };

  const handleCancelImageCaption = (index: number) => {
    const savedImage = lastSavedData.images?.[index];
    if (!supportiveData.images || !savedImage) return;
    const newImages = [...supportiveData.images];
    newImages[index] = savedImage;
    setSupportiveData({
      ...supportiveData,
      images: newImages,
    });
  };

  const handleUpdatePdfTitle = (index: number, title: string) => {
    if (!supportiveData.pdfs) return;
    const newPdfs = [...supportiveData.pdfs];
    newPdfs[index] = { ...newPdfs[index], title };
    setSupportiveData({
      ...supportiveData,
      pdfs: newPdfs,
    });
  };

  const handleSavePdfTitle = async (_index: number) => {
    await saveSupportiveData(supportiveData);
  };

  const handleCancelPdfTitle = (index: number) => {
    const savedPdf = lastSavedData.pdfs?.[index];
    if (!supportiveData.pdfs || !savedPdf) return;
    const newPdfs = [...supportiveData.pdfs];
    newPdfs[index] = savedPdf;
    setSupportiveData({
      ...supportiveData,
      pdfs: newPdfs,
    });
  };

  const handleAddTextDescription = () => {
    const newDescriptions = [
      ...(supportiveData.textDescriptions || []),
      { content: "", title: "" },
    ];
    setSupportiveData({
      ...supportiveData,
      textDescriptions: newDescriptions,
    });
  };

  const handleUpdateTextDescription = (
    index: number,
    field: "content" | "title",
    value: string
  ) => {
    if (!supportiveData.textDescriptions) return;
    const newDescriptions = [...supportiveData.textDescriptions];
    newDescriptions[index] = { ...newDescriptions[index], [field]: value };
    setSupportiveData({
      ...supportiveData,
      textDescriptions: newDescriptions,
    });
  };

  const handleSaveTextDescription = async (index: number) => {
    const desc = supportiveData.textDescriptions?.[index];
    if (desc && desc.content && desc.content.trim()) {
      await saveSupportiveData(supportiveData);
    } else {
      showToast("Description content is required", "error");
    }
  };

  const handleCancelTextDescription = (index: number) => {
    const savedDesc = lastSavedData.textDescriptions?.[index];
    if (!supportiveData.textDescriptions) return;

    // If this is a new entry (doesn't exist in saved data), remove it
    if (!savedDesc) {
      const newDescriptions = supportiveData.textDescriptions.filter(
        (_, i) => i !== index
      );
      setSupportiveData({
        ...supportiveData,
        textDescriptions:
          newDescriptions.length > 0 ? newDescriptions : undefined,
      });
      return;
    }

    // Otherwise, revert to saved state
    const newDescriptions = [...supportiveData.textDescriptions];
    newDescriptions[index] = savedDesc;
    setSupportiveData({
      ...supportiveData,
      textDescriptions: newDescriptions,
    });
  };

  const handleDeleteTextDescription = async (index: number) => {
    const newDescriptions =
      supportiveData.textDescriptions?.filter((_, i) => i !== index) || [];
    await saveSupportiveData({
      ...supportiveData,
      textDescriptions:
        newDescriptions.length > 0 ? newDescriptions : undefined,
    });
  };

  const handleAddExternalLink = () => {
    const newLinks = [
      ...(supportiveData.externalLinks || []),
      { url: "", label: "", description: "" },
    ];
    setSupportiveData({
      ...supportiveData,
      externalLinks: newLinks,
    });
  };

  const handleUpdateExternalLink = (
    index: number,
    field: "url" | "label" | "description",
    value: string
  ) => {
    if (!supportiveData.externalLinks) return;
    const newLinks = [...supportiveData.externalLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setSupportiveData({
      ...supportiveData,
      externalLinks: newLinks,
    });
  };

  const handleSaveExternalLink = async (index: number) => {
    const link = supportiveData.externalLinks?.[index];
    if (link && link.url && link.label) {
      // Validate URL
      try {
        new URL(link.url);
        await saveSupportiveData(supportiveData);
      } catch {
        showToast("Please enter a valid URL", "error");
      }
    } else {
      showToast("URL and label are required", "error");
    }
  };

  const handleCancelExternalLink = (index: number) => {
    const savedLink = lastSavedData.externalLinks?.[index];
    if (!supportiveData.externalLinks) return;

    // If this is a new entry (doesn't exist in saved data), remove it
    if (!savedLink) {
      const newLinks = supportiveData.externalLinks.filter(
        (_, i) => i !== index
      );
      setSupportiveData({
        ...supportiveData,
        externalLinks: newLinks.length > 0 ? newLinks : undefined,
      });
      return;
    }

    // Otherwise, revert to saved state
    const newLinks = [...supportiveData.externalLinks];
    newLinks[index] = savedLink;
    setSupportiveData({
      ...supportiveData,
      externalLinks: newLinks,
    });
  };

  const hasUnsavedTextDescription = (index: number): boolean => {
    const current = supportiveData.textDescriptions?.[index];
    const saved = lastSavedData.textDescriptions?.[index];
    if (!current && !saved) return false;
    if (!current || !saved) return true;
    return current.title !== saved.title || current.content !== saved.content;
  };

  const hasUnsavedExternalLink = (index: number): boolean => {
    const current = supportiveData.externalLinks?.[index];
    const saved = lastSavedData.externalLinks?.[index];
    if (!current && !saved) return false;
    if (!current || !saved) return true;
    return (
      current.url !== saved.url ||
      current.label !== saved.label ||
      current.description !== saved.description
    );
  };

  const hasUnsavedImageCaption = (index: number): boolean => {
    const current = supportiveData.images?.[index];
    const saved = lastSavedData.images?.[index];
    if (!current && !saved) return false;
    if (!current || !saved) return true;
    return current.caption !== saved.caption;
  };

  const hasUnsavedPdfTitle = (index: number): boolean => {
    const current = supportiveData.pdfs?.[index];
    const saved = lastSavedData.pdfs?.[index];
    if (!current && !saved) return false;
    if (!current || !saved) return true;
    return current.title !== saved.title;
  };

  const handleDeleteExternalLink = async (index: number) => {
    const newLinks =
      supportiveData.externalLinks?.filter((_, i) => i !== index) || [];
    await saveSupportiveData({
      ...supportiveData,
      externalLinks: newLinks.length > 0 ? newLinks : undefined,
    });
  };

  // Always render the section, even if empty
  return (
    <Box sx={{ mt: 2, display: "block" }}>
      <Typography
        variant="subtitle2"
        sx={{
          fontSize: "1rem",
          fontWeight: 600,
          color: "text.primary",
          mb: 1,
        }}
      >
        Supportive Data
      </Typography>

      {/* Images Section */}
      <Accordion defaultExpanded sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ImageIcon sx={{ fontSize: "1.2rem" }} />
            <Typography variant="subtitle2">Images</Typography>
            {supportiveData.images && supportiveData.images.length > 0 && (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", ml: 1 }}
              >
                ({supportiveData.images.length})
              </Typography>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {supportiveData.images?.map((image, index) => (
              <Paper
                key={index}
                sx={{
                  p: 2,
                  display: "flex",
                  gap: 2,
                  alignItems: "flex-start",
                }}
              >
                <Box
                  component="img"
                  src={image.url}
                  alt={image.caption || `Image ${index + 1}`}
                  sx={{
                    width: 100,
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 1,
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Box
                    sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                  >
                    <TextField
                      label="Caption"
                      value={image.caption || ""}
                      onChange={(e) =>
                        handleUpdateImageCaption(index, e.target.value)
                      }
                      size="small"
                      fullWidth
                      sx={textFieldStyles}
                    />
                    {hasUnsavedImageCaption(index) && (
                      <>
                        <IconButton
                          onClick={() => handleSaveImageCaption(index)}
                          color="primary"
                          size="small"
                          title="Save"
                        >
                          <Save />
                        </IconButton>
                        <IconButton
                          onClick={() => handleCancelImageCaption(index)}
                          size="small"
                          title="Cancel"
                        >
                          <Close />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      onClick={() => handleDeleteImage(index)}
                      color="error"
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>
              </Paper>
            ))}
            <Box>
              <input
                accept="image/*"
                style={{ display: "none" }}
                id="image-upload"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <label htmlFor="image-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  size="small"
                  disabled={uploading?.startsWith("image") || false}
                >
                  Upload Image
                </Button>
              </label>
              {uploading?.startsWith("image") && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgress}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* PDFs Section */}
      <Accordion defaultExpanded sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PictureAsPdf sx={{ fontSize: "1.2rem" }} />
            <Typography variant="subtitle2">PDFs</Typography>
            {supportiveData.pdfs && supportiveData.pdfs.length > 0 && (
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", ml: 1 }}
              >
                ({supportiveData.pdfs.length})
              </Typography>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {supportiveData.pdfs?.map((pdf, index) => (
              <Paper key={index} sx={{ p: 2 }}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <PictureAsPdf
                    sx={{ fontSize: "2rem", color: "error.main" }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                    >
                      <TextField
                        label="Title"
                        value={pdf.title || ""}
                        onChange={(e) =>
                          handleUpdatePdfTitle(index, e.target.value)
                        }
                        size="small"
                        fullWidth
                        sx={textFieldStyles}
                      />
                      {hasUnsavedPdfTitle(index) && (
                        <>
                          <IconButton
                            onClick={() => handleSavePdfTitle(index)}
                            color="primary"
                            size="small"
                            title="Save"
                          >
                            <Save />
                          </IconButton>
                          <IconButton
                            onClick={() => handleCancelPdfTitle(index)}
                            size="small"
                            title="Cancel"
                          >
                            <Close />
                          </IconButton>
                        </>
                      )}
                      <IconButton
                        onClick={() => handleDeletePdf(index)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    <Link
                      href={pdf.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ mt: 1, display: "block", fontSize: "0.75rem" }}
                    >
                      {pdf.url}
                    </Link>
                  </Box>
                </Box>
              </Paper>
            ))}
            <Box>
              <input
                accept="application/pdf"
                style={{ display: "none" }}
                id="pdf-upload"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfUpload(file);
                }}
              />
              <label htmlFor="pdf-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  size="small"
                  disabled={uploading?.startsWith("pdf") || false}
                >
                  Upload PDF
                </Button>
              </label>
              {uploading?.startsWith("pdf") && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={uploadProgress}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Text Descriptions Section */}
      <Accordion defaultExpanded sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Description sx={{ fontSize: "1.2rem" }} />
            <Typography variant="subtitle2">Text Descriptions</Typography>
            {supportiveData.textDescriptions &&
              supportiveData.textDescriptions.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", ml: 1 }}
                >
                  ({supportiveData.textDescriptions.length})
                </Typography>
              )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {supportiveData.textDescriptions?.map((desc, index) => (
              <Paper key={index} sx={{ p: 2 }}>
                <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <TextField
                    label="Title"
                    value={desc.title || ""}
                    onChange={(e) =>
                      handleUpdateTextDescription(
                        index,
                        "title",
                        e.target.value
                      )
                    }
                    size="small"
                    sx={{ ...textFieldStyles, flex: 1 }}
                  />
                  {hasUnsavedTextDescription(index) && (
                    <>
                      <IconButton
                        onClick={() => handleSaveTextDescription(index)}
                        color="primary"
                        size="small"
                        title="Save"
                      >
                        <Save />
                      </IconButton>
                      <IconButton
                        onClick={() => handleCancelTextDescription(index)}
                        size="small"
                        title="Cancel"
                      >
                        <Close />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    onClick={() => handleDeleteTextDescription(index)}
                    color="error"
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </Box>
                <TextField
                  label="Description"
                  value={desc.content || ""}
                  onChange={(e) =>
                    handleUpdateTextDescription(
                      index,
                      "content",
                      e.target.value
                    )
                  }
                  multiline
                  rows={3}
                  size="small"
                  fullWidth
                  sx={textFieldStyles}
                />
              </Paper>
            ))}
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddTextDescription}
              size="small"
            >
              Add Text Description
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* External Links Section */}
      <Accordion defaultExpanded sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LinkIcon sx={{ fontSize: "1.2rem" }} />
            <Typography variant="subtitle2">External Links</Typography>
            {supportiveData.externalLinks &&
              supportiveData.externalLinks.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", ml: 1 }}
                >
                  ({supportiveData.externalLinks.length})
                </Typography>
              )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {supportiveData.externalLinks?.map((link, index) => (
              <Paper key={index} sx={{ p: 2 }}>
                <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                  <TextField
                    label="Label"
                    value={link.label || ""}
                    onChange={(e) =>
                      handleUpdateExternalLink(index, "label", e.target.value)
                    }
                    size="small"
                    sx={{ ...textFieldStyles, flex: 1 }}
                  />
                  {hasUnsavedExternalLink(index) && (
                    <>
                      <IconButton
                        onClick={() => handleSaveExternalLink(index)}
                        color="primary"
                        size="small"
                        title="Save"
                      >
                        <Save />
                      </IconButton>
                      <IconButton
                        onClick={() => handleCancelExternalLink(index)}
                        size="small"
                        title="Cancel"
                      >
                        <Close />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    onClick={() => handleDeleteExternalLink(index)}
                    color="error"
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </Box>
                <TextField
                  label="URL"
                  value={link.url || ""}
                  onChange={(e) =>
                    handleUpdateExternalLink(index, "url", e.target.value)
                  }
                  size="small"
                  fullWidth
                  sx={{ ...textFieldStyles, mb: 1 }}
                />
                <TextField
                  label="Description (optional)"
                  value={link.description || ""}
                  onChange={(e) =>
                    handleUpdateExternalLink(
                      index,
                      "description",
                      e.target.value
                    )
                  }
                  size="small"
                  fullWidth
                  sx={textFieldStyles}
                />
              </Paper>
            ))}
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddExternalLink}
              size="small"
            >
              Add External Link
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
