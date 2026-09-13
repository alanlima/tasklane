import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { api } from "./services/mockApi";

async function renderApp() {
  render(<App />);
  await screen.findByRole("heading", { name: "Projects" });
}

describe("Tasklane frontend", () => {
  beforeEach(() => api.reset());
  afterEach(cleanup);

  it("creates a project and opens its board", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Project name"), "Launch plan");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Project board")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Launch plan" })).toBeInTheDocument();
  });

  it("opens a board, creates a task, and exposes task details", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: /Tasklane Development/ }));
    expect(await screen.findByText("Project board")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Add task" })[0]);
    await user.type(screen.getByLabelText("Task title"), "Write launch notes");
    await user.click(screen.getByRole("button", { name: "Create task" }));
    expect(await screen.findByText("Write launch notes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Build project dashboard/ }));
    expect(await screen.findByText("Task details")).toBeInTheDocument();
    const drawer = screen.getByText("Task details").closest("aside");
    expect(within(drawer).getByLabelText("Priority")).toHaveValue("High");
  });
});
