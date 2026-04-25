import { NextResponse } from "next/server";
import { retrieveDocs } from "@/lib/retrieval";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { ChatResponse, ChatSource } from "@/lib/types";
import { generateFromGemini } from "@/lib/ai";
import { requireHireAccess } from "@/lib/apiAuth";
import { getTasks } from "@/lib/dataStore";

const FALLBACKS: Record<string, ChatResponse> = {
  "what should i do on my first day?": {
    answer: "On your first day, you should complete your HR profile, join the required Slack channels, meet your manager, and review the company handbook.",
    sources: [{ title: "First Week Onboarding Plan", excerpt: "Day 1: Complete HR profile, join Slack, meet your manager, and review the company handbook." }]
  },
  "how do i get github access?": {
    answer: "To get GitHub access, ask your manager to approve your account and then post a request in #eng-access.",
    sources: [{ title: "Engineering Setup Guide", excerpt: "To get GitHub access, ask your manager for approval and post in #eng-access." }]
  },
  "how do i submit an expense?": {
    answer: "Employees must submit expenses within 14 days. Use the Ramp reimbursement form. Receipts are required for any expense over $25, and manager approval is needed for expenses over $100.",
    sources: [{ title: "Expense Policy", excerpt: "Employees must submit expenses within 14 days. Receipts are required for expenses over $25. Expenses over $100 need manager approval. Use the Ramp reimbursement form." }]
  },
  "what security rules do i need to follow?": {
    answer: "You must enable two-factor authentication, avoid pasting passwords or secrets in Slack/email/GitHub, use the company password manager, and report suspicious emails to #security. As an engineer, you must also complete security training before merging production code.",
    sources: [{ title: "Security Policy", excerpt: "All employees must enable two-factor authentication. Do not paste passwords, API keys, tokens, or secrets..." }]
  },
  "who do i ask if i am stuck setting up the repo?": {
    answer: "If you get stuck setting up the repo, ask in #dev-help and tag your assigned onboarding buddy.",
    sources: [{ title: "Engineering Setup Guide", excerpt: "If stuck, ask in #dev-help and tag your onboarding buddy." }]
  }
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTaskIntent(question: string): boolean {
  const q = question.toLowerCase();
  return /(\btask\b|\btasks\b|my task|assigned|checklist|what should i do|how do i do)/.test(q);
}

/** Strip hire scope lines and collapse whitespace for compact source previews. */
function excerptForChatSource(content: string, maxLen: number): string {
  const lines = (content || "").split("\n").filter((line) => !/^\[hire:[^\]]+\]$/.test(line.trim()));
  const body = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!body) return "";
  return body.length > maxLen ? `${body.slice(0, maxLen)}…` : body;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = body.question || "";
    const hireId = typeof body.hireId === "string" ? body.hireId : undefined;
    if (hireId) {
      const auth = await requireHireAccess(hireId);
      if (!auth.ok) {
        return NextResponse.json(
          { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
          { status: auth.status }
        );
      }
    }
    const qLower = question.toLowerCase().trim().replace(/[?!.]$/, "");
    const taskIntent = isTaskIntent(qLower);

    const fallbackKeys = Object.keys(FALLBACKS).sort((a, b) => b.length - a.length);
    if (!hireId || !taskIntent) {
      for (const key of fallbackKeys) {
        const normalizedKey = key.replace(/[?!.]$/, "");
        const regex = new RegExp(`\\b${escapeRegExp(normalizedKey)}\\b`);
        if (regex.test(qLower) || qLower === normalizedKey) {
          return NextResponse.json(FALLBACKS[key]);
        }
      }
    }

    const retrieved = await retrieveDocs(question, hireId);
    // NOTE: `match_documents` uses cosine *distance* semantics; similarity scores are not guaranteed to be > 0.
    const validDocs = retrieved
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((r) => r.doc);

    const sources: ChatSource[] = validDocs.map((d) => ({
      title: d.title.replace(/^\[hire:[^\]]+\]\s*/i, "").trim() || d.title,
      excerpt: excerptForChatSource(d.content || "", 260),
      url: d.url || undefined,
    }));
    let taskContext = "No assigned tasks available.";
    if (hireId) {
      const allTasks = await getTasks();
      const hireTasks = allTasks
        .filter((task) => task.assigneeId === hireId)
        .slice(0, 18);
      if (hireTasks.length > 0) {
        taskContext = hireTasks
          .map((task, index) => {
            const guidedLines: string[] = [];
            if (task.appName) guidedLines.push(`App/tool label: ${task.appName}`);
            if (task.appUrl) guidedLines.push(`In-app guidance URL: ${task.appUrl}`);
            if (task.actionSteps?.length) {
              guidedLines.push(
                `Guided steps:\n${task.actionSteps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`,
              );
            }
            if (typeof task.currentStep === "number") {
              guidedLines.push(`Current guided step index (0-based): ${task.currentStep}`);
            }
            const guidedBlock =
              guidedLines.length > 0 ? `\n${guidedLines.join("\n")}` : "";
            return `${index + 1}. ${task.title} [${task.status}] · ETA ${task.estimatedTime}\nDescription: ${task.description}\nSource: ${task.sourceTitle}${guidedBlock}`;
          })
          .join("\n\n");
        sources.unshift({
          title: "Assigned onboarding tasks",
          excerpt: `Loaded ${hireTasks.length} tasks for this hire and used them to produce a step-by-step response.`,
        });
      }
    }
    const context = validDocs
      .map(
        (d, index) =>
          `[Source ${index + 1}] Title: ${d.title}\nProvider: ${d.provider}\nURL: ${d.url || "N/A"}\nContent:\n${d.content}`
      )
      .join("\n\n");

    if (!process.env.GEMINI_API_KEY) {
       return NextResponse.json({
         answer: "API Key not found, falling back. Could not process your exact request. Please refer to the initial tasks.",
         sources: sources.length > 0 ? sources : []
       });
    }

    try {
      const userPrompt = `Assigned Tasks (for selected hire):\n${taskContext}\n\nCompany Context:\n${context || "No context found."}\n\nUser Question: ${question}\n\nWrite the answer in clear, scannable markdown. Ground every claim in the Assigned Tasks block and/or company sources.\n\nIf the question asks what they should do or how to complete work: (1) Prefer the task's guided steps, app/tool labels, and in-app URLs when present; (2) use numbered steps; (3) include a short "## Apps / tools" section naming specific products; (4) end with "## Sources" listing relevant source titles from the context.`;
      const answer = await generateFromGemini(CHAT_SYSTEM_PROMPT, userPrompt);
      return NextResponse.json({ answer, sources });
    } catch (e) {
      console.error("Chat API Gemini Error:", e);
      return NextResponse.json({ answer: "Runbook AI is temporarily unavailable.", sources }, { status: 500 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
