import { useCallback, useEffect, useState } from "react";
import { api } from "../services/mockApi";

export function useTasklane() {
  const [projects, setProjects] = useState([]); const [project, setProject] = useState(null); const [isLoading, setLoading] = useState(true); const [error, setError] = useState(null);
  const refreshProjects = useCallback(async () => { try { setProjects(await api.listProjects()); } catch (requestError) { setError("Could not load projects. Please try again."); throw requestError; } }, []);
  const openProject = useCallback(async (projectId) => { setLoading(true); setError(null); try { setProject(await api.getBoard(projectId)); } catch (requestError) { setError("Could not open this board. Please try again."); } finally { setLoading(false); } }, []);
  const refreshBoard = useCallback(async () => { if (project) setProject(await api.getBoard(project.id)); await refreshProjects(); }, [project, refreshProjects]);
  const showProjects = useCallback(() => { setProject(null); refreshProjects(); }, [refreshProjects]);
  const createProject = useCallback(async (details) => { const created = await api.createProject(details); await refreshProjects(); return created; }, [refreshProjects]);
  const updateProject = useCallback(async (details) => { if (!project) return null; const projectId = project.id; const updated = await api.updateProject(projectId, details); setProject((current) => current?.id === projectId ? { ...current, ...updated } : current); setProjects((current) => current.map((item) => item.id === projectId ? { ...item, ...updated } : item)); refreshProjects().catch(() => {}); return updated; }, [project, refreshProjects]);
  useEffect(() => { refreshProjects().finally(() => setLoading(false)); }, [refreshProjects]);
  return { projects, project, isLoading, error, openProject, refreshBoard, showProjects, createProject, updateProject };
}
