import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const appUrl = process.env.TASKLANE_APP_URL ?? "http://127.0.0.1:5173";
const outputDirectory = resolve(import.meta.dirname, "../../_docs/screenshots");
const executablePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });

await page.goto(appUrl, { waitUntil: "networkidle" });
await page.screenshot({ path: resolve(outputDirectory, "projects-dashboard.png"), fullPage: true });

await page.getByRole("button", { name: /Tasklane Development/ }).click();
await page.getByText("Project board", { exact: true }).waitFor();
await page.screenshot({ path: resolve(outputDirectory, "kanban-board.png"), fullPage: true });

await browser.close();
