import { useCallback, useEffect, useState } from "react";
import { api } from "../services/mockApi";

export function useTasklane() {
  const [projects, setProjects] = useState([]); const [project, setProject] = useState(null); const [isLoading, setLoading] = useState(true);
  const refreshProjects = useCallback(async () => setProjects(await api.listProjects()), []);
  const openProject = useCallback(async (projectId) => { setLoading(true); setProject(await api.getBoard(projectId)); setLoading(false); }, []);
  const refreshBoard = useCallback(async () => { if (project) setProject(await api.getBoard(project.id)); await refreshProjects(); }, [project, refreshProjects]);
  const showProjects = useCallback(() => { setProject(null); refreshProjects(); }, [refreshProjects]);
  const createProject = useCallback(async (details) => { const created = await api.createProject(details); await refreshProjects(); return created; }, [refreshProjects]);
  useEffect(() => { refreshProjects().finally(() => setLoading(false)); }, [refreshProjects]);
  return { projects, project, isLoading, openProject, refreshBoard, showProjects, createProject };
}
