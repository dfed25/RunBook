import { NextResponse } from "next/server";
import { demoDocs } from "@/lib/demoDocs";
import { LESSON_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { generateFromGemini } from "@/lib/ai";
import { Lesson } from "@/lib/types";
import { retrieveDocs } from "@/lib/retrieval";
import { requireHireAccess } from "@/lib/apiAuth";
import { getTasks } from "@/lib/dataStore";

const MAX_CONTEXT_CHARS = 18_000;

function stripScopeTokens(content: string): string {
  return content
    .split("\n")
    .filter((line) => !/^\s*\[hire:[^\]]+\]\s*$/.test(line))
    .join("\n")
    .trim();
}

function cleanLessonText(value: string): string {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/^MIME:.*$/gim, "")
    .replace(/^\s*am\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asWalkthroughBody(body: string): string {
  const text = cleanLessonText(body);
  if (!text) return "Objective:\nComplete this step.\n\nSteps:\n1. Follow the referenced source guidance.\n\nVerification:\n- Confirm expected outcome.";
  if (/Objective:|Steps:|Verification:|If blocked:/i.test(text)) return text;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] || text;
  const remaining = lines.slice(1).join("\n");
  return [
    "Objective:",
    first,
    "",
    "Steps:",
    remaining ? `1. ${remaining.replace(/\n/g, "\n2. ")}` : "1. Follow the task instructions in order.",
    "",
    "Verification:",
    "- Expected result appears and task can be marked complete.",
  ].join("\n");
}

function normalizeLesson(lesson: Lesson, question: string, limitedSources: boolean): Lesson {
  const normalizedSlides = Array.isArray(lesson.slides) ? lesson.slides : [];
  if (normalizedSlides.length === 0) {
    return fallbackLesson(question, limitedSources);
  }
  return {
    ...lesson,
    title: lesson.title || "Guided Walkthrough",
    summary: lesson.summary || "Generated walkthrough based on available company docs.",
    confidence: lesson.confidence === "high" ? "high" : "partial",
    limitedSources: lesson.limitedSources ?? limitedSources,
    question,
    slides: normalizedSlides.slice(0, 14).map((slide, index) => ({
      title: slide.title || `Step ${index + 1}`,
      body: asWalkthroughBody(String(slide.body || "No details available for this step.")),
      speakerNotes: cleanLessonText(String(slide.speakerNotes || slide.body || "Review the references in this slide.")),
      citations: Array.isArray(slide.citations) ? slide.citations : [],
      estimatedDurationSec: Math.max(10, Math.min(120, slide.estimatedDurationSec || 28)),
      visualHint: slide.visualHint || "abstract gradient background",
    })),
    sourcesUsed: Array.isArray(lesson.sourcesUsed) ? lesson.sourcesUsed : [],
    narrationScript: lesson.narrationScript || normalizedSlides.map((s) => `${s.title}. ${s.body}`).join("\n"),
    warning: lesson.warning,
  };
}

