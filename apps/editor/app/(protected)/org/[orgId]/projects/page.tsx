"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { SearchIcon } from "@klorad/ui";
import { useRouter, useSearchParams } from "next/navigation";
import useProjects from "@/app/hooks/useProjects";
import { deleteProject } from "@/app/utils/api";
import { useOrgId } from "@/app/hooks/useOrgId";
import {
  DashboardProjectCard as ProjectCard,
  DashboardOptionsMenu as OptionsMenu,
  DashboardDeleteConfirmationDialog as DeleteConfirmationDialog,
  Page,
  PageHeader,
  PageDescription,
  PageContent,
  textFieldStyles,
} from "@klorad/ui";
import {
  AnimatedBackground,
  GlowingContainer,
  GlowingSpan,
} from "@/app/components/Builder/AdminLayout.styles";
import { CreateProjectDrawer } from "./components/CreateProjectDrawer";
import { useProjectForm } from "./hooks/useProjectForm";

const ProjectsPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = useOrgId();
  const [searchQuery, setSearchQuery] = useState("");
  const { projects, setProjects, loadingProjects } = useProjects({
    search: searchQuery,
  });
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const {
    drawerOpen,
    editingProjectId,
    title,
    description,
    engine,
    saving,
    setTitle,
    setDescription,
    setEngine,
    handleCreateProject,
    handleEditProject,
    handleCloseDrawer,
    handleSaveProject,
  } = useProjectForm({ projects, setProjects });

  // Check for create query param and open drawer
  useEffect(() => {
    if (searchParams.get("create") === "true" && !drawerOpen) {
      handleCreateProject();
      // Remove the query param from URL
      if (orgId) {
        router.replace(`/org/${orgId}/projects`);
      }
    }
  }, [searchParams, drawerOpen, handleCreateProject, router, orgId]);

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(selectedProjectId === projectId ? null : projectId);
  };

  const handleGoToProject = (projectId) => {
    if (orgId) {
      router.push(`/org/${orgId}/projects/${projectId}`);
    }
  };

  // --- Options Menu State ---
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuProjectId, setMenuProjectId] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuOpen = (event, projectId) => {
    setMenuProjectId(projectId);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // --- Delete Confirmation Dialog State ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const handleDeleteClick = (projectId) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    try {
      await deleteProject(projectToDelete);

      // Optimistically update the projects list
      setProjects((prevProjects) =>
        prevProjects.filter((p) => p.id !== projectToDelete)
      );

      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project. Please try again.");
    }
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
        <PageHeader title="Projects" />
        <PageDescription>
          Your 3D environments, scenes, and digital twins in one place.
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
                placeholder="Search projects..."
                size="small"
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={(theme) => ({
                  maxWidth: "400px",
                  ...((typeof textFieldStyles === "function"
                    ? textFieldStyles(theme)
                    : textFieldStyles) as Record<string, any>),
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
              onClick={handleCreateProject}
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
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                padding: "6px 16px",
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
              + New Project
            </Button>
          </Box>

          {loadingProjects ? (
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
          ) : projects.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "400px",
                color: "rgba(100, 116, 139, 0.6)",
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                {searchQuery ? (
                  <>
                    <Box sx={{ fontSize: "0.875rem", mb: 1 }}>
                      No projects found matching &quot;{searchQuery}&quot;
                    </Box>
                    <Box sx={{ fontSize: "0.75rem" }}>
                      Try a different search term
                    </Box>
                  </>
                ) : (
                  <>
                    <Box sx={{ fontSize: "0.875rem", mb: 1 }}>
                      No projects yet.
                    </Box>
                    <Box sx={{ fontSize: "0.75rem" }}>
                      Create your first project to get started!
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                gap: 3,
              }}
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onGoToBuilder={() => handleGoToProject(project.id)}
                  onMenuOpen={(event) => handleMenuOpen(event, project.id)}
                  selected={selectedProjectId === project.id}
                  onSelect={() => handleProjectSelect(project.id)}
                />
              ))}
            </Box>
          )}
        </PageContent>

        {/* Options Menu */}
        <OptionsMenu
          anchorEl={anchorEl}
          open={openMenu}
          onClose={handleMenuClose}
          onEdit={() => {
            if (menuProjectId) {
              handleEditProject(menuProjectId);
            }
            handleMenuClose();
          }}
          onDelete={() => handleDeleteClick(menuProjectId)}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Delete Project"
          message={`Are you sure you want to delete "${
            projects.find((p) => p.id === projectToDelete)?.title ||
            "this project"
          }"? This action cannot be undone.`}
        />
      </Page>

      {/* Create Project Drawer */}
      <CreateProjectDrawer
        open={drawerOpen}
        editingProjectId={editingProjectId}
        title={title}
        description={description}
        engine={engine}
        saving={saving}
        onClose={handleCloseDrawer}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onEngineChange={setEngine}
        onSave={handleSaveProject}
      />
    </>
  );
};

export default ProjectsPage;
