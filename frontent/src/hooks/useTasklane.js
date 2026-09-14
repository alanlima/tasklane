import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/mockApi";

export function useTasklane(initialProjectId) {
  const [projects, setProjects] = useState([]); const [archivedProjects, setArchivedProjects] = useState([]); const [project, setProject] = useState(null); const [isLoading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [boardError, setBoardError] = useState(null);
  const selectedProjectId = useRef(null);
  const routeProjectId = useRef(initialProjectId);
  routeProjectId.current = initialProjectId;
  const boardVersion = useRef(0);
  const listVersion = useRef(0);
  const refreshProjects = useCallback(async () => {
    const version = ++listVersion.current;
    try {
      const allProjects = await api.listProjects(true);
      if (version !== listVersion.current) return;
      setError(null);
      setProjects(allProjects.filter((item) => !item.is_archived));
      setArchivedProjects(allProjects.filter((item) => item.is_archived));
    } catch (requestError) {
      if (version !== listVersion.current) return;
      setError("Could not load projects. Please try again.");
      throw requestError;
    }
  }, []);
  const openProject = useCallback(async (projectId) => {
    selectedProjectId.current = projectId;
    const version = ++boardVersion.current;
    setLoading(true); setBoardError(null); setProject(null);
    try {
      const board = await api.getBoard(projectId);
      if (version === boardVersion.current) setProject(board);
    } catch (requestError) {
      if (version === boardVersion.current) setBoardError({ projectId, status: requestError.status, message: requestError.status === 404 ? "This project was deleted or does not exist. Return to Projects to choose another board." : "Check your connection and try again, or return to Projects." });
    } finally { if (version === boardVersion.current) setLoading(false); }
  }, []);
  const reconcileCurrentProject = useCallback((projectId, version, patch) => {
    if (selectedProjectId.current !== projectId || (routeProjectId.current !== undefined && routeProjectId.current !== projectId)) return;
    if (version !== boardVersion.current) {
      // A revisited route needs fresh board data, including archive/deletion state.
      openProject(projectId);
      return;
    }
    setProject((current) => current?.id === projectId ? (patch === null ? null : { ...current, ...patch }) : current);
  }, [openProject]);
  const refreshBoard = useCallback(async () => {
    if (project && selectedProjectId.current === project.id && (routeProjectId.current === undefined || routeProjectId.current === project.id)) {
      const version = ++boardVersion.current;
      const board = await api.getBoard(project.id);
      if (version === boardVersion.current) setProject((current) => current?.id === project.id ? board : current);
    }
    await refreshProjects();
  }, [project, refreshProjects]);
  const showProjects = useCallback(() => { selectedProjectId.current = null; ++boardVersion.current; setProject(null); setBoardError(null); setLoading(false); refreshProjects().catch(() => {}); }, [refreshProjects]);
  const createProject = useCallback(async (details) => { const created = await api.createProject(details); await refreshProjects().catch(() => {}); return created; }, [refreshProjects]);
  const updateProject = useCallback(async (details) => { if (!project) return null; const projectId = project.id; const version = boardVersion.current; const updated = await api.updateProject(projectId, details); reconcileCurrentProject(projectId, version, updated); setProjects((current) => current.map((item) => item.id === projectId ? { ...item, ...updated } : item)); refreshProjects().catch(() => {}); return updated; }, [project, refreshProjects, reconcileCurrentProject]);
  const getArchiveSummary = useCallback(() => project ? api.getArchiveSummary(project.id) : Promise.resolve(null), [project]);
  const reconcileLifecycle = useCallback((original, updated) => {
    ++listVersion.current;
    const done = [...(original.columns ?? [])].sort((a, b) => a.position - b.position).at(-1);
    const totalTasks = updated.total_tasks ?? original.tasks?.length ?? 0;
    const completedTasks = updated.completed_tasks ?? original.tasks?.filter((task) => task.columnId === done?.id).length ?? 0;
    const summary = { ...original, ...updated, totalTasks, completedTasks, completion: totalTasks ? Math.round(completedTasks / totalTasks * 100) : 0, updatedAt: new Date(updated.updated_at).toLocaleDateString() };
    setProjects((current) => updated.is_archived ? current.filter((item) => item.id !== original.id) : [...current.filter((item) => item.id !== original.id), summary]);
    setArchivedProjects((current) => updated.is_archived ? [...current.filter((item) => item.id !== original.id), summary] : current.filter((item) => item.id !== original.id));
  }, []);
  const archiveProject = useCallback(async (confirmIncomplete = false) => {
    if (!project) return;
    const projectId = project.id;
    const version = boardVersion.current;
    const archived = await api.archiveProject(projectId, confirmIncomplete);
    reconcileLifecycle(project, { ...archived, is_archived: true });
    reconcileCurrentProject(projectId, version, null);
    refreshProjects().catch(() => {});
  }, [project, refreshProjects, reconcileLifecycle, reconcileCurrentProject]);
  const restoreProject = useCallback(async () => {
    if (!project) return;
    const projectId = project.id;
    const version = boardVersion.current;
    const restored = await api.restoreProject(projectId);
    reconcileLifecycle(project, { ...restored, is_archived: false });
    reconcileCurrentProject(projectId, version, restored);
    refreshProjects().catch(() => {});
  }, [project, refreshProjects, reconcileLifecycle, reconcileCurrentProject]);
  const deleteProject = useCallback(async (confirmationName) => {
    if (!project) return;
    const projectId = project.id;
    const version = boardVersion.current;
    await api.deleteProject(projectId, confirmationName);
    ++listVersion.current;
    setProjects((current) => current.filter((item) => item.id !== projectId));
    setArchivedProjects((current) => current.filter((item) => item.id !== projectId));
    reconcileCurrentProject(projectId, version, null);
    refreshProjects().catch(() => {});
  }, [project, refreshProjects, reconcileCurrentProject]);
  const manageLabel = useCallback(async (operation, ...args) => { const result = await api[operation](...args); await refreshBoard(); return result; }, [refreshBoard]);
  useEffect(() => {
    let active = true;
    if (initialProjectId) openProject(initialProjectId);
    else {
      setLoading(true);
      if (initialProjectId === null) { selectedProjectId.current = null; setProject(null); setBoardError(null); }
    }
    refreshProjects().catch(() => {}).finally(() => { if (active && !initialProjectId) setLoading(false); });
    return () => { active = false; ++boardVersion.current; ++listVersion.current; };
  }, [initialProjectId, openProject, refreshProjects]);
  return { projects, archivedProjects, project, isLoading, error, boardError, refreshProjects, openProject, refreshBoard, showProjects, createProject, updateProject, getArchiveSummary, archiveProject, restoreProject, deleteProject, manageLabel };
}
