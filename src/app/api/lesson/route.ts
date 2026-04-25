import { NextResponse } from "next/server";
import { demoDocs } from "@/lib/demoDocs";
import { LESSON_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { generateJsonFromGemini } from "@/lib/ai";
import { Lesson } from "@/lib/types";
import { retrieveDocs } from "@/lib/retrieval";

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

    const selectedDoc = await resolveLessonDoc(docId, body.query, hireId);
    if (!selectedDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(STATIC_LESSON);
    }

    const userPrompt = `Document Title: ${selectedDoc.title}\nContent:\n${selectedDoc.content}\n\nGenerate the micro-lesson.`;
    
    try {
      const parsedLesson = await generateJsonFromGemini<Lesson>(LESSON_GENERATION_SYSTEM_PROMPT, userPrompt);
      return NextResponse.json(parsedLesson);
    } catch (e) {
      console.error("Lesson API Gemini Error:", e);
      return NextResponse.json(STATIC_LESSON);
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json(STATIC_LESSON);
  }
}
