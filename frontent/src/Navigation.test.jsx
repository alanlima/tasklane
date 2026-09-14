import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { api } from "./services/mockApi";

const board = (id) => ({ id, name: `Project ${id}`, description: "Persisted description", is_archived: false, columns: [{ id: `${id}-todo`, name: "To Do", position: 0 }], tasks: [], labels: [] });
let routers = [];
function setup(path = "/") {
  vi.spyOn(api, "listProjects").mockResolvedValue([board("a"), board("b")]);
  vi.spyOn(api, "getBoard").mockImplementation(async (id) => board(id));
  const router = createMemoryRouter([{ path: "*", element: <App /> }], { initialEntries: [path] });
  routers.push(router);
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}
async function go(router, path) { await act(async () => { await router.navigate(path); }); }
afterEach(() => { cleanup(); routers.forEach((router) => router.dispose()); routers = []; vi.restoreAllMocks(); });

it.each(["/projects/a", "/projects/a/settings"])("loads persisted data directly from %s", async (path) => {
  const { router } = setup(path);
  await screen.findByRole("heading", { name: path.endsWith("settings") ? "General" : "Project a" });
  expect(api.getBoard).toHaveBeenCalledWith("a");
  expect(router.state.location.pathname).toBe(path);
  if (path.endsWith("settings")) expect(screen.getByLabelText("Description optional")).toHaveValue("Persisted description");
  expect(document.activeElement.tagName).toBe("H1");
});

