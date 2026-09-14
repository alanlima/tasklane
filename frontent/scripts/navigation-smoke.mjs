import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.TASKLANE_URL ?? "http://localhost:5173";
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const owned = new Map();
async function api(path, data, method = "POST") {
  const response = await context.request.fetch(`/api${path}`, { method, data });
  assert.ok(response.ok(), `${method} ${path}: ${await response.text()}`);
  return response.status() === 204 ? null : response.json();
}
const path = (project) => `/projects/${project.id}`;
async function at(expected) { await page.waitForURL(`${baseURL}${expected}`); }
try {
  for (const suffix of ["A", "B"]) {
    const project = await api("/projects", { name: `Navigation smoke ${Date.now()} ${suffix}`, description: "Disposable navigation verification" });
    owned.set(project.id, project);
  }
  const [a, b] = [...owned.values()];
  const board = await api(`${path(a)}/board`, undefined, "GET");
  await api(`${path(a)}/tasks`, { title: "Keyboard drawer verification", column_id: board.columns[0].id, description: "Persisted task details" });
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(a.name) }).click(); await at(path(a));
  await page.getByRole("heading", { name: a.name }).waitFor();
  await page.getByRole("button", { name: "Settings", exact: true }).click(); await at(`${path(a)}/settings`);
  await page.reload();
  await page.getByRole("heading", { name: "General", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Project name", { exact: true }).inputValue(), a.name);
  await page.goBack(); await at(path(a));
  await page.getByRole("heading", { name: a.name }).waitFor();
  await page.goForward(); await at(`${path(a)}/settings`);
  await page.getByRole("button", { name: "Back to board" }).click(); await at(path(a));
  await page.reload(); await page.getByRole("heading", { name: a.name }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "H1");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "BUTTON");
  const card = page.getByRole("button", { name: "Keyboard drawer verification", exact: true });
  await card.focus(); await page.keyboard.press("Enter");
  assert.equal(await page.locator("textarea.description").inputValue(), "Persisted task details");
  await page.getByRole("button", { name: "Close task details" }).click();
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.locator(".board-scroll").evaluate((element) => element.scrollWidth > element.clientWidth));
    await page.locator(".board-scroll").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    assert.ok(await page.locator(".board-scroll").evaluate((element) => element.scrollLeft > 0));
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Tasklane", exact: true }).click(); await at("/");
  await page.getByRole("button", { name: new RegExp(b.name) }).click(); await at(path(b));
  await page.goBack(); await at("/"); await page.goBack(); await at(path(a));
  await page.getByRole("heading", { name: a.name }).waitFor();
  const fresh = await context.newPage();
  for (const route of [path(b), `${path(b)}/settings`]) {
    const response = await fresh.goto(route);
    assert.equal(response.status(), 200);
    await fresh.getByRole("heading", { name: route.endsWith("settings") ? "General" : b.name, exact: true }).waitFor();
  }
  await fresh.close();
  await page.route(`**/api${path(a)}/board`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }), { times: 1 });
  await page.goto(path(a));
  await page.getByRole("heading", { name: "Could not load this project" }).waitFor();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("heading", { name: a.name }).waitFor();
  await page.goto(`${path(b)}/settings`);
  await page.getByRole("button", { name: "Archive project", exact: true }).click();
  await page.getByRole("heading", { name: `Archive ${b.name}?`, exact: true }).waitFor();
  await page.getByRole("button", { name: "Archive project", exact: true }).last().click(); await at("/");
  await page.getByRole("button", { name: /Archived projects/ }).click();
  await page.getByRole("button", { name: new RegExp(b.name) }).click(); await at(path(b));
  await page.getByText("This project is archived.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Restore project", exact: true }).click();
  await page.getByRole("button", { name: "Archive project", exact: true }).waitFor(); await at(`${path(b)}/settings`);
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).last().fill(b.name);
  await page.getByRole("button", { name: "Delete permanently", exact: true }).last().click(); await at("/");
  owned.delete(b.id);
  await page.goBack(); await at(path(b));
  await page.getByRole("heading", { name: "Project not found" }).waitFor();
  await page.goto("/unknown/navigation/path");
  await page.getByRole("heading", { name: "Page not found" }).waitFor();
  await page.getByRole("link", { name: "Back to Projects" }).click(); await at("/");
  assert.deepEqual(errors, []);
  console.log("PASS: URL changes, reloads, fresh-tab production deep links, Back/Forward across projects/settings, keyboard focus/drawer, responsive scrolling, retry, archive/restore/delete routes, deleted history, unknown paths; zero page errors.");
} finally {
  for (const project of owned.values()) await api(path(project), { confirmation_name: project.name }, "DELETE");
  await browser.close();
}
