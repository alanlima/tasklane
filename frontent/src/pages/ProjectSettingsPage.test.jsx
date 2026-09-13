import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettingsPage } from "./ProjectSettingsPage";

const project = { id: "project-1", name: "Launch", description: "Ship it", labels: [{ id: "label-1", name: "Frontend", colour: "#6574C9" }] };

function renderSettings(onLabels = vi.fn()) {
  render(<ProjectSettingsPage project={project} onBack={vi.fn()} onSave={vi.fn()} onLabels={onLabels} />);
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
});
