import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskDrawer } from "./TaskDrawer";

const project = {
  columns: [{ id: "backlog", name: "Backlog" }],
  labels: [{ id: "label-1", name: "Frontend", colour: "#6574C9" }],
};

const task = {
  id: "task-1", title: "Design labels", columnId: "backlog", priority: "None",
  points: null, dueDate: "", description: "", labelIds: [], checklist: [],
};

function renderDrawer(overrides = {}) {
  const props = {
    project, task, onClose: vi.fn(), onSave: vi.fn(), onToggleChecklistItem: vi.fn(),
    onCreateChecklistItem: vi.fn(), onCreateLabel: vi.fn().mockResolvedValue({ id: "label-2", name: "Design", colour: "#35685B" }), ...overrides,
  };
  render(<TaskDrawer {...props} />);
  return props;
}

describe("TaskDrawer labels", () => {
  afterEach(cleanup);

  it("uses visible in-drawer suggestions instead of a browser datalist", async () => {
    const user = userEvent.setup();
    renderDrawer();

    expect(document.querySelector("datalist")).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Search labels" }), "Front");
    expect(within(screen.getByLabelText("Matching labels")).getByRole("button", { name: "Frontend" })).toBeVisible();
  });

  it("creates and assigns a label when the typed name does not exist", async () => {
    const user = userEvent.setup();
    const props = renderDrawer();

    await user.type(screen.getByRole("textbox", { name: "Search labels" }), "Design");
    await user.click(screen.getByRole("button", { name: "Create “Design”" }));

    expect(props.onCreateLabel).toHaveBeenCalledWith("Design");
    expect(props.onSave).toHaveBeenCalledWith("task-1", { labelIds: ["label-2"] });
  });
});