function fallbackLesson(
  question: string,
  limitedSources: boolean,
  context?: {
    tasks?: Array<{ title: string; description: string; status: string; sourceTitle: string; estimatedTime: string }>;
    docs?: Array<{ title: string; url?: string; content: string }>;
  }
): Lesson {
  const tasks = context?.tasks || [];
  const docs = context?.docs || [];
  const topTasks = tasks.slice(0, 4);
  const docA = docs[0];
  const sourceTitles = Array.from(
    new Set([
      ...topTasks.map((t) => t.sourceTitle),
      ...docs.slice(0, 4).map((d) => d.title),
      "First Week Onboarding Plan",
    ])
  ).filter(Boolean);

  const taskBlock =
    topTasks.length > 0
      ? topTasks
          .map(
            (task, i) =>
              `${i + 1}. ${task.title} [${task.status}] · ETA ${task.estimatedTime}\n- Action: ${task.description}\n- Source: ${task.sourceTitle}`
          )
          .join("\n\n")
      : "No assigned tasks were found for this hire.";

  const referenceBlock = docs.length
    ? docs
        .slice(0, 3)
        .map((doc, i) => `${i + 1}. ${doc.title}${doc.url ? ` (${doc.url})` : ""}`)
        .join("\n")
    : "No retrieved docs were available for this question.";
  const sanitizedDocSnippet = cleanLessonText(docA?.content || "No additional doc snippets available.")
    .slice(0, 320)
    .trim();

  return {
    title: "Question-Grounded Walkthrough",
    summary:
      "Gemini is temporarily unavailable, so this lesson is generated from your assigned tasks and retrieved onboarding sources.",
    confidence: "partial",
    limitedSources,
    question,
    sourcesUsed: sourceTitles.map((title) => ({ title })),
    slides: [
      {
        title: "Question focus",
        body: `Objective:\nAnswer: ${question}\n\nSteps:\n1. Execute the prioritized tasks in order.\n2. Validate each outcome before moving to the next step.\n3. Escalate blockers with concrete evidence.\n\nVerification:\n- You can clearly explain what to do next and why.`,
        speakerNotes: "Restate the goal and align the walkthrough to what the user asked.",
        citations: sourceTitles.slice(0, 2),
        estimatedDurationSec: 15,
        visualHint: "simple title card with checklist icon",
      },
      {
        title: "Task execution plan",
        body: `Objective:\nComplete the highest-impact onboarding tasks first.\n\nSteps:\n${taskBlock}\n\nVerification:\n- Each completed task has evidence (screenshot, output, or system status).`,
        speakerNotes: "Follow tasks in order, starting with the highest-priority open item.",
        citations: sourceTitles.slice(0, 3),
        estimatedDurationSec: 28,
        visualHint: "timeline icon",
      },
      {
        title: "Use docs for exact steps",
        body: `Objective:\nUse canonical docs to avoid guessing.\n\nSteps:\n1. Check these primary references:\n${referenceBlock}\n2. Copy exact commands/channels/policy names from source.\n3. Update your task notes with source-backed decisions.\n\nVerification:\n- Every major action maps to at least one cited source.`,
        speakerNotes: "Cross-check each step against source docs before marking tasks complete.",
        citations: sourceTitles.slice(0, 4),
        estimatedDurationSec: 24,
        visualHint: "document stack illustration",
      },
      {
        title: "Verification checkpoints",
        body:
          "Objective:\nPrevent silent setup mistakes.\n\nSteps:\n1. Confirm expected output/result is visible.\n2. Update task status immediately.\n3. Capture blocker details with exact error text.\n\nVerification:\n- You can show proof for each completed step.",
        speakerNotes: "Verification prevents hidden mistakes and keeps progress measurable.",
        citations: sourceTitles.slice(0, 2),
        estimatedDurationSec: 20,
        visualHint: "checklist icon",
      },
      {
        title: "Troubleshooting and escalation",
        body:
          `Objective:\nEscalate fast when blocked and keep momentum.\n\nSteps:\n1. Capture exact failing step + full error text.\n2. Attach related task + source reference.\n3. Post in the owning channel/manager thread with reproducible context.\n\nIf blocked:\n- Include environment, command run, and observed vs expected behavior.\n\nKnown context sample:\n${sanitizedDocSnippet}...`,
        speakerNotes: "Escalating unknowns early prevents errors and keeps onboarding safe.",
        citations: sourceTitles.slice(0, 4),
        estimatedDurationSec: 22,
        visualHint: "help/support icon over abstract background",
      },
    ],
    narrationScript:
      "This walkthrough is generated from your tasks and available docs. Start with question focus, execute the ordered task plan, use source docs for exact details, verify each step, then escalate blockers with context.",
  };
}

type LessonContext = {
  question: string;
  docs: Array<{ title: string; url?: string; content: string }>;
  tasks: Array<{ title: string; description: string; status: string; sourceTitle: string; estimatedTime: string }>;
  limitedSources: boolean;
};

function questionKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 20);
}

function scoreTaskAgainstQuestion(task: { title: string; description: string; sourceTitle: string }, keywords: string[]): number {
  const hay = `${task.title} ${task.description} ${task.sourceTitle}`.toLowerCase();
  let score = 0;
  for (const key of keywords) {
    if (hay.includes(key)) score += 1;
  }
  return score;
}

function parseLessonJson(raw: string): Lesson {
  const direct = raw.trim().replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(direct) as Lesson;
  } catch {
    const firstBrace = direct.indexOf("{");
    const lastBrace = direct.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = direct.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced) as Lesson;
    }
    throw new Error("Model output did not contain parseable lesson JSON.");
  }
}

