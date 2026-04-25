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
      body: slide.body || "No details available for this step.",
      speakerNotes: slide.speakerNotes || slide.body || "Review the references in this slide.",
      citations: Array.isArray(slide.citations) ? slide.citations : [],
      estimatedDurationSec: Math.max(10, Math.min(120, slide.estimatedDurationSec || 28)),
      visualHint: slide.visualHint || "abstract gradient background",
    })),
    sourcesUsed: Array.isArray(lesson.sourcesUsed) ? lesson.sourcesUsed : [],
    narrationScript: lesson.narrationScript || normalizedSlides.map((s) => `${s.title}. ${s.body}`).join("\n"),
  };
}

function fallbackLesson(question: string, limitedSources: boolean): Lesson {
  return {
    title: "Guided Walkthrough",
    summary: "This fallback lesson gives you a practical path while highlighting any missing context.",
    confidence: "partial",
    limitedSources,
    question,
    sourcesUsed: [{ title: "First Week Onboarding Plan" }],
    slides: [
      {
        title: "Clarify the goal",
        body: `Question: ${question}`,
        speakerNotes: "Start by restating the exact outcome you need so the process stays focused.",
        citations: ["First Week Onboarding Plan"],
        estimatedDurationSec: 15,
        visualHint: "simple title card with checklist icon",
      },
      {
        title: "Gather references",
        body: "Open the most relevant onboarding docs and identify the exact system, policy, or tool involved.",
        speakerNotes: "Collect references before acting so each step stays grounded in source docs.",
        citations: ["First Week Onboarding Plan"],
        estimatedDurationSec: 20,
        visualHint: "document stack illustration",
      },
      {
        title: "Execute in sequence",
        body: "Perform the steps in order, and pause if you hit a gap that is not documented.",
        speakerNotes: "Use a strict step order and avoid assumptions when details are missing.",
        citations: ["First Week Onboarding Plan"],
        estimatedDurationSec: 20,
        visualHint: "numbered timeline style",
      },
      {
        title: "Escalate unknowns",
        body: "If a required detail is missing, ask your manager or the owning team channel before proceeding.",
        speakerNotes: "Escalating unknowns early prevents errors and keeps onboarding safe.",
        citations: ["First Week Onboarding Plan"],
        estimatedDurationSec: 18,
        visualHint: "help/support icon over abstract background",
      },
    ],
    narrationScript:
      "Here is your guided walkthrough. First, clarify the exact goal. Next, gather references. Then execute the process in sequence. Finally, escalate any unknowns to the owning team.",
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
      return NextResponse.json(fallbackLesson(question, context.limitedSources));
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
      return NextResponse.json(fallbackLesson(question, context.limitedSources));
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate lesson" }, { status: 500 });
  }
}
