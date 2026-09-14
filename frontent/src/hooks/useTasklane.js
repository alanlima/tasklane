import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/mockApi";

export function useTasklane() {
  const [projects, setProjects] = useState([]); const [archivedProjects, setArchivedProjects] = useState([]); const [project, setProject] = useState(null); const [isLoading, setLoading] = useState(true); const [error, setError] = useState(null);
  const listVersion = useRef(0);
  const refreshProjects = useCallback(async () => {
    const version = ++listVersion.current;
    try {
      const allProjects = await api.listProjects(true);
      if (version !== listVersion.current) return;
      setProjects(allProjects.filter((item) => !item.is_archived));
      setArchivedProjects(allProjects.filter((item) => item.is_archived));
    } catch (requestError) {
      if (version !== listVersion.current) return;
      setError("Could not load projects. Please try again.");
      throw requestError;
    }
  }, []);
  const openProject = useCallback(async (projectId) => { setLoading(true); setError(null); try { setProject(await api.getBoard(projectId)); } catch (requestError) { setError("Could not open this board. Please try again."); } finally { setLoading(false); } }, []);
  const refreshBoard = useCallback(async () => { if (project) setProject(await api.getBoard(project.id)); await refreshProjects(); }, [project, refreshProjects]);
  const showProjects = useCallback(() => { setProject(null); refreshProjects(); }, [refreshProjects]);
  const createProject = useCallback(async (details) => { const created = await api.createProject(details); await refreshProjects(); return created; }, [refreshProjects]);
  const updateProject = useCallback(async (details) => { if (!project) return null; const projectId = project.id; const updated = await api.updateProject(projectId, details); setProject((current) => current?.id === projectId ? { ...current, ...updated } : current); setProjects((current) => current.map((item) => item.id === projectId ? { ...item, ...updated } : item)); refreshProjects().catch(() => {}); return updated; }, [project, refreshProjects]);
  const getArchiveSummary = useCallback(() => project ? api.getArchiveSummary(project.id) : Promise.resolve(null), [project]);
  const reconcileLifecycle = useCallback((original, updated) => {
    ++listVersion.current;
    const done = [...(original.columns ?? [])].sort((a, b) => a.position - b.position).at(-1);
    const totalTasks = original.tasks?.length ?? 0;
    const completedTasks = original.tasks?.filter((task) => task.columnId === done?.id).length ?? 0;
    const summary = { ...original, ...updated, totalTasks, completedTasks, completion: totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0, updatedAt: new Date(updated.updated_at).toLocaleDateString() };
    setProjects((current) => updated.is_archived ? current.filter((item) => item.id !== original.id) : [...current.filter((item) => item.id !== original.id), summary]);
    setArchivedProjects((current) => updated.is_archived ? [...current.filter((item) => item.id !== original.id), summary] : current.filter((item) => item.id !== original.id));
  }, []);
  const archiveProject = useCallback(async (confirmIncomplete = false) => {
    if (!project) return;
    const projectId = project.id;
    const archived = await api.archiveProject(projectId, confirmIncomplete);
    reconcileLifecycle(project, { ...archived, is_archived: true });
    setProject((current) => current?.id === projectId ? null : current);
    await refreshProjects().catch(() => {});
  }, [project, refreshProjects, reconcileLifecycle]);
  const restoreProject = useCallback(async () => {
    if (!project) return;
    const projectId = project.id;
    const restored = await api.restoreProject(projectId);
    reconcileLifecycle(project, { ...restored, is_archived: false });
    setProject((current) => current?.id === projectId ? { ...current, ...restored } : current);
    await refreshProjects().catch(() => {});
  }, [project, refreshProjects, reconcileLifecycle]);
  const deleteProject = useCallback(async (confirmationName) => {
    if (!project) return;
    const projectId = project.id;
    await api.deleteProject(projectId, confirmationName);
    ++listVersion.current;
    setProjects((current) => current.filter((item) => item.id !== projectId));
    setArchivedProjects((current) => current.filter((item) => item.id !== projectId));
    setProject((current) => current?.id === projectId ? null : current);
    await refreshProjects().catch(() => {});
  }, [project, refreshProjects]);
  const manageLabel = useCallback(async (operation, ...args) => { const result = await api[operation](...args); await refreshBoard(); return result; }, [refreshBoard]);
  useEffect(() => { refreshProjects().finally(() => setLoading(false)); }, [refreshProjects]);
  return { projects, archivedProjects, project, isLoading, error, openProject, refreshBoard, showProjects, createProject, updateProject, getArchiveSummary, archiveProject, restoreProject, deleteProject, manageLabel };
}
