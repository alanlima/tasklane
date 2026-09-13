import { useTasklane } from "./hooks/useTasklane";
import { AppHeader } from "./components/layout/AppHeader";
import { ProjectsPage } from "./pages/ProjectsPage";
import { BoardPage } from "./pages/BoardPage";

export default function App() {
  const tasklane = useTasklane();
  if (tasklane.isLoading) return <div className="app-loading">Loading Tasklane…</div>;
  return <><AppHeader onHome={tasklane.showProjects} />{tasklane.project
    ? <BoardPage project={tasklane.project} onBack={tasklane.showProjects} onRefresh={tasklane.refreshBoard} />
    : <ProjectsPage projects={tasklane.projects} onOpen={tasklane.openProject} onCreate={tasklane.createProject} />}</>;
}
