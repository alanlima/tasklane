const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const request = async (path, options = {}) => { const response = await fetch(`${baseUrl}${path}`, { headers: { "Content-Type": "application/json" }, ...options }); if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail ?? "Request failed"); return response.status === 204 ? null : response.json(); };
const id = () => crypto.randomUUID();
const priority = (value) => value === "NONE" ? "None" : value.charAt(0) + value.slice(1).toLowerCase();
const mapTask = (task) => ({ ...task, columnId: task.column_id, labelIds: task.label_ids, points: task.story_points, dueDate: task.due_date ?? "", priority: priority(task.priority), checklist: task.checklist.map((item) => ({ ...item, done: item.is_completed })) });
const mapChecklistItem = (item) => ({ ...item, done: item.is_completed });
const mapBoard = (board) => ({ ...board.project, updatedAt: new Date(board.project.updated_at).toLocaleDateString(), columns: board.columns, labels: board.labels, tasks: board.tasks.map(mapTask) });
const mapSummary = (project) => ({ ...project, updatedAt: new Date(project.updated_at).toLocaleDateString(), totalTasks: project.total_tasks, completedTasks: project.completed_tasks, completion: project.completion_percentage });

// The only HTTP boundary used by React components.
export const api = {
  reset: () => {}, listProjects: async () => (await request("/api/projects")).map(mapSummary), getBoard: async (projectId) => mapBoard(await request(`/api/projects/${projectId}/board`)),
  createProject: ({ name, description }) => request("/api/projects", { method: "POST", body: JSON.stringify({ name, description }) }),
  updateProject: (projectId, { name, description }) => request(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ name, description: description || null }) }),
  createTask: async (projectId, { title, columnId }) => mapTask(await request(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify({ title, column_id: columnId }) })),
  updateTask: async (projectId, taskId, patch) => {
    if (Object.keys(patch).length === 1 && "columnId" in patch) return api.moveTask(projectId, taskId, patch.columnId, 0);
    const payload = { ...patch };
    if ("priority" in patch) payload.priority = patch.priority?.toUpperCase();
    if ("points" in patch) { payload.story_points = patch.points; delete payload.points; }
    if ("dueDate" in patch) { payload.due_date = patch.dueDate || null; delete payload.dueDate; }
    if ("labelIds" in patch) { payload.label_ids = patch.labelIds; delete payload.labelIds; }
    delete payload.columnId;
    return mapTask(await request(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }));
  },
  moveTask: (projectId, taskId, targetColumnId, targetPosition) => request(`/api/projects/${projectId}/actions/move-task`, { method: "POST", body: JSON.stringify({ task_id: taskId, target_column_id: targetColumnId, target_position: targetPosition, idempotency_key: id() }) }),
  createColumn: (projectId, name) => request(`/api/projects/${projectId}/columns`, { method: "POST", body: JSON.stringify({ name }) }),
  createChecklistItem: async (taskId, title) => mapChecklistItem(await request(`/api/tasks/${taskId}/checklist`, { method: "POST", body: JSON.stringify({ title }) })),
  updateChecklistItem: async (itemId, patch) => { const payload = { ...patch, is_completed: patch.done }; delete payload.done; return mapChecklistItem(await request(`/api/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) })); },
  reorderColumns: async (projectId, sourceIndex, destinationIndex) => { const board = await api.getBoard(projectId); return request(`/api/projects/${projectId}/actions/move-column`, { method: "POST", body: JSON.stringify({ column_id: board.columns[sourceIndex].id, target_position: destinationIndex, idempotency_key: id() }) }); },
};
