import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettingsPage } from "./ProjectSettingsPage";

const project = { id: "project-1", name: "Launch", description: "Ship it", labels: [{ id: "label-1", name: "Frontend", colour: "#6574C9" }] };

function renderSettings(onLabels = vi.fn(), lifecycle = {}) {
  render(<ProjectSettingsPage project={project} onBack={vi.fn()} onSave={vi.fn()} onLabels={onLabels} onGetArchiveSummary={lifecycle.onGetArchiveSummary ?? vi.fn().mockResolvedValue({ total_tasks: 3, completed_tasks: 1, incomplete_tasks: 2 })} onArchive={lifecycle.onArchive ?? vi.fn()} onRestore={lifecycle.onRestore ?? vi.fn()} onDelete={lifecycle.onDelete ?? vi.fn()} />);
}

describe("ProjectSettingsPage label mutations", () => {
  afterEach(cleanup);

  it("reports a failed label creation instead of silently clearing the draft", async () => {
    const user = userEvent.setup();
    renderSettings(vi.fn().mockRejectedValue(new Error("offline")));

    await user.click(screen.getByRole("button", { name: /Labels 1/ }));
    await user.type(screen.getByLabelText("New label"), "Design");
    await user.click(screen.getByRole("button", { name: "Create label" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not create that label");
    expect(screen.getByLabelText("New label")).toHaveValue("Design");
  });

  it("restores the old label name when a rename fails", async () => {
    const user = userEvent.setup();
    renderSettings(vi.fn().mockRejectedValue(new Error("offline")));

    await user.click(screen.getByRole("button", { name: /Labels 1/ }));
    const renameInput = screen.getByLabelText("Rename Frontend");
    await user.clear(renameInput);
    await user.type(renameInput, "UI");
    await user.tab();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("previous name was restored"));
    expect(renameInput).toHaveValue("Frontend");
  });

  it("shows incomplete task counts and requires an archive confirmation", async () => {
    const user = userEvent.setup(); const onGetArchiveSummary = vi.fn().mockResolvedValue({ total_tasks: 3, completed_tasks: 1, incomplete_tasks: 2 }); const onArchive = vi.fn().mockResolvedValue();
    renderSettings(vi.fn(), { onGetArchiveSummary, onArchive });

    await user.click(screen.getAllByRole("button", { name: "Archive project" })[0]);
    expect(await screen.findByText("2 incomplete of 3 tasks will remain on this read-only board.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
    expect(onGetArchiveSummary).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it("requires the exact project name before permanent deletion", async () => {
    const user = userEvent.setup(); const onDelete = vi.fn().mockResolvedValue();
    renderSettings(vi.fn(), { onDelete });

    await user.click(screen.getByRole("button", { name: "Delete permanently" }));
    const deleteButton = screen.getAllByRole("button", { name: "Delete permanently" })[1];
    expect(deleteButton).toBeDisabled();
    await user.type(screen.getAllByRole("textbox", { name: "Project name" })[1], "Launch");
    await user.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith("Launch");
  });
});

it("asks again when archive recovery changes the incomplete-task warning", async () => {
  const user = userEvent.setup();
  const onArchive = vi.fn().mockRejectedValueOnce(new Error("confirmation required")).mockResolvedValue();
  const onGetArchiveSummary = vi.fn().mockResolvedValueOnce({ total_tasks: 1, incomplete_tasks: 0 }).mockResolvedValueOnce({ total_tasks: 1, incomplete_tasks: 1 });
  renderSettings(vi.fn(), { onArchive, onGetArchiveSummary });
  try {
    await user.click(screen.getByRole("button", { name: "Archive project" }));
    expect(await screen.findByText("All 1 tasks are complete.")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
    expect(onArchive).toHaveBeenNthCalledWith(1, false);
    expect(await screen.findByText("1 incomplete of 1 tasks will remain on this read-only board.")).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Archive project" })[1]);
    expect(onArchive).toHaveBeenNthCalledWith(2, true);
  } finally { cleanup(); }
});
