import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTasklane } from "./useTasklane";
import { api } from "../services/mockApi";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each(["restoreProject", "archiveProject", "deleteProject"])("ignores a delayed %s result after opening another project", async (operation) => {
  const a = { id: "a", name: "A", is_archived: true, tasks: [] };
  const b = { id: "b", name: "B", is_archived: false, tasks: [{ id: "b-task" }] };
  vi.spyOn(api, "listProjects").mockResolvedValue([a, b]);
  vi.spyOn(api, "getBoard").mockImplementation(async (id) => id === "a" ? a : b);
  let resolve;
  vi.spyOn(api, operation).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result } = renderHook(useTasklane);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(() => result.current.openProject("a"));
  let pending;
  act(() => { pending = result.current[operation]("A"); });
  act(() => result.current.showProjects());
  await act(() => result.current.openProject("b"));
  await act(async () => { resolve({ ...a, is_archived: false }); await pending; });
  expect(result.current.project).toEqual(b);
});

it.each(["restoreProject", "archiveProject", "deleteProject"])("keeps successful %s state when refreshing projects fails", async (operation) => {
  const archived = operation === "restoreProject";
  const project = { id: "a", name: "A", is_archived: archived, updated_at: "2026-09-14T00:00:00Z", columns: [{ id: "done", position: 1 }], tasks: [{ id: "t", columnId: "done" }] };
  const list = vi.spyOn(api, "listProjects").mockResolvedValue([project]);
  vi.spyOn(api, "getBoard").mockResolvedValue(project);
  vi.spyOn(api, operation).mockResolvedValue({ ...project, is_archived: !archived });
  const { result } = renderHook(useTasklane);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(() => result.current.openProject("a"));
  list.mockRejectedValue(new Error("list offline"));
  await act(async () => { await expect(result.current[operation]("A")).resolves.toBeUndefined(); });
  expect(result.current.error).toContain("Could not load projects");
  if (operation === "deleteProject") {
    expect(result.current.projects).toEqual([]);
    expect(result.current.archivedProjects).toEqual([]);
  } else {
    const destination = operation === "archiveProject" ? result.current.archivedProjects : result.current.projects;
    const source = operation === "archiveProject" ? result.current.projects : result.current.archivedProjects;
    expect(source).toEqual([]);
    expect(destination).toMatchObject([{ id: "a", is_archived: !archived, totalTasks: 1, completedTasks: 1 }]);
  }
  if (operation === "restoreProject") expect(result.current.project.is_archived).toBe(false);
  else expect(result.current.project).toBeNull();
});
