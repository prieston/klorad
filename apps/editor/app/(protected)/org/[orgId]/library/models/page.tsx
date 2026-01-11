"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  Grid,
  alpha,
} from "@mui/material";
import { alpha as muiAlpha } from "@mui/material/styles";
import { SearchIcon } from "@klorad/ui";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Page,
  PageHeader,
  PageDescription,
  PageContent,
  textFieldStyles,
  showToast,
} from "@klorad/ui";
import {
  AnimatedBackground,
  GlowingContainer,
  GlowingSpan,
} from "@/app/components/Builder/AdminLayout.styles";
import type { LibraryAsset, MetadataRow } from "@klorad/ui";
import {
  AssetCard,
  AssetDetailView,
  DeleteConfirmDialog,
  ModelPreviewDialog,
} from "@klorad/ui";
import { UploadModelDrawer } from "./components/UploadModelDrawer";
import { SupportiveDataSection } from "./components/SupportiveDataSection";
import { deleteModel, updateModelMetadata, type Asset } from "@/app/utils/api";
import useModels from "@/app/hooks/useModels";
import { useOrgId } from "@/app/hooks/useOrgId";

const LibraryModelsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = useOrgId();
  const {
    models: fetchedModels,
    loadingModels,
    error: modelsError,
    mutate,
  } = useModels({
    assetType: "model",
  });
  const [models, setModels] = useState<LibraryAsset[]>([]);
  const loading = loadingModels;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<LibraryAsset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedMetadata, setEditedMetadata] = useState<MetadataRow[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [retakePhotoOpen, setRetakePhotoOpen] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);

  // Check for upload query param and open drawer
  useEffect(() => {
    if (searchParams.get("upload") === "true" && !uploadDrawerOpen) {
      setUploadDrawerOpen(true);
      // Remove the query param from URL
      if (orgId) {
        router.replace(`/org/${orgId}/library/models`);
      }
    }
  }, [searchParams, uploadDrawerOpen, router, orgId]);

  // Memoize mapped models to prevent unnecessary re-renders
  const mappedModels = useMemo(() => {
    return fetchedModels
      .filter((model) => model.assetType === "model" || model.assetType === null) // Include null for backwards compatibility
      .map((model) => ({
        id: model.id,
        name: model.name || model.originalFilename || "",
        originalFilename: model.originalFilename,
        fileUrl: model.fileUrl,
        fileType: model.fileType,
        thumbnail: model.thumbnail,
        description: model.description,
        // Preserve full metadata structure (not just string values) to support nested supportiveData
        metadata: model.metadata as Record<string, unknown> | undefined,
        assetType: model.assetType || "model", // Default to "model" if null
        fileSize: model.fileSize ? (typeof model.fileSize === 'bigint' ? Number(model.fileSize) : model.fileSize) : null,
      }));
  }, [fetchedModels]);

  // Use ref to track previous mapped models to avoid unnecessary state updates
  const prevMappedModelsRef = useRef<string>("");

  // Sync fetched models to local state only when content actually changes
  useEffect(() => {
    const currentModelsStr = JSON.stringify(mappedModels);
    if (prevMappedModelsRef.current !== currentModelsStr) {
      prevMappedModelsRef.current = currentModelsStr;
      setModels(mappedModels);
    }
  }, [mappedModels]);

  // Use ref to track previous selectedModel to prevent infinite loops
  const prevSelectedModelRef = useRef<LibraryAsset | null>(null);

  // Sync selectedModel with updated data
  useEffect(() => {
    if (!selectedModel) {
      prevSelectedModelRef.current = null;
      return;
    }

    const updatedModel = models.find((m) => m.id === selectedModel.id);
    if (!updatedModel) {
      return;
    }

    // Only update if the model data actually changed to prevent infinite loops
    const hasChanged =
      updatedModel.name !== selectedModel.name ||
      updatedModel.description !== selectedModel.description ||
      JSON.stringify(updatedModel.metadata) !== JSON.stringify(selectedModel.metadata) ||
      updatedModel.thumbnail !== selectedModel.thumbnail ||
      updatedModel.fileUrl !== selectedModel.fileUrl;

    // Also check if this is the same update we just did (prevent loop)
    const prevModel = prevSelectedModelRef.current;
    const isSameUpdate =
      prevModel &&
      prevModel.id === updatedModel.id &&
      prevModel.name === updatedModel.name &&
      prevModel.description === updatedModel.description &&
      JSON.stringify(prevModel.metadata) === JSON.stringify(updatedModel.metadata);

    if (hasChanged && !isSameUpdate) {
      prevSelectedModelRef.current = updatedModel;
      setSelectedModel(updatedModel);
    }

    if (!isEditing) {
      const newName = updatedModel.name || updatedModel.originalFilename || "";
      const newDescription = updatedModel.description || "";
      // Convert metadata to MetadataRow[], filtering out supportiveData (which is nested)
      const newMetadata: MetadataRow[] = updatedModel.metadata
        ? Object.entries(updatedModel.metadata)
            .filter(([key]) => key !== "supportiveData") // Exclude supportiveData from metadata table
            .map(([label, value]) => ({
              label,
              value: String(value) // Convert to string for metadata table
            }))
        : [];

      // Only update if values actually changed
      if (editedName !== newName) {
        setEditedName(newName);
      }
      if (editedDescription !== newDescription) {
        setEditedDescription(newDescription);
      }
      const currentMetadataStr = JSON.stringify(editedMetadata);
      const newMetadataStr = JSON.stringify(newMetadata);
      if (currentMetadataStr !== newMetadataStr) {
        setEditedMetadata(newMetadata);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, selectedModel?.id, isEditing]);

  // Filter models based on search query
  const filteredModels = models.filter((model) => {
    const name = model.name || model.originalFilename || "";
    const description = model.description || "";
    const query = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query)
    );
  });

  // Handle model selection
  const handleModelClick = (model: LibraryAsset) => {
    prevSelectedModelRef.current = model;
    setSelectedModel(model);
    setIsEditing(false);
    setEditedName(model.name || model.originalFilename || "");
    setEditedDescription(model.description || "");
    // Convert metadata to MetadataRow[], filtering out supportiveData (which is nested)
    const metadataArray: MetadataRow[] = model.metadata
      ? Object.entries(model.metadata)
          .filter(([key]) => key !== "supportiveData") // Exclude supportiveData from metadata table
          .map(([label, value]) => ({
            label,
            value: String(value), // Convert to string for metadata table
          }))
      : [];
    setEditedMetadata(metadataArray);
  };

  // Handle edit
  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (selectedModel) {
      setEditedName(selectedModel.name || selectedModel.originalFilename || "");
      setEditedDescription(selectedModel.description || "");
      if (selectedModel.metadata) {
        // Convert metadata object to array, filtering out supportiveData (nested structure)
        const metadataArray: MetadataRow[] = Object.entries(selectedModel.metadata)
          .filter(([key]) => key !== "supportiveData") // Exclude supportiveData from metadata table
          .map(([label, value]) => ({
            label,
            value: String(value), // Convert to string for metadata table
          }));
        setEditedMetadata(metadataArray);
      }
    }
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    if (!selectedModel) return;

    try {
      const metadataObject = editedMetadata.reduce(
        (acc, row) => {
          if (row.label && row.value) {
            acc[row.label] = row.value;
          }
          return acc;
        },
        {} as Record<string, unknown>
      );

      // Preserve supportiveData if it exists in the original metadata
      const originalMetadata = selectedModel.metadata as Record<string, unknown> | undefined;
      if (originalMetadata?.supportiveData) {
        metadataObject.supportiveData = originalMetadata.supportiveData;
      }

      await updateModelMetadata(selectedModel.id, {
        name: editedName,
        description: editedDescription,
        metadata: metadataObject,
      });
      showToast("Model updated successfully", "success");
      mutate(); // Refresh models from SWR
      setIsEditing(false);
    } catch (error) {
      console.error("Update error:", error);
      showToast("An error occurred while updating model", "error");
    }
  };

  // Handle delete
  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedModel) return;

    try {
      await deleteModel(selectedModel.id);
      showToast("Model deleted successfully", "success");
      mutate(); // Refresh models from SWR
      prevSelectedModelRef.current = null;
      setSelectedModel(null);
    } catch (error) {
      console.error("Delete error:", error);
      showToast("An error occurred during deletion", "error");
    }
    setDeleteConfirmOpen(false);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
  };

  // Handle retake photo
  const handleRetakePhoto = () => {
    setRetakePhotoOpen(true);
  };

  const handleCaptureScreenshot = async (screenshot: string) => {
    if (!selectedModel) return;

    try {
      await updateModelMetadata(selectedModel.id, {
        thumbnail: screenshot,
      });
      showToast("Thumbnail updated successfully", "success");
      mutate(); // Refresh models from SWR
    } catch (error) {
      console.error("Thumbnail update error:", error);
      showToast("An error occurred while updating thumbnail", "error");
    }
  };

  // Handle upload
  const handleUploadSuccess = () => {
    mutate();
    setUploadDrawerOpen(false);
  };

  return (
    <>
      {/* Animated background */}
      <AnimatedBackground>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
        <GlowingContainer>
          <GlowingSpan index={1} />
          <GlowingSpan index={2} />
          <GlowingSpan index={3} />
        </GlowingContainer>
      </AnimatedBackground>

      <Page>
        <PageHeader title="Models" />
        <PageDescription>
          Manage your 3D models library. Upload, organize, and view your assets.
        </PageDescription>

        <PageContent maxWidth="6xl">
          {/* Search Toolbar */}
          <Box
            sx={(theme) => ({
              display: "flex",
              gap: 2,
              mb: 3,
              pb: 3,
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${theme.palette.divider}`,
            })}
          >
            <Box
              sx={{ display: "flex", gap: 2, alignItems: "center", flex: 1 }}
            >
              <TextField
                placeholder="Search models..."
                size="small"
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={(theme) => ({
                  maxWidth: "400px",
                  ...((typeof textFieldStyles === "function"
                    ? textFieldStyles(theme)
                    : textFieldStyles) as Record<string, unknown>),
                })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        sx={(theme) => ({
                          color: theme.palette.text.secondary,
                        })}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Button
              variant="contained"
              onClick={() => setUploadDrawerOpen(true)}
              size="small"
              sx={(theme) => ({
                borderRadius: `${theme.shape.borderRadius}px`,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "#161B20"
                    : theme.palette.background.paper,
                color: theme.palette.primary.main,
                border: `1px solid ${muiAlpha(theme.palette.primary.main, 0.3)}`,
                padding: "6px 16px",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : muiAlpha(theme.palette.primary.main, 0.05),
                  borderColor: muiAlpha(theme.palette.primary.main, 0.5),
                },
              })}
            >
              + Upload Model
            </Button>
          </Box>

          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "400px",
              }}
            >
              <CircularProgress />
            </Box>
          ) : modelsError ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "400px",
                color: "error.main",
              }}
            >
              <Box sx={{ fontSize: "0.875rem", mb: 1 }}>
                Error loading models
              </Box>
              <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {modelsError instanceof Error ? modelsError.message : "Unknown error"}
              </Box>
              <Button
                variant="outlined"
                onClick={() => mutate()}
                sx={{ mt: 2 }}
              >
                Retry
              </Button>
            </Box>
          ) : (
            <Box
              sx={{ display: "flex", gap: 3, height: "calc(100vh - 300px)" }}
            >
              {/* Left Column - Model Cards */}
              <Box
                sx={(theme) => ({
                  flex: "0 0 40%",
                  overflowY: "auto",
                  paddingRight: 1,
                  "&::-webkit-scrollbar": {
                    width: "8px",
                  },
                  "&::-webkit-scrollbar-track": {
                    background:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.primary.main, 0.08)
                        : "rgba(95, 136, 199, 0.05)",
                    borderRadius: "4px",
                    margin: "4px 0",
                  },
                  "&::-webkit-scrollbar-thumb": {
                    background:
                      theme.palette.mode === "dark"
                        ? alpha(theme.palette.primary.main, 0.24)
                        : "rgba(95, 136, 199, 0.2)",
                    borderRadius: "4px",
                    border: "2px solid transparent",
                    backgroundClip: "padding-box",
                    transition: "background 0.2s ease",
                    "&:hover": {
                      background:
                        theme.palette.mode === "dark"
                          ? alpha(theme.palette.primary.main, 0.38)
                          : "rgba(95, 136, 199, 0.35)",
                      backgroundClip: "padding-box",
                    },
                  },
                })}
              >
                {filteredModels.length === 0 ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "rgba(100, 116, 139, 0.6)",
                    }}
                  >
                    <Box sx={{ textAlign: "center" }}>
                      {searchQuery ? (
                        <>
                          <Box sx={{ fontSize: "0.875rem", mb: 1 }}>
                            No models found matching &quot;{searchQuery}&quot;
                          </Box>
                          <Box sx={{ fontSize: "0.75rem" }}>
                            Try a different search term
                          </Box>
                        </>
                      ) : (
                        <>
                          <Box sx={{ fontSize: "0.875rem", mb: 1 }}>
                            Your library is empty.
                          </Box>
                          <Box sx={{ fontSize: "0.75rem" }}>
                            Upload a model to get started!
                          </Box>
                        </>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Grid container spacing={1.5}>
                    {filteredModels.map((model) => (
                      <Grid item xs={4} key={model.id}>
                        <AssetCard
                          asset={model}
                          isSelected={selectedModel?.id === model.id}
                          onClick={() => handleModelClick(model)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>

              {/* Right Column - Model Details */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
                  pl: 3,
                }}
              >
                {selectedModel ? (
                  <AssetDetailView
                    asset={selectedModel}
                    isEditing={isEditing}
                    editedName={editedName}
                    editedDescription={editedDescription}
                    editedMetadata={editedMetadata}
                    onNameChange={setEditedName}
                    onDescriptionChange={setEditedDescription}
                    onMetadataChange={setEditedMetadata}
                    onEditClick={handleEditClick}
                    onCancelEdit={handleCancelEdit}
                    onSaveChanges={handleSaveChanges}
                    onDeleteClick={handleDeleteClick}
                    onAddToScene={() => {
                      // Not needed in models page, but required by component
                    }}
                    onRetakePhoto={handleRetakePhoto}
                    canUpdate={true}
                    showAddToScene={false}
                    renderAfterMetadata={
                      <SupportiveDataSection
                        asset={{
                          ...selectedModel,
                          organizationId: orgId || "",
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        } as Asset}
                        onUpdate={mutate}
                      />
                    }
                  />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "rgba(100, 116, 139, 0.6)",
                    }}
                  >
                    <Box sx={{ textAlign: "center" }}>
                      <Box sx={{ fontSize: "0.875rem", mb: 1 }}>
                        Select a model to view details
                      </Box>
                      <Box sx={{ fontSize: "0.75rem" }}>
                        Click on a model card to see its information
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </PageContent>
      </Page>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        assetName={selectedModel?.name || selectedModel?.originalFilename}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Model Preview Dialog for Retaking Photo */}
      {selectedModel && (
        <ModelPreviewDialog
          open={retakePhotoOpen}
          onClose={() => setRetakePhotoOpen(false)}
          modelUrl={selectedModel.fileUrl}
          modelName={
            selectedModel.name || selectedModel.originalFilename || "Model"
          }
          onCapture={handleCaptureScreenshot}
        />
      )}

      {/* Upload Model Drawer */}
      <UploadModelDrawer
        open={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
};

export default LibraryModelsPage;
