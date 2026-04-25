import { NextResponse } from "next/server";
import { demoDocs } from "@/lib/demoDocs";
import { LESSON_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { generateFromGemini } from "@/lib/ai";
import { Lesson } from "@/lib/types";
import { retrieveDocs } from "@/lib/retrieval";
import { requireHireAccess } from "@/lib/apiAuth";
import { getTasks } from "@/lib/dataStore";

/**
 * Minimum similarity score threshold for selecting a document as a lesson source.
 * Prevents weak matches from being used as lesson content.
 */
const MIN_LESSON_SCORE = 0.3;

const STATIC_LESSON = {
  title: "Engineering Setup Basic Training",
  summary: "Welcome! This quick lesson walks you through getting your engineering environment ready.",
  slides: [
    { title: "Join Slack Channels", body: "Join #eng-onboarding, #dev-help, and #eng-access so you don't miss important updates." },
    { title: "GitHub Access", body: "Ask your manager for approval, then post in #eng-access." },
    { title: "Clone the Repo", body: "Run 'npm install' then 'npm run dev'." },
    { title: "Seek Help", body: "Stuck? Ask in #dev-help and tag your buddy." },
    { title: "First PR", body: "Your first task is a small documentation PR to get familiar with our deployment pipeline." }
  ],
  narrationScript: "Welcome! Today we will go over the Engineering Setup Guide. First..."
};

async function resolveLessonDoc(docId: string, query: unknown, hireId?: string) {
  const staticDoc = demoDocs.find((d) => d.id === docId);
  if (staticDoc) return staticDoc;
  if (!query) return undefined;
  
  // Retrieve documents and filter by minimum score to ensure quality
  const retrieved = await retrieveDocs(String(query), hireId);
  const qualified = retrieved.find((r) => r.score >= MIN_LESSON_SCORE);
  return qualified?.doc;
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

    if (!hireId) {
      return NextResponse.json({ error: "hireId is required" }, { status: 400 });
    }
    const auth = await requireHireAccess(hireId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
        { status: auth.status }
      );
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
