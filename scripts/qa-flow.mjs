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

async function ensureDashboardProgress(page, expectedText) {
  const progressPill = page.getByText(expectedText);
  if ((await progressPill.count()) === 0) {
    logBug(
      "high",
      "Dashboard progress mismatch",
      `Dashboard shows '${expectedText}'`,
      "Expected progress pill text was not found",
      "Open /dashboard after completing tasks and inspect progress text",
    );
  }
}

async function run() {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

  await page.goto(`${baseUrl}/demo/expenses`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputDir, "05-expenses-demo.png"), fullPage: true });
  await page.getByRole("button", { name: "Runbook Assistant" }).click();
  await page.screenshot({
    path: path.join(outputDir, "06-expenses-widget-open.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mark Complete" }).click();

  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(outputDir, "07-dashboard-after-completion.png"),
    fullPage: true,
  });
  await ensureDashboardProgress(page, "Progress: 2/2 tasks complete");

  await browser.close();

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
        `| ${bug.severity} | ${bug.title} | ${bug.expected} | ${bug.actual} | ${bug.repro} |`,
      );
    }
  }

  await fs.writeFile(bugLogPath, lines.join("\n"));
}

run();
