import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject } from "@/app/utils/api";
import useProjects from "@/app/hooks/useProjects";
import { useOrgId } from "@/app/hooks/useOrgId";
import type { KeyedMutator } from "swr";
import type { Project } from "@/app/utils/api";

interface UseProjectFormProps {
  projects: Array<{ id: string; title: string; description?: string; engine?: string }>;
  setProjects: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; title: string; description?: string; engine?: string }>
    >
  > | KeyedMutator<Project[]>;
}

export const useProjectForm = ({ projects, setProjects: _setProjects }: UseProjectFormProps) => {
  const router = useRouter();
  const orgId = useOrgId();
  const { setProjects: mutate } = useProjects();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [engine, setEngine] = useState<"cesium" | "three">("cesium");
  const [saving, setSaving] = useState(false);

  const handleCreateProject = useCallback(() => {
    setEditingProjectId(null);
    setTitle("");
    setDescription("");
    setEngine("cesium");
    setDrawerOpen(true);
  }, []);

  const handleEditProject = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setEditingProjectId(projectId);
        setTitle(project.title || "");
        setDescription(project.description || "");
        setEngine((project.engine as "cesium" | "three") || "cesium");
        setDrawerOpen(true);
      }
    },
    [projects]
  );

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setEditingProjectId(null);
    setTitle("");
    setDescription("");
    setEngine("cesium");
  }, []);

  const handleSaveProject = useCallback(async () => {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const isEditing = !!editingProjectId;

      if (isEditing) {
        await updateProject(editingProjectId, {
          title: title.trim(),
          description: description.trim(),
          engine: engine as "three" | "cesium",
        });
        // Refresh projects list from SWR
        mutate();
      } else {
        // Create new project
        if (!orgId) {
          throw new Error("Organization ID is required");
        }
        const response = await createProject({
          title: title.trim(),
          description: description.trim(),
          engine: engine as "three" | "cesium",
          organizationId: orgId,
        });
        // Refresh projects list from SWR
        mutate();
        // Navigate to the builder for new projects
        if (orgId) {
          router.push(`/org/${orgId}/projects/${response.project.id}/builder`);
        }
      }

      // Close drawer and reset form
      handleCloseDrawer();
    } catch (error) {
      console.error("Error saving project:", error);
      // TODO: Show error toast
    } finally {
      setSaving(false);
    }
  }, [title, description, engine, editingProjectId, mutate, router, handleCloseDrawer]);

  return {
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
  };
};

