import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./services/mockApi";

describe("frontend API service", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("loads and maps project summaries from the backend contract", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: "p1", name: "Tasklane", updated_at: "2026-09-13T00:00:00Z", total_tasks: 2, completed_tasks: 1, completion_percentage: 50 }] });
    vi.stubGlobal("fetch", fetch);
    await expect(api.listProjects()).resolves.toMatchObject([{ id: "p1", totalTasks: 2, completedTasks: 1, completion: 50 }]);
    expect(fetch).toHaveBeenCalledWith("/api/projects", expect.any(Object));
  });
  it("creates and updates checklist items through the backend contract", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "item-1", title: "Connect UI", is_completed: false }) }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "item-1", title: "Connect UI", is_completed: true }) });
    vi.stubGlobal("fetch", fetch);
    await expect(api.createChecklistItem("task-1", "Connect UI")).resolves.toMatchObject({ id: "item-1", done: false });
    await expect(api.updateChecklistItem("item-1", { done: true })).resolves.toMatchObject({ done: true });
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/tasks/task-1/checklist", expect.objectContaining({ method: "POST" }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/checklist/item-1", expect.objectContaining({ method: "PATCH" }));
  });
  it("patches task fields without moving a task or clearing omitted values", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "task-1", column_id: "column-2", label_ids: [], story_points: 3, due_date: "2026-10-01", priority: "HIGH", checklist: [] }) });
    vi.stubGlobal("fetch", fetch);

    await api.updateTask("project-1", "task-1", { title: "Updated title" });
    await api.updateTask("project-1", "task-1", { priority: "High" });

    expect(fetch).toHaveBeenNthCalledWith(1, "/api/tasks/task-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Updated title" }) }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/tasks/task-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ priority: "HIGH" }) }));
  });
});
