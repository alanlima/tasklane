const pause = (value, delay = 160) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), delay));
const id = () => crypto.randomUUID();

let database = {
  projects: [
    {
      id: "project-development",
      name: "Tasklane Development",
      description: "A focused MVP board for building Tasklane.",
      updatedAt: "Just now",
      columns: [
        { id: "backlog", name: "Backlog" },
        { id: "todo", name: "To Do" },
        { id: "progress", name: "In Progress" },
        { id: "review", name: "Review" },
        { id: "done", name: "Done" },
      ],
      labels: [
        { id: "label-frontend", name: "Frontend", colour: "indigo" },
        { id: "label-backend", name: "Backend", colour: "green" },
        { id: "label-ux", name: "UX", colour: "amber" },
      ],
      tasks: [
        { id: "task-1", columnId: "backlog", position: 0, title: "Sketch empty states", priority: "Medium", points: 2, dueDate: "2026-09-18", labelIds: ["label-ux"], description: "Design intentional project and board empty states.", checklist: [{ id: "c1", title: "Dashboard empty state", done: true }, { id: "c2", title: "Column empty state", done: false }] },
        { id: "task-2", columnId: "todo", position: 0, title: "Build project dashboard", priority: "High", points: 5, dueDate: "2026-09-20", labelIds: ["label-frontend", "label-ux"], description: "Create the projects overview with progress and quick creation.", checklist: [{ id: "c3", title: "Project cards", done: true }, { id: "c4", title: "Progress indicator", done: false }, { id: "c5", title: "New project modal", done: false }] },
        { id: "task-3", columnId: "progress", position: 0, title: "Create board action queue", priority: "High", points: 8, dueDate: "2026-09-23", labelIds: ["label-backend"], description: "Persist movement commands before acknowledgement.", checklist: [{ id: "c6", title: "Action model", done: true }, { id: "c7", title: "Worker recovery", done: false }] },
        { id: "task-4", columnId: "done", position: 0, title: "Define Tasklane palette", priority: "Low", points: 1, dueDate: "2026-09-14", labelIds: ["label-ux"], description: "Establish the warm neutral visual language.", checklist: [] },
      ],
    },
    {
      id: "project-website",
      name: "Personal Website",
      description: "A small refresh of the portfolio site.",
      updatedAt: "Yesterday",
      columns: [{ id: "ideas", name: "Ideas" }, { id: "doing", name: "Doing" }, { id: "finished", name: "Done" }],
      labels: [],
      tasks: [
        { id: "website-1", columnId: "ideas", position: 0, title: "Collect inspiration", priority: "None", points: null, dueDate: "", labelIds: [], description: "", checklist: [] },
        { id: "website-2", columnId: "finished", position: 0, title: "Choose typography", priority: "Low", points: 1, dueDate: "", labelIds: [], description: "", checklist: [] },
      ],
    },
  ],
};

const projectSummary = (project) => {
  const done = project.columns.find((column) => column.name.toLowerCase() === "done");
  const completed = done ? project.tasks.filter((task) => task.columnId === done.id).length : 0;
  return { ...project, totalTasks: project.tasks.length, completedTasks: completed, completion: project.tasks.length ? Math.round((completed / project.tasks.length) * 100) : 0 };
};

const reindex = (project, columnId) => project.tasks.filter((task) => task.columnId === columnId).sort((a, b) => a.position - b.position).forEach((task, index) => { task.position = index; });
const getProject = (projectId) => database.projects.find((project) => project.id === projectId);

// This module is the only boundary React code uses for backend-shaped calls.
export const api = {
  listProjects: () => pause(database.projects.map(projectSummary)),
  getBoard: (projectId) => pause(getProject(projectId)),
  createProject: async ({ name, description }) => {
    const project = { id: id(), name, description, updatedAt: "Just now", columns: ["Backlog", "To Do", "In Progress", "Done"].map((column) => ({ id: id(), name: column })), labels: [], tasks: [] };
    database.projects.unshift(project);
    return pause(project);
  },
  createTask: async (projectId, { title, columnId }) => {
    const project = getProject(projectId);
    const task = { id: id(), title, columnId, position: project.tasks.filter((item) => item.columnId === columnId).length, priority: "None", points: null, dueDate: "", labelIds: [], description: "", checklist: [] };
    project.tasks.push(task);
    return pause(task);
  },
  updateTask: async (projectId, taskId, patch) => {
    const task = getProject(projectId).tasks.find((item) => item.id === taskId);
    Object.assign(task, patch);
    return pause(task);
  },
  moveTask: async (projectId, taskId, targetColumnId, targetPosition) => {
    const project = getProject(projectId);
    const task = project.tasks.find((item) => item.id === taskId);
    const oldColumnId = task.columnId;
    task.columnId = targetColumnId;
    task.position = targetPosition;
    reindex(project, oldColumnId);
    reindex(project, targetColumnId);
    return pause({ actionId: id(), status: "COMPLETED" });
  },
  createColumn: async (projectId, name) => {
    const column = { id: id(), name };
    getProject(projectId).columns.push(column);
    return pause(column);
  },
  renameColumn: async (projectId, columnId, name) => {
    getProject(projectId).columns.find((column) => column.id === columnId).name = name;
    return pause({ columnId, name });
  },
  reorderColumns: async (projectId, sourceIndex, destinationIndex) => {
    const columns = getProject(projectId).columns;
    const [column] = columns.splice(sourceIndex, 1);
    columns.splice(destinationIndex, 0, column);
    return pause(columns);
  },
};
