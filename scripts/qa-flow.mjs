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
/** Must match STORAGE_KEY in src/lib/taskStatusAdapter.ts */
const TASK_STATUS_STORAGE_KEY = "runbook-task-statuses";

const bugs = [];

function logBug(severity, title, expected, actual, repro) {
  bugs.push({ severity, title, expected, actual, repro });
}

function escapeMarkdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function ensureDashboardProgress(page, expectedText) {
  const normalize = (s) => String(s).replace(/\s+/g, " ").trim();
  const want = normalize(expectedText);
  try {
    await page.waitForFunction(
      ([key, expected]) => {
        const el = document.querySelector(`[data-testid="${key}"]`);
        if (!el) return false;
        const got = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return got === expected;
      },
      ["dashboard-progress", want],
      { timeout: 15000 },
    );
  } catch (err) {
    let actual = "unknown";
    try {
      actual = normalize(await page.getByTestId("dashboard-progress").innerText());
    } catch {
      actual = String(err?.message ?? err);
    }
    logBug(
      "high",
      "Dashboard progress mismatch",
      `Dashboard shows '${expectedText}'`,
      `Got '${actual}' (progress pill not ready or wrong text)`,
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

    // "networkidle" is flaky with Next.js (long-lived connections); "load" + explicit waits are stable.
    const nav = { waitUntil: "load" };

    await page.goto(baseUrl, nav);
    await page.evaluate((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }, TASK_STATUS_STORAGE_KEY);
    await page.screenshot({ path: path.join(outputDir, "01-home.png"), fullPage: true });

    await page.goto(`${baseUrl}/dashboard`, nav);
    await page.screenshot({
      path: path.join(outputDir, "02-dashboard-before-completion.png"),
      fullPage: true,
    });
    await ensureDashboardProgress(page, "Progress: 0/2 tasks complete");

    await page.goto(`${baseUrl}/demo/github`, nav);
    await page.screenshot({ path: path.join(outputDir, "03-github-demo.png"), fullPage: true });
    await page.getByRole("button", { name: "Runbook Assistant" }).click();
    await page.screenshot({
      path: path.join(outputDir, "04-github-widget-open.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mark Complete" }).click();
    await page.getByRole("button", { name: "Task Completed" }).waitFor({ state: "visible" });

    await page.goto(`${baseUrl}/demo/expenses`, nav);
    await page.screenshot({ path: path.join(outputDir, "05-expenses-demo.png"), fullPage: true });
    await page.getByRole("button", { name: "Runbook Assistant" }).click();
    await page.screenshot({
      path: path.join(outputDir, "06-expenses-widget-open.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Mark Complete" }).click();
    await page.getByRole("button", { name: "Task Completed" }).waitFor({ state: "visible" });

    await page.goto(`${baseUrl}/dashboard`, nav);
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
  } else {
    console.log(
      `QA flow passed (0 bugs). Wrote ${bugLogPath} and screenshots under ${outputDir}.`,
    );
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
