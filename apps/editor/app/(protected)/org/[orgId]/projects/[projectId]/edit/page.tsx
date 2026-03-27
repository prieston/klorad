"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
} from "@mui/material";
import { useParams, useRouter } from "next/navigation";
// eslint-disable-next-line import/extensions
import AdminAppBar from "@/app/components/AppBar/AdminAppBar";
import { showToast } from "@klorad/ui";
import { ToastContainer } from "react-toastify";
import useProject from "@/app/hooks/useProject";
import { updateProject } from "@/app/utils/api";
import { useOrgId } from "@/app/hooks/useOrgId";

const EditProjectPage = () => {
  const { projectId } = useParams();
  const projectIdStr = Array.isArray(projectId) ? projectId[0] : (projectId || "");
  const router = useRouter();
  const orgId = useOrgId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [engine, setEngine] = useState<"three" | "cesium" | "mapbox">("three");
  const { project, loadingProject } = useProject(projectIdStr);

  // Sync project data to form when it loads
  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setDescription(project.description || "");
      setEngine(project.engine);
    }
  }, [project]);

  const loading = loadingProject;

  // Handler to save updated project details
  const handleSave = async () => {
    try {
      await updateProject(projectIdStr, { title, description, engine });
      showToast("Project saved successfully!");
      if (orgId) {
        router.push(`/org/${orgId}/dashboard`);
      }
    } catch (error) {
      console.error("Error saving project details:", error);
      showToast(error.message || "Error saving project");
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AdminAppBar mode="simple" />
      <Box sx={{ padding: 3, marginTop: "64px" }}>
        <Typography variant="h5" gutterBottom>
          Edit Project
        </Typography>
        <Box
          component="form"
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TextField
            id="project-title"
            name="project-title"
            label="Project Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
          />
          <TextField
            id="project-description"
            name="project-description"
            label="Project Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={4}
          />
          <Button variant="contained" onClick={handleSave}>
            Save Changes
          </Button>
        </Box>
      </Box>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        theme="dark"
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
      />
    </>
  );
};

export default EditProjectPage;
