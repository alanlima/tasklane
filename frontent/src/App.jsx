import { useState } from "react";
import { useTasklane } from "./hooks/useTasklane";
import { AppHeader } from "./components/layout/AppHeader";
import { ProjectsPage } from "./pages/ProjectsPage";
import { BoardPage } from "./pages/BoardPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";

export default function App() {
  const tasklane = useTasklane();
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  if (tasklane.isLoading) return <div className="app-loading">Loading Tasklane…</div>;
  return <><AppHeader onHome={() => { setSettingsOpen(false); tasklane.showProjects(); }} />{tasklane.error && <p className="app-error" role="alert">{tasklane.error}</p>}{tasklane.project
    ? isSettingsOpen ? <ProjectSettingsPage project={tasklane.project} onBack={() => setSettingsOpen(false)} onSave={tasklane.updateProject} onLabels={tasklane.manageLabel} /> : <BoardPage project={tasklane.project} onBack={tasklane.showProjects} onRefresh={tasklane.refreshBoard} onSettings={() => setSettingsOpen(true)} onLabels={tasklane.manageLabel} />
    : <ProjectsPage projects={tasklane.projects} onOpen={tasklane.openProject} onCreate={tasklane.createProject} />}</>;
}