async function buildLessonContext(question: string, docId: string, hireId?: string): Promise<LessonContext> {
  const keywords = questionKeywords(question);
  const tasks = hireId
    ? (await getTasks())
        .filter((task) => task.assigneeId === hireId)
        .map((task) => ({
          title: task.title,
          description: task.description,
          status: task.status,
          sourceTitle: task.sourceTitle,
          estimatedTime: task.estimatedTime,
          score: scoreTaskAgainstQuestion(task, keywords),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((task) => ({
          title: task.title,
          description: task.description,
          status: task.status,
          sourceTitle: task.sourceTitle,
          estimatedTime: task.estimatedTime,
        }))
    : [];
  const retrieved = await retrieveDocs(question, hireId);
  const docs = retrieved
    .sort((a, b) => b.score - a.score)
    .map((r) => ({
      title: r.doc.title.replace(/^\[hire:[^\]]+\]\s*/i, "").trim() || r.doc.title,
      url: r.doc.url || undefined,
      content: stripScopeTokens(r.doc.content),
    }));

  const packed: Array<{ title: string; url?: string; content: string }> = [];
  let budget = 0;
  for (const doc of docs) {
    const block = `${doc.title}\n${doc.content}`;
    if (budget + block.length > MAX_CONTEXT_CHARS) continue;
    packed.push(doc);
    budget += block.length;
  }

  if (packed.length > 0) {
    return { question, docs: packed, tasks, limitedSources: false };
  }

  const staticDoc = demoDocs.find((d) => d.id === docId) || demoDocs[0];
  return {
    question,
    limitedSources: true,
    docs: [
      {
        title: staticDoc.title,
        content: staticDoc.content.trim(),
      },
    ],
    tasks,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const docId = body.docId || "engineering-setup";
    const hireId = typeof body.hireId === "string" ? body.hireId : undefined;
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    if (hireId) {
      const auth = await requireHireAccess(hireId);
      if (!auth.ok) {
        return NextResponse.json(
          { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
          { status: auth.status }
        );
      }
    }

    const context = await buildLessonContext(question, docId, hireId);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(fallbackLesson(question, context.limitedSources, context));
    }

    const contextText = context.docs
      .map((doc, index) => {
        const urlLine = doc.url ? `URL: ${doc.url}` : "URL: N/A";
        return `[Source ${index + 1}] ${doc.title}\n${urlLine}\nContent:\n${doc.content}`;
      })
      .join("\n\n");
    const taskContext = context.tasks.length
      ? context.tasks
          .map(
            (task, idx) =>
              `${idx + 1}. ${task.title} [${task.status}] · ETA ${task.estimatedTime}\nDescription: ${task.description}\nSource: ${task.sourceTitle}`
          )
          .join("\n\n")
      : "No hire tasks available.";
    const userPrompt = `User question:\n${question}\n\nRelevant assigned tasks:\n${taskContext}\n\nAvailable sources:\n${contextText}\n\nGenerate a grounded, in-depth walkthrough lesson that directly answers this specific question and teaches execution end-to-end. The first slide must be a \"Question focus\" slide that restates the user goal in concrete terms, and the action slides should prioritize relevant assigned tasks when present.`;
    
    try {
      const raw = await generateFromGemini(LESSON_GENERATION_SYSTEM_PROMPT, userPrompt);
      const parsedLesson = parseLessonJson(raw);
      return NextResponse.json(normalizeLesson(parsedLesson, question, context.limitedSources));
    } catch (e) {
      console.error("Lesson API Gemini Error:", e);
      const fallback = fallbackLesson(question, context.limitedSources, context);
      const message = e instanceof Error ? e.message : String(e);
      if (/insufficient_quota|openai/i.test(message)) {
        fallback.warning =
          "Both AI providers are currently unavailable (OpenAI quota exhausted and Gemini unavailable/quota-limited). Showing a task/doc grounded fallback walkthrough.";
      } else if (/API key not valid|API key expired|RESOURCE_EXHAUSTED|quota/i.test(message)) {
        fallback.warning =
          "Gemini is unavailable (invalid key or quota), and no usable fallback provider responded. Showing a task/doc grounded fallback walkthrough.";
      } else {
        fallback.warning = "AI generation failed, showing a fallback walkthrough from tasks/docs.";
      }
      return NextResponse.json(fallback);
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
