"use client";

import React, { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrgId } from "@/app/hooks/useOrgId";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
  Avatar,
  Stack,
  IconButton,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ArrowBackIcon,
  OpenInNewIcon,
  PublicIcon,
  LockIcon,
  PersonIcon,
  CalendarTodayIcon,
  EditIcon,
  LocationOnIcon,
  MemoryIcon,
  ImageIcon,
  VideoLibraryIcon,
  DescriptionIcon,
  HistoryIcon,
  PhotoCameraIcon,
  DeleteIcon,
} from "@klorad/ui";
import useSWR from "swr";
import { projectFetcher, getThumbnailUploadUrl, uploadToSignedUrl, updateProjectThumbnail, updateProjectPublishSettings } from "@/app/utils/api";
import { showToast } from "@klorad/ui";
import {
  Page,
  PageHeader,
  PageDescription,
  PageContent,
} from "@klorad/ui";
import {
  AnimatedBackground,
  GlowingContainer,
  GlowingSpan,
} from "@/app/components/Builder/AdminLayout.styles";

interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  engine: "three" | "cesium" | "mapbox";
  organizationId: string;
  sceneData: unknown;
  isPublished: boolean;
  isPublic: boolean;
  publishedUrl: string | null;
  thumbnail: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  organization?: {
    id: string;
    name: string;
    isPersonal: boolean;
    members: Array<{
      id: string;
      role: string;
      user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
    }>;
  };
  assets?: Array<{
    id: string;
    name: string | null;
    fileType: string;
    thumbnail: string | null;
    fileUrl: string;
    createdAt: Date | string;
  }>;
  activities?: Array<{
    id: string;
    action: string;
    entityType: string;
    message: string | null;
    createdAt: Date | string;
    actor: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
}

const ProjectDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const orgId = useOrgId();
  const projectId = params?.projectId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const { data: project, error, isLoading, mutate } = useSWR<ProjectDetail>(
    projectId ? `/api/projects/${projectId}` : null,
    projectFetcher as (url: string) => Promise<ProjectDetail>,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLocationFromSceneData = () => {
    if (!project?.sceneData || typeof project.sceneData !== "object") {
      return null;
    }
    const sceneData = project.sceneData as {
      selectedLocation?: { latitude?: number; longitude?: number };
    };
    if (
      sceneData.selectedLocation?.latitude &&
      sceneData.selectedLocation?.longitude
    ) {
      return {
        lat: sceneData.selectedLocation.latitude,
        lng: sceneData.selectedLocation.longitude,
      };
    }
    return null;
  };

  const getThumbnailFromAssets = () => {
    if (!project?.assets || project.assets.length === 0) return null;
    // Look for image assets first
    const imageAsset = project.assets.find(
      (asset) =>
        asset.thumbnail ||
        asset.fileType?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    return imageAsset?.thumbnail || imageAsset?.fileUrl || null;
  };

  const handlePublishToggle = async (checked: boolean) => {
    if (!project) return;
    try {
      await updateProjectPublishSettings(project.id, {
        isPublished: checked,
      });
      mutate();
      showToast(
        checked ? "Project published successfully" : "Project unpublished successfully",
        "success"
      );
    } catch (error) {
      console.error("Error updating publish status:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to update publish status",
        "error"
      );
    }
  };

  const handlePublicToggle = async (checked: boolean) => {
    if (!project) return;
    // For personal organizations, this should not be changeable
    if (project.organization?.isPersonal) {
      showToast("Personal organizations always have public access", "info");
      return;
    }
    try {
      await updateProjectPublishSettings(project.id, {
        isPublic: checked,
      });
      mutate();
      showToast(
        checked ? "Project is now publicly accessible" : "Project is now private",
        "success"
      );
    } catch (error) {
      console.error("Error updating public access:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to update access setting",
        "error"
      );
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!project) return;

    setUploadingThumbnail(true);
    try {
      // Get presigned URL for thumbnail
      const { signedUrl, acl } = await getThumbnailUploadUrl({
        fileName: `project-thumbnails/${projectId}-${Date.now()}.${file.name.split('.').pop()}`,
        fileType: file.type || "image/jpeg",
      });

      // Upload thumbnail to S3
      await uploadToSignedUrl(signedUrl, file, {
        contentType: file.type || "image/jpeg",
        acl,
      });

      // Extract thumbnail URL from signed URL (remove query parameters)
      const thumbnailUrl = signedUrl.split("?")[0];

      // Update project with thumbnail URL and size
      await updateProjectThumbnail(projectId, thumbnailUrl, file.size);

      // Refresh project data
      mutate();

      showToast("Thumbnail uploaded successfully", "success");
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to upload thumbnail",
        "error"
      );
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleThumbnailDelete = async () => {
    if (!project) return;

    setUploadingThumbnail(true);
    try {
      await updateProjectThumbnail(projectId, null);
      mutate();
      showToast("Thumbnail removed successfully", "success");
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to remove thumbnail",
        "error"
      );
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file", "error");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image size must be less than 5MB", "error");
        return;
      }
      handleThumbnailUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const location = getLocationFromSceneData();
  // Use project thumbnail first, then fallback to assets
  const thumbnail = project?.thumbnail || getThumbnailFromAssets();
  const screenshots = project?.assets?.filter((asset) =>
    asset.fileType?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  );
  const videos = project?.assets?.filter((asset) =>
    asset.fileType?.match(/\.(mp4|webm|mov|avi)$/i)
  );

  if (isLoading) {
    return (
      <>
        <AnimatedBackground>
          <GlowingContainer>
            <GlowingSpan index={1} />
            <GlowingSpan index={2} />
            <GlowingSpan index={3} />
          </GlowingContainer>
        </AnimatedBackground>
        <Page>
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
        </Page>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <AnimatedBackground>
          <GlowingContainer>
            <GlowingSpan index={1} />
            <GlowingSpan index={2} />
            <GlowingSpan index={3} />
          </GlowingContainer>
        </AnimatedBackground>
        <Page>
          <PageHeader title="Project Not Found" />
          <PageDescription>
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have
            access to it.
          </PageDescription>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              if (orgId) {
                router.push(`/org/${orgId}/projects`);
              }
            }}
            sx={{ mt: 2 }}
          >
            Back to Projects
          </Button>
        </Page>
      </>
    );
  }

  return (
    <>
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
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => {
              if (orgId) {
                router.push(`/org/${orgId}/projects`);
              }
            }}
              sx={{
                mb: 2,
                color: "rgba(255, 255, 255, 0.6)",
                "&:hover": {
                  color: "rgba(255, 255, 255, 0.9)",
                },
              }}
            >
              Back to Projects
            </Button>
            <PageHeader title={project.title} />
            {project.description && (
              <PageDescription>{project.description}</PageDescription>
            )}
          </Box>
          <Button
            variant="contained"
              startIcon={<OpenInNewIcon />}
            onClick={() => {
              if (orgId) {
                window.open(`/org/${orgId}/projects/${projectId}/builder`, '_blank');
              } else {
                window.open(`/projects/${projectId}/builder`, '_blank');
              }
            }}
            sx={(theme) => ({
              borderRadius: `${theme.shape.borderRadius}px`,
              textTransform: "none",
              fontWeight: 500,
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#161B20"
                  : theme.palette.background.paper,
              color: theme.palette.primary.main,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              padding: "8px 20px",
              boxShadow: "none",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "#1a1f26"
                    : alpha(theme.palette.primary.main, 0.05),
                borderColor: alpha(theme.palette.primary.main, 0.5),
              },
            })}
          >
            Open Studio
          </Button>
        </Box>

        <PageContent maxWidth="6xl">
          <Grid container spacing={3}>
            {/* Left Column - Main Info */}
            <Grid item xs={12} md={8}>
              {/* Project Thumbnail */}
              <Card
                elevation={0}
                sx={(_theme) => ({
                  mb: 3,
                  backgroundColor: "#161B20",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  boxShadow: "none",
                  "&.MuiPaper-root": {
                    backgroundColor: "#161B20",
                    boxShadow: "none",
                  },
                })}
              >
                <Box
                  sx={{
                    width: "100%",
                    height: "400px",
                    backgroundColor: "rgba(107, 156, 216, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {uploadingThumbnail ? (
                    <CircularProgress />
                  ) : thumbnail ? (
                    <Box
                      component="img"
                      src={thumbnail}
                      alt={project.title}
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <ImageIcon
                      sx={{ fontSize: 64, color: "#6B9CD8", opacity: 0.5 }}
                    />
                  )}
                  {/* Upload/Delete buttons overlay */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      display: "flex",
                      gap: 1,
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleFileSelect}
                    />
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingThumbnail}
                      sx={{
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        color: "white",
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.8)",
                        },
                      }}
                      size="small"
                    >
                      <PhotoCameraIcon fontSize="small" />
                    </IconButton>
                    {project?.thumbnail && (
                      <IconButton
                        onClick={handleThumbnailDelete}
                        disabled={uploadingThumbnail}
                        sx={{
                          backgroundColor: "rgba(0, 0, 0, 0.6)",
                          color: "white",
                          "&:hover": {
                            backgroundColor: "rgba(220, 38, 38, 0.8)",
                          },
                        }}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Card>

              {/* Project Information */}
              <Card
                elevation={0}
                sx={(_theme) => ({
                  mb: 3,
                  backgroundColor: "#161B20",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  boxShadow: "none",
                  "&.MuiPaper-root": {
                    backgroundColor: "#161B20",
                    boxShadow: "none",
                  },
                })}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, fontWeight: 600, fontSize: "1rem" }}
                  >
                    Project Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                        <CalendarTodayIcon
                          sx={{ fontSize: 18, mr: 1, color: "rgba(255, 255, 255, 0.5)" }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Created
                        </Typography>
                      </Box>
                      <Typography variant="body1">
                        {formatDate(project.createdAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                        <EditIcon
                          sx={{ fontSize: 18, mr: 1, color: "rgba(255, 255, 255, 0.5)" }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Last Edited
                        </Typography>
                      </Box>
                      <Typography variant="body1">
                        {formatDate(project.updatedAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                        <MemoryIcon
                          sx={{ fontSize: 18, mr: 1, color: "rgba(255, 255, 255, 0.5)" }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Engine
                        </Typography>
                      </Box>
                      <Chip
                        label={
                          project.engine === "cesium"
                            ? "Cesium"
                            : project.engine === "mapbox"
                              ? "Mapbox"
                              : "Three.js"
                        }
                        size="small"
                        sx={{
                          backgroundColor:
                            project.engine === "cesium"
                              ? "rgba(99, 102, 241, 0.15)"
                              : project.engine === "mapbox"
                                ? "rgba(14, 165, 233, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                          color:
                            project.engine === "cesium"
                              ? "#6366f1"
                              : project.engine === "mapbox"
                                ? "#0ea5e9"
                                : "#f59e0b",
                          border: `1px solid ${
                            project.engine === "cesium"
                              ? "rgba(99, 102, 241, 0.4)"
                              : project.engine === "mapbox"
                                ? "rgba(14, 165, 233, 0.4)"
                                : "rgba(245, 158, 11, 0.4)"
                          }`,
                        }}
                      />
                    </Grid>
                    {location && (
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                          <LocationOnIcon
                            sx={{ fontSize: 18, mr: 1, color: "rgba(255, 255, 255, 0.5)" }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            Location
                          </Typography>
                        </Box>
                        <Typography variant="body1">
                          {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card
                elevation={0}
                sx={(_theme) => ({
                  mb: 3,
                  backgroundColor: "#161B20",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  boxShadow: "none",
                  "&.MuiPaper-root": {
                    backgroundColor: "#161B20",
                    boxShadow: "none",
                  },
                })}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <HistoryIcon
                      sx={{ fontSize: 20, mr: 1, color: "rgba(255, 255, 255, 0.7)" }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
                      Recent Activity
                    </Typography>
                  </Box>
                  {project.activities && project.activities.length > 0 ? (
                    <Stack spacing={2}>
                      {project.activities.map((activity) => (
                        <Box
                          key={activity.id}
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            pb: 2,
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                            "&:last-child": { borderBottom: "none", pb: 0 },
                          }}
                        >
                          <Avatar
                            src={activity.actor.image || undefined}
                            sx={{ width: 32, height: 32, mr: 1.5 }}
                          >
                            {activity.actor.name?.[0] || activity.actor.email?.[0] || "?"}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ mb: 0.5 }}>
                              <strong>
                                {activity.actor.name ||
                                  activity.actor.email ||
                                  "Unknown User"}
                              </strong>{" "}
                              {activity.message ||
                                `${activity.action.toLowerCase()} ${activity.entityType.toLowerCase()}`}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {formatDate(activity.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No recent activity
                    </Typography>
                  )}
                </CardContent>
              </Card>

              {/* Screenshots */}
              {screenshots && screenshots.length > 0 && (
                <Card
                  sx={(_theme) => ({
                    mb: 3,
                    backgroundColor: "#161B20",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "4px",
                  })}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <ImageIcon
                        sx={{ fontSize: 20, mr: 1, color: "rgba(255, 255, 255, 0.7)" }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
                        Screenshots
                      </Typography>
                    </Box>
                    <Grid container spacing={2}>
                      {screenshots.map((screenshot) => (
                        <Grid item xs={6} sm={4} key={screenshot.id}>
                          <Box
                            component="img"
                            src={screenshot.thumbnail || screenshot.fileUrl}
                            alt={screenshot.name || "Screenshot"}
                            sx={{
                              width: "100%",
                              height: "150px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              cursor: "pointer",
                              "&:hover": {
                                opacity: 0.8,
                              },
                            }}
                            onClick={() => window.open(screenshot.fileUrl, "_blank")}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Videos */}
              {videos && videos.length > 0 && (
                <Card
                  sx={(_theme) => ({
                    mb: 3,
                    backgroundColor: "#161B20",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "4px",
                  })}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <VideoLibraryIcon
                        sx={{ fontSize: 20, mr: 1, color: "rgba(255, 255, 255, 0.7)" }}
                      />
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
                        Videos
                      </Typography>
                    </Box>
                    <Grid container spacing={2}>
                      {videos.map((video) => (
                        <Grid item xs={12} sm={6} key={video.id}>
                          <Box
                            component="video"
                            src={video.fileUrl}
                            controls
                            sx={{
                              width: "100%",
                              borderRadius: "4px",
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Reports Placeholder */}
              <Card
                elevation={0}
                sx={(_theme) => ({
                  mb: 3,
                  backgroundColor: "#161B20",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  boxShadow: "none",
                  "&.MuiPaper-root": {
                    backgroundColor: "#161B20",
                    boxShadow: "none",
                  },
                })}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <DescriptionIcon
                      sx={{ fontSize: 20, mr: 1, color: "rgba(255, 255, 255, 0.7)" }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
                      Reports
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Reports feature coming soon
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Right Column - Sidebar */}
            <Grid item xs={12} md={4}>
              {/* Publish Settings */}
              <Card
                elevation={0}
                sx={(_theme) => ({
                  mb: 3,
                  backgroundColor: "#161B20",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  boxShadow: "none",
                  "&.MuiPaper-root": {
                    backgroundColor: "#161B20",
                    boxShadow: "none",
                  },
                })}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, fontWeight: 600, fontSize: "1rem" }}
                  >
                    Publish Settings
                  </Typography>
                  <Stack spacing={3}>
                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={project.isPublished}
                            onChange={(e) => handlePublishToggle(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            {project.isPublished ? (
                              <PublicIcon sx={{ fontSize: 18, color: "#10b981" }} />
                            ) : (
                              <LockIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.5)" }} />
                            )}
                            <Typography variant="body2">
                              {project.isPublished ? "Published" : "Unpublished"}
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: 0.5, display: "block" }}>
                        {project.isPublished
                          ? "Your project is live and accessible"
                          : "Your project is not published"}
                      </Typography>
                    </Box>
                    {project.isPublished && project.publishedUrl && (
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Published URL
                        </Typography>
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon />}
                          onClick={() => window.open(project.publishedUrl || "", "_blank")}
                          sx={{ textTransform: "none" }}
                        >
                          View Published Project
                        </Button>
                      </Box>
                    )}
                    {project.isPublished && (
                      <Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={project.isPublic}
                              onChange={(e) => handlePublicToggle(e.target.checked)}
                              disabled={project.organization?.isPersonal}
                              color="primary"
                            />
                          }
                          label={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {project.isPublic ? (
                                <PublicIcon sx={{ fontSize: 18, color: "#10b981" }} />
                              ) : (
                                <LockIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.5)" }} />
                              )}
                              <Typography variant="body2">
                                {project.isPublic ? "Public Access" : "Private Access"}
                              </Typography>
                            </Box>
                          }
                          sx={{ m: 0 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mt: 0.5, display: "block" }}>
                          {project.organization?.isPersonal
                            ? "Personal organizations always have public access"
                            : project.isPublic
                            ? "Anyone can view this published world"
                            : "Only organization members can view this published world"}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Team Members */}
              <Card
                elevation={0}
                sx={(_theme) => ({
                  mb: 3,
                  backgroundColor: "#161B20",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "4px",
                  boxShadow: "none",
                  "&.MuiPaper-root": {
                    backgroundColor: "#161B20",
                    boxShadow: "none",
                  },
                })}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <PersonIcon
                      sx={{ fontSize: 20, mr: 1, color: "rgba(255, 255, 255, 0.7)" }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
                      Team Members
                    </Typography>
                  </Box>
                  {project.organization?.members &&
                  project.organization.members.length > 0 ? (
                    <Stack spacing={2}>
                      {project.organization.members.map((member) => (
                        <Box
                          key={member.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            pb: 2,
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                            "&:last-child": { borderBottom: "none", pb: 0 },
                          }}
                        >
                          <Avatar
                            src={member.user.image || undefined}
                            sx={{ width: 40, height: 40, mr: 1.5 }}
                          >
                            {member.user.name?.[0] ||
                              member.user.email?.[0] ||
                              "?"}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {member.user.name || member.user.email || "Unknown User"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No team members found
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </PageContent>
      </Page>
    </>
  );
};

export default ProjectDetailPage;

