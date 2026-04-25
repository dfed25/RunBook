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

function parseProgressText(rawText) {
  const match = String(rawText).match(/(\d+)\s*\/\s*(\d+)\s*tasks complete/i);
  if (!match) return null;
  return { completed: Number(match[1]), total: Number(match[2]) };
}

async function getDashboardProgress(page) {
  const text = await page.getByTestId("dashboard-progress").innerText();
  const parsed = parseProgressText(text);
  if (!parsed) {
    throw new Error(`Could not parse dashboard progress text: "${text}"`);
  }
  return parsed;
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
    const before = await getDashboardProgress(page);

    const todoTask = page
      .locator("li")
      .filter({ has: page.locator("span", { hasText: /^Todo$/ }) })
      .first();
    if ((await todoTask.count()) === 0) {
      logBug(
        "medium",
        "No todo task available",
        "At least one task in Todo status",
        "Could not find any Todo tasks to complete in dashboard checklist",
        "Open /dashboard and verify seeded tasks contain at least one Todo item",
      );
    } else {
      await todoTask.getByRole("button", { name: "Mark Complete" }).click();
      try {
        await page.waitForFunction(
          (expectedCompleted) => {
            const el = document.querySelector('[data-testid="dashboard-progress"]');
            if (!el) return false;
            const m = el.textContent?.match(/(\d+)\s*\/\s*(\d+)\s*tasks complete/i);
            if (!m) return false;
            return Number(m[1]) >= expectedCompleted;
          },
          before.completed + 1,
          { timeout: 15000 },
        );
      } catch {
        const afterText = await page.getByTestId("dashboard-progress").innerText();
        logBug(
          "high",
          "Dashboard progress did not increase",
          `Completed tasks should increase from ${before.completed}`,
          `Progress text after marking complete: "${afterText}"`,
          "Open /dashboard, mark a Todo task complete, and verify progress increments",
        );
      }
    }

    await page.screenshot({
      path: path.join(outputDir, "03-dashboard-after-completion.png"),
      fullPage: true,
    });
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
