/**
 * Demo flow QA: screenshots + QA_BUG_LOG.md in repo root.
 *
 * Prerequisites:
 *   - App running (e.g. `npm run dev`) or set `BASE_URL` to a deployed URL.
 *   - One-time browser install: `npx playwright install chromium`
 *
 * Run: `npm run qa:flow` or `node scripts/qa-flow.mjs`
 */

import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const outputDir = path.resolve("screenshots");
const bugLogPath = path.resolve("QA_BUG_LOG.md");

const bugs = [];

function logBug(severity, title, expected, actual, repro) {
  bugs.push({ severity, title, expected, actual, repro });
}

function escapeMarkdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function ensureDashboardProgress(page, expectedText) {
  try {
    await page.getByText(expectedText).waitFor({ state: "visible", timeout: 5000 });
  } catch {
    logBug(
      "high",
      "Dashboard progress mismatch",
      `Dashboard shows '${expectedText}'`,
      "Expected progress pill text was not visible within timeout",
      "Open /dashboard after completing tasks and inspect progress text",
    );
  }
}

async function writeBugLog() {
  const lines = [
    "# QA Bug Log",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];

  if (bugs.length === 0) {
    lines.push("No bugs found in this run.");
  } else {
    lines.push("| Severity | Title | Expected | Actual | Repro |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const bug of bugs) {
      lines.push(
        `| ${escapeMarkdownCell(bug.severity)} | ${escapeMarkdownCell(bug.title)} | ${escapeMarkdownCell(bug.expected)} | ${escapeMarkdownCell(bug.actual)} | ${escapeMarkdownCell(bug.repro)} |`,
      );
    }
  }

  await fs.mkdir(path.dirname(bugLogPath), { recursive: true });
  await fs.writeFile(bugLogPath, lines.join("\n"));
}

async function run() {
  await fs.mkdir(outputDir, { recursive: true });
  let browser;
  let context;
  try {
    browser = await chromium.launch();
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outputDir, "01-home.png"), fullPage: true });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(outputDir, "02-dashboard-before-completion.png"),
      fullPage: true,
    });
    await ensureDashboardProgress(page, "Progress: 0/2 tasks complete");

    await page.goto(`${baseUrl}/demo/github`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outputDir, "03-github-demo.png"), fullPage: true });
    await page.getByRole("button", { name: "Runbook Assistant" }).click();
    await page.screenshot({
      path: path.join(outputDir, "04-github-widget-open.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mark Complete" }).click();
    await page.getByRole("button", { name: "Task Completed" }).waitFor({ state: "visible" });

    await page.goto(`${baseUrl}/demo/expenses`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(outputDir, "05-expenses-demo.png"), fullPage: true });
    await page.getByRole("button", { name: "Runbook Assistant" }).click();
    await page.screenshot({
      path: path.join(outputDir, "06-expenses-widget-open.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mark Complete" }).click();
    await page.getByRole("button", { name: "Task Completed" }).waitFor({ state: "visible" });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: path.join(outputDir, "07-dashboard-after-completion.png"),
      fullPage: true,
    });
    await ensureDashboardProgress(page, "Progress: 2/2 tasks complete");
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }

  await writeBugLog();

  if (bugs.length > 0) {
    console.error(`QA flow completed with ${bugs.length} bug(s). See ${bugLogPath}.`);
    process.exitCode = 1;
  }
}

run().catch(async (err) => {
  logBug(
    "critical",
    "QA flow crashed",
    "Script completes",
    String(err?.stack ?? err),
    "Re-run npm run qa:flow after fixing the error",
  );
  await writeBugLog().catch(() => {});
  console.error(err);
  process.exitCode = 1;
});