it("updates paths and restores boards/settings with Back and Forward", async () => {
  const { router, user } = setup();
  await user.click(await screen.findByRole("button", { name: /Project a/ }));
  await screen.findByRole("heading", { name: "Project a" });
  expect(router.state.location.pathname).toBe("/projects/a");
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(router.state.location.pathname).toBe("/projects/a/settings");
  await go(router, -1);
  expect(await screen.findByRole("heading", { name: "Project a" })).toBeVisible();
  await go(router, 1);
  expect(await screen.findByRole("heading", { name: "General" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Back to board" }));
  expect(router.state.location.pathname).toBe("/projects/a");
  await user.click(screen.getByRole("button", { name: "Projects", exact: true }));
  expect(router.state.location.pathname).toBe("/");
  await user.click(await screen.findByRole("button", { name: /Project b/ }));
  await screen.findByRole("heading", { name: "Project b" });
  await go(router, -1); await go(router, -1);
  expect(await screen.findByRole("heading", { name: "Project a" })).toBeVisible();
});

it("shows an unknown-route recovery link", async () => {
  const { router, user } = setup("/not-a-page");
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Back to Projects" }));
  expect(router.state.location.pathname).toBe("/");
  expect(await screen.findByRole("heading", { name: "Projects" })).toBeVisible();
});

it("does not show an old board when another project is missing; retry recovers", async () => {
  const { router, user } = setup("/projects/a");
  await screen.findByRole("heading", { name: "Project a" });
  api.getBoard.mockRejectedValueOnce(Object.assign(new Error("missing"), { status: 404 }));
  await go(router, "/projects/b/settings");
  expect(await screen.findByRole("heading", { name: "Project not found" })).toBeVisible();
  expect(screen.queryByText("Project a")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "General" })).toBeVisible();
  expect(screen.getByLabelText("Project name")).toHaveValue("Project b");
});

it.each([false, true])("ignores an earlier project response after navigation (failure: %s)", async (fail) => {
  const { router } = setup();
  await screen.findByRole("heading", { name: "Projects" });
  let resolve, reject;
  api.getBoard.mockImplementationOnce(() => new Promise((done, bad) => { resolve = done; reject = bad; }));
  await go(router, "/projects/a");
  expect(screen.getByRole("status")).toHaveTextContent("Loading project");
  await go(router, "/projects/b/settings");
  await screen.findByRole("heading", { name: "General" });
  await act(async () => { if (fail) reject(new Error("offline")); else resolve(board("a")); });
  expect(router.state.location.pathname).toBe("/projects/b/settings");
  expect(screen.getByLabelText("Project name")).toHaveValue("Project b");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows a transient project error and reloads the same URL on retry", async () => {
  const { router, user } = setup();
  await screen.findByRole("heading", { name: "Projects" });
  api.getBoard.mockRejectedValueOnce(new Error("offline"));
  await go(router, "/projects/a");
  expect(await screen.findByRole("heading", { name: "Could not load this project" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Project a" });
  expect(router.state.location.pathname).toBe("/projects/a");
});

it.each(["archive", "delete"])("returns to / after %s and handles a deleted history entry", async (operation) => {
  const { router, user } = setup();
  let exists = true;
  api.getBoard.mockImplementation(async (id) => { if (!exists) throw Object.assign(new Error("deleted"), { status: 404 }); return board(id); });
  vi.spyOn(api, "getArchiveSummary").mockResolvedValue({ total_tasks: 0, incomplete_tasks: 0 });
  vi.spyOn(api, "archiveProject").mockResolvedValue({ ...board("a"), is_archived: true });
  vi.spyOn(api, "deleteProject").mockImplementation(async () => { exists = false; });
  await user.click(await screen.findByRole("button", { name: /Project a/ }));
  await user.click(await screen.findByRole("button", { name: "Settings" }));
  if (operation === "archive") {
    await user.click(screen.getByRole("button", { name: "Archive project" }));
    await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
  } else {
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    await user.type(screen.getAllByLabelText("Project name")[1], "Project a");
    await user.click(screen.getAllByRole("button", { name: "Delete permanently" })[1]);
  }
  await screen.findByRole("heading", { name: "Projects" });
  expect(router.state.location.pathname).toBe("/");
  await go(router, -1);
  expect(await screen.findByRole("heading", { name: operation === "delete" ? "Project not found" : "Project a" })).toBeVisible();
});

it("does not redirect a different project when a delayed archive finishes", async () => {
  const { router, user } = setup("/projects/a/settings");
  let finish;
  vi.spyOn(api, "getArchiveSummary").mockResolvedValue({ total_tasks: 0, incomplete_tasks: 0 });
  vi.spyOn(api, "archiveProject").mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await user.click(await screen.findByRole("button", { name: "Archive project" }));
  await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
  await go(router, "/projects/b");
  await screen.findByRole("heading", { name: "Project b" });
  await act(async () => finish({ ...board("a"), is_archived: true }));
  expect(router.state.location.pathname).toBe("/projects/b");
  expect(screen.getByRole("heading", { name: "Project b" })).toBeVisible();
});

it("does not add a history entry when Home is clicked on the dashboard", async () => {
  const { router, user } = setup("/projects/a");
  await screen.findByRole("heading", { name: "Project a" });
  await user.click(screen.getByRole("button", { name: "Tasklane" }));
  await screen.findByRole("heading", { name: "Projects" });
  await user.click(screen.getByRole("button", { name: "Tasklane" }));
  await go(router, -1);
  expect(router.state.location.pathname).toBe("/projects/a");
});

it("opens a newly created project at its board URL", async () => {
  const { router, user } = setup();
  vi.spyOn(api, "createProject").mockResolvedValue(board("new"));
  await user.click(await screen.findByRole("button", { name: "New project" }));
  await user.type(screen.getByLabelText("Project name"), "Project new");
  await user.click(screen.getByRole("button", { name: "Create project" }));
  expect(await screen.findByRole("heading", { name: "Project new" })).toBeVisible();
  expect(router.state.location.pathname).toBe("/projects/new");
});

it("retains reconciled archived cards when dashboard refresh fails", async () => {
  const { router, user } = setup("/projects/a/settings");
  vi.spyOn(api, "getArchiveSummary").mockResolvedValue({ total_tasks: 0, incomplete_tasks: 0 });
  vi.spyOn(api, "archiveProject").mockResolvedValue({ ...board("a"), is_archived: true, total_tasks: 0, completed_tasks: 0 });
  await user.click(await screen.findByRole("button", { name: "Archive project" }));
  api.listProjects.mockRejectedValue(new Error("offline"));
  await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
  await screen.findByRole("heading", { name: "Projects" });
  expect(router.state.location.pathname).toBe("/");
  expect(screen.queryByRole("button", { name: /Project a/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Archived projects/ }));
  expect(screen.getByRole("button", { name: /Project a/ })).toBeVisible();
});

it.each(["archive", "restore", "delete"])("reconciles a delayed %s after revisiting the same project", async (operation) => {
  const { router, user } = setup();
  await screen.findByRole("heading", { name: "Projects" });
  let current = { ...board("a"), is_archived: operation === "restore" };
  api.getBoard.mockImplementation(async () => {
    if (!current) throw Object.assign(new Error("deleted"), { status: 404 });
    return current;
  });
  let finish, staleLoad;
  vi.spyOn(api, "getArchiveSummary").mockResolvedValue({ total_tasks: 0, incomplete_tasks: 0 });
  vi.spyOn(api, `${operation}Project`).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await go(router, "/projects/a/settings");
  if (operation === "restore") await user.click(await screen.findByRole("button", { name: "Restore project" }));
  else if (operation === "archive") {
    await user.click(await screen.findByRole("button", { name: "Archive project" }));
    await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
  } else {
    await user.click(await screen.findByRole("button", { name: "Delete permanently" }));
    await user.type(screen.getAllByLabelText("Project name")[1], "Project a");
    await user.click(screen.getAllByRole("button", { name: "Delete permanently" })[1]);
  }
  await go(router, "/");
  api.getBoard.mockImplementationOnce(() => new Promise((resolve) => { staleLoad = resolve; }));
  await go(router, "/projects/a");
  const oldBoard = current;
  current = operation === "delete" ? null : { ...current, is_archived: operation === "archive" };
  await act(async () => finish(current));
  expect(await screen.findByRole("heading", { name: operation === "delete" ? "Project not found" : "Project a" })).toBeVisible();
  await act(async () => staleLoad(oldBoard));
  expect(router.state.location.pathname).toBe("/projects/a");
  if (operation === "archive") {
    expect(screen.getByText(/This project is archived/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add task", exact: true })).not.toBeInTheDocument();
  } else if (operation === "restore") {
    expect(screen.queryByText(/This project is archived/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add task", exact: true })[0]).toBeEnabled();
  } else expect(screen.getByRole("heading", { name: "Project not found" })).toBeVisible();
});

it("does not let a late label save cancel the next route's board load", async () => {
  const { router, user } = setup("/projects/a/settings");
  let saveLabel, loadBoard;
  vi.spyOn(api, "createLabel").mockImplementation(() => new Promise((resolve) => { saveLabel = resolve; }));
  await user.click(await screen.findByRole("button", { name: /Labels 0/ }));
  await user.type(screen.getByLabelText("New label"), "Old project label");
  await user.click(screen.getByRole("button", { name: "Create label" }));
  api.getBoard.mockImplementationOnce(() => new Promise((resolve) => { loadBoard = resolve; }));
  await go(router, "/projects/b");
  await act(async () => saveLabel({ id: "label-a", name: "Old project label" }));
  await act(async () => loadBoard(board("b")));
  expect(await screen.findByRole("heading", { name: "Project b" })).toBeVisible();
  expect(api.getBoard.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
});
