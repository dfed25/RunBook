// src/app/api/widget/route.ts
// Called by the Chrome extension with the current page URL + text.
// Returns the most relevant onboarding task and steps for that page.

import { NextRequest, NextResponse } from "next/server";
import { demoDocs } from "@/lib/demoDocs";
import { generateFromGemini } from "@/lib/ai";

function fallbackTaskFromUrlOrText(url: string, pageText: string) {
  const haystack = `${url}\n${pageText}`.toLowerCase();
  let hostname = "";
  let pathname = "";
  try {
    const parsedUrl = new URL(url);
    hostname = parsedUrl.hostname.toLowerCase();
    pathname = parsedUrl.pathname.toLowerCase();
  } catch {
    // keep hostname/pathname empty
  }
  const isGitHubHost = hostname === "github.com" || hostname.endsWith(".github.com");
  const isSlackHost = hostname === "slack.com" || hostname.endsWith(".slack.com");
  const isRampHost = hostname === "ramp.com" || hostname.endsWith(".ramp.com");
  const isDemoGitHubPath = pathname.startsWith("/demo/github");
  const isDemoExpensesPath = pathname.startsWith("/demo/expenses");

  if (
    isGitHubHost &&
    (haystack.includes("followers") ||
      haystack.includes("following") ||
      haystack.includes("contributions") ||
      haystack.includes("repositories"))
  ) {
    return {
      found: true,
      task: {
        taskId: "github-profile-setup",
        taskTitle: "Review your GitHub profile setup",
        steps: [
          {
            text: "Open the Repositories tab to verify your public projects are visible.",
            selector: null,
          },
          {
            text: "Open the Stars tab and star one onboarding-related repository to bookmark it.",
            selector: null,
          },
          {
            text: "Open your profile edit/settings controls to update your bio or profile details.",
            selector: null,
          },
        ],
      },
    };
  }

  if (
    isDemoGitHubPath ||
    isGitHubHost ||
    haystack.includes("#eng-access") ||
    haystack.includes("request github access")
  ) {
    return {
      found: true,
      task: {
        taskId: "github-access",
        taskTitle: "Request GitHub access",
        steps: [
          { text: "Open the access request flow and submit your GitHub username.", selector: null },
          { text: "Confirm manager approval, then post your request in #eng-access.", selector: null },
        ],
      },
    };
  }

  if (
    isSlackHost ||
    haystack.includes("#eng-onboarding") ||
    haystack.includes("#dev-help") ||
    haystack.includes("join required slack")
  ) {
    return {
      found: true,
      task: {
        taskId: "join-slack-channels",
        taskTitle: "Join required Slack onboarding channels",
        steps: [
          { text: "Join #eng-onboarding for setup announcements and first-week milestones.", selector: null },
          { text: "Join #dev-help so you can ask unblocker questions quickly.", selector: null },
          { text: "Join #eng-access for GitHub and system access requests.", selector: null },
        ],
      },
    };
  }

  if (
    isDemoExpensesPath ||
    isRampHost ||
    haystack.includes("expense report") ||
    haystack.includes("reimbursement")
  ) {
    return {
      found: true,
      task: {
        taskId: "expense-policy",
        taskTitle: "Submit your first expense report",
        steps: [
          { text: "Open the reimbursement form and enter the expense details.", selector: null },
          { text: "Attach a receipt for expenses over $25 before submitting.", selector: null },
        ],
      },
    };
  }

  return { found: false };
}

