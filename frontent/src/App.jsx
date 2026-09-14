import { useEffect, useRef } from "react";
import { Link, Outlet, Route, Routes, useLocation, useMatch, useNavigate, useOutletContext, useParams } from "react-router";
import { useTasklane } from "./hooks/useTasklane";
import { AppHeader } from "./components/layout/AppHeader";
import { ProjectsPage } from "./pages/ProjectsPage";
import { BoardPage } from "./pages/BoardPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";

const boardPath = (id) => `/projects/${encodeURIComponent(id)}`;

function useMounted() {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return mounted;
}

function PageFocus({ ready, children }) {
  const container = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!ready) return;
    const heading = container.current?.querySelector("h1");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [pathname, ready]);
  return <div ref={container}>{children}</div>;
}

function RecoveryPage({ title = "Page not found", message = "This address does not match a Tasklane page.", onRetry }) {
  return <main className="page"><h1>{title}</h1><p role="alert">{message}</p>{onRetry && <button className="secondary-button" onClick={onRetry}>Try again</button>} <Link className="back-link" to="/">Back to Projects</Link></main>;
}

function Dashboard({ tasklane }) {
  const navigate = useNavigate();
  const mounted = useMounted();
  return <PageFocus ready={!tasklane.isLoading}>{tasklane.isLoading ? <div className="app-loading" role="status">Loading projects…</div> : <>{tasklane.error && <div className="app-error" role="alert">{tasklane.error} <button onClick={() => tasklane.refreshProjects().catch(() => {})}>Try again</button></div>}<ProjectsPage projects={tasklane.projects} archivedProjects={tasklane.archivedProjects} onOpen={(id) => { if (mounted.current) navigate(boardPath(id)); }} onCreate={tasklane.createProject} /></>}</PageFocus>;
}

function ProjectRoute({ tasklane }) {
  const { projectId } = useParams();
  return <ProjectSession key={projectId} projectId={projectId} tasklane={tasklane} />;
}

function ProjectSession({ projectId, tasklane }) {
  const navigate = useNavigate();
  const mounted = useMounted();
  const leaveAfter = (operation) => async (...args) => {
    await operation(...args);
    if (mounted.current) navigate("/", { replace: true });
  };
  return <PageFocus ready={!tasklane.isLoading}>{tasklane.isLoading ? <div className="app-loading" role="status">Loading project…</div> : tasklane.boardError?.projectId === projectId ? <RecoveryPage title={tasklane.boardError.status === 404 ? "Project not found" : "Could not load this project"} message={tasklane.boardError.message} onRetry={() => tasklane.openProject(projectId)} /> : tasklane.project?.id === projectId ? <>{tasklane.error && <p className="app-error" role="alert">{tasklane.error}</p>}<Outlet context={{ ...tasklane, archiveProject: leaveAfter(tasklane.archiveProject), deleteProject: leaveAfter(tasklane.deleteProject) }} /></> : <div className="app-loading" role="status">Returning to projects…</div>}</PageFocus>;
}

function RoutedBoard() {
  const tasklane = useOutletContext();
  const navigate = useNavigate();
  return <BoardPage project={tasklane.project} onBack={() => navigate("/")} onRefresh={tasklane.refreshBoard} onSettings={() => navigate(`${boardPath(tasklane.project.id)}/settings`)} onLabels={tasklane.manageLabel} />;
}

function RoutedSettings() {
  const tasklane = useOutletContext();
  const navigate = useNavigate();
  return <ProjectSettingsPage project={tasklane.project} onBack={() => navigate(boardPath(tasklane.project.id))} onSave={tasklane.updateProject} onLabels={tasklane.manageLabel} onGetArchiveSummary={tasklane.getArchiveSummary} onArchive={tasklane.archiveProject} onRestore={tasklane.restoreProject} onDelete={tasklane.deleteProject} />;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const boardMatch = useMatch("/projects/:projectId");
  const settingsMatch = useMatch("/projects/:projectId/settings");
  const projectId = (boardMatch ?? settingsMatch)?.params.projectId ?? null;
  const tasklane = useTasklane(projectId);
  return <><AppHeader onHome={() => navigate("/", { replace: location.pathname === "/" })} /><Routes><Route path="/" element={<Dashboard tasklane={tasklane} />} /><Route path="/projects/:projectId" element={<ProjectRoute tasklane={tasklane} />}><Route index element={<RoutedBoard />} /><Route path="settings" element={<RoutedSettings />} /></Route><Route path="*" element={<PageFocus ready><RecoveryPage /></PageFocus>} /></Routes></>;
}
