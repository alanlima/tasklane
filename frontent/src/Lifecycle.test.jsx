import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { api } from "./services/mockApi";

const project = { id: "p1", name: "Launch", description: "Ship", columns: [{ id: "c1", name: "Backlog" }], tasks: [{ id: "t1", title: "Read me", description: "Archived description", columnId: "c1", priority: "High", points: 3, dueDate: "2026-10-01", labelIds: ["l1"], checklist: [{ id: "i1", title: "Checklist contents", done: true }] }], labels: [{ id: "l1", name: "Design", colour: "#35685B" }] };
function setup(archived = false) {
  let current = { ...project, is_archived: archived };
  vi.spyOn(api, "listProjects").mockImplementation(async () => [current]);
  vi.spyOn(api, "getBoard").mockImplementation(async () => current);
  vi.spyOn(api, "getArchiveSummary").mockResolvedValue({ total_tasks: 1, incomplete_tasks: 1 });
  vi.spyOn(api, "archiveProject").mockImplementation(async () => { current = { ...current, is_archived: true }; });
  vi.spyOn(api, "restoreProject").mockImplementation(async () => { current = { ...current, is_archived: false }; return current; });
  vi.spyOn(api, "deleteProject").mockResolvedValue();
  render(<App />);
  return userEvent.setup();
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open(user, archived = false) {
  if (archived) await user.click(await screen.findByRole("button", { name: /Archived projects/ }));
  await user.click(await screen.findByRole("button", { name: /Launch/ }));
  await screen.findByText("Project board");
}
it("opens archived task details with readable fields and no mutations", async () => {
  const user = setup(true);
  const update = vi.spyOn(api, "updateTask");
  await open(user, true);
  const card = screen.getByRole("button", { name: /Read me/ });
  card.focus(); await user.keyboard("{Enter}");
  expect(screen.getByDisplayValue("Archived description")).toHaveAttribute("readonly");
  expect(screen.getByText("Checklist contents")).toBeVisible();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.getByLabelText("Priority")).toBeDisabled();
  expect(screen.getByLabelText("Status")).toBeDisabled();
  expect(screen.getByLabelText("Story points")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Due date")).toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: "Design" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Add checklist item" })).not.toBeInTheDocument();
  await user.click(screen.getByLabelText("Task title")); await user.tab();
  expect(update).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Close task details" }));
  expect(screen.queryByText("Task details")).not.toBeInTheDocument();
});
it.each(["archive", "delete"])("opens the next project board after %s", async (action) => {
  const user = setup(); await open(user);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  if (action === "archive") {
    await user.click(screen.getByRole("button", { name: "Archive project" }));
    await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
  } else {
    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    await user.type(screen.getAllByLabelText("Project name")[1], "Launch");
    await user.click(screen.getAllByRole("button", { name: "Delete permanently" })[1]);
  }
  await screen.findByText("Workspace");
  await open(user, action === "archive");
  expect(screen.queryByText("Project settings", { selector: "p" })).not.toBeInTheDocument();
});
it("enables archive and delete immediately after restoring", async () => {
  const user = setup(true); await open(user, true);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  await user.click(screen.getByRole("button", { name: "Restore project" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Archive project" })).toBeEnabled());
  expect(screen.getByRole("button", { name: "Delete permanently" })).toBeEnabled();
});