function parseJsonObject(raw: string) {
  const cleaned = String(raw || "").replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function cleanInstructionText(input: unknown, fallback: string) {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return fallback;
  return text.slice(0, 240);
}

async function generateWidgetJson(
  systemPrompt: string,
  userPrompt: string,
): Promise<unknown | null> {
  try {
    const responseText = await generateFromGemini(systemPrompt, userPrompt);
    return parseJsonObject(responseText);
  } catch (error) {
    console.error("/api/widget model error:", error);
    return null;
  }
}

const SYSTEM_PROMPT = `You are Runbook, an AI onboarding copilot.
A new employee has a Chrome extension running on their browser.
You receive the URL and visible text of the page they are on.
Your job is to figure out if any of their onboarding tasks are relevant to this page,
and if so, return a structured task with step-by-step guidance.

Company onboarding docs:
${demoDocs.map((d) => `--- ${d.title} ---\n${d.content}`).join("\n\n")}

Respond ONLY with a JSON object. No prose, no markdown fences.
If the page is relevant to an onboarding task:
{
  "found": true,
  "task": {
    "taskId": "slug-of-task",
    "taskTitle": "Short task name",
    "steps": [
      {
        "text": "One clear sentence telling the user exactly what to do on this step.",
        "selector": null
      }
    ]
  }
}
If the page is not relevant to any onboarding task:
{ "found": false }

Rules:
- Steps should be 2-4 items maximum.
- Each step text should be a single concrete instruction.
- selector should always be null (the frontend handles highlighting for demo pages).
- Do not hallucinate steps not supported by the company docs.`;

export async function POST(req: NextRequest) {
  try {
    const { url, pageText, taskTitle, taskDescription, interactiveElements } =
      await req.json();

    if (!url || !pageText) {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    const widgetSecret = process.env.WIDGET_SHARED_SECRET?.trim();
    if (widgetSecret) {
      const providedSecret = req.headers.get("x-runbook-widget-secret")?.trim();
      if (!providedSecret || providedSecret !== widgetSecret) {
        return NextResponse.json({ found: false }, { status: 401 });
      }
    }

    if (String(pageText).length > 30000 || String(taskDescription || "").length > 4000) {
      return NextResponse.json({ found: false }, { status: 400 });
    }

    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(String(url));
    } catch {
      return NextResponse.json({ found: false }, { status: 400 });
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    if (pathname.startsWith("/demo/github")) {
      return NextResponse.json({
        found: true,
        task: {
          taskId: "github-access",
          taskTitle: "Request GitHub access",
          steps: [
            { text: "Click Request Access to submit your onboarding request.", selector: null },
            { text: "Confirm manager approval and the repositories you need.", selector: null },
          ],
        },
      });
    }

    if (pathname.startsWith("/demo/expenses")) {
      return NextResponse.json({
        found: true,
        task: {
          taskId: "expense-policy",
          taskTitle: "Submit your first expense report",
          steps: [
            { text: "Open the expense form and enter the reimbursement details.", selector: null },
            { text: "Attach receipt evidence before submitting.", selector: null },
          ],
        },
      });
    }

    if (taskTitle && taskDescription) {
      if (
        !hostname ||
        ["localhost", "127.0.0.1"].includes(hostname) ||
        hostname.endsWith(".local")
      ) {
        // allow internal/demo/test domains and continue
      }
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({
          found: false,
          elementText: "",
          instruction: "Scan this page again after AI is configured.",
        });
      }

      const finderPrompt = `The user is trying to complete this onboarding task: ${taskTitle}. ${taskDescription}

Here is the text content of the page they are on:
${String(pageText).slice(0, 5000)}

Likely clickable elements shown on the page:
${Array.isArray(interactiveElements) ? interactiveElements.slice(0, 120).join(" | ") : "N/A"}

Return ONLY valid JSON with this exact shape:
{
  "found": true,
  "elementText": "exact text of the button or link they should click",
  "instruction": "one sentence telling them what to do"
}

If you cannot confidently find a specific target, return:
{
  "found": false,
  "elementText": "",
  "instruction": "A short fallback instruction."
}`;

      const parsed =
        (await generateWidgetJson(
          `You are Runbook's page action locator.
Respond only with JSON.
Never include markdown fences.
Keep instruction concise.`,
          finderPrompt,
        )) as
          | { found?: boolean; elementText?: string; instruction?: string }
          | null;

      const safeParsed =
        parsed ??
        { found: false, elementText: "", instruction: "Try scanning this page again." };

      return NextResponse.json({
        found: !!safeParsed.found,
        elementText:
          typeof safeParsed.elementText === "string"
            ? safeParsed.elementText.slice(0, 200)
            : "",
        instruction: cleanInstructionText(
          safeParsed.instruction,
          "Try scanning this page again.",
        ),
      });
    }

    const userMessage = `The employee is on this page:
URL: ${url}
Page content (first 3000 chars):
${String(pageText).slice(0, 3000)}

Is any onboarding task relevant here? If yes, return the task and steps.`;

    let parsed = (await generateWidgetJson(SYSTEM_PROMPT, userMessage)) as
      | { found?: boolean; task?: unknown }
      | null;
    if (!parsed) {
      parsed = fallbackTaskFromUrlOrText(String(url), String(pageText)) as {
        found?: boolean;
        task?: unknown;
      };
    }

    if (!parsed?.found || !parsed?.task) {
      const fallback = fallbackTaskFromUrlOrText(String(url), String(pageText));
      if (fallback.found) {
        parsed = fallback as { found?: boolean; task?: unknown };
      }
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("/api/widget error:", err);
    return NextResponse.json({ found: false }, { status: 500 });
  }
}
