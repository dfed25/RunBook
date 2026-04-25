import { NextResponse } from "next/server";
import { demoDocs } from "@/lib/demoDocs";
import { LESSON_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";

// P3-12 Static fallback lesson
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const docId = body.docId || "engineering-setup";

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(STATIC_LESSON);
    }

    const doc = demoDocs.find(d => d.id === docId);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json"
       },
       body: JSON.stringify({
         contents: [
           { role: "user", parts: [{ text: `${LESSON_GENERATION_SYSTEM_PROMPT}\n\nDocument Title: ${doc.title}\nContent:\n${doc.content}\n\nGenerate the micro-lesson.` }] }
         ]
       })
    });

    if (!response.ok) {
       console.error("Gemini error:", await response.text());
       return NextResponse.json(STATIC_LESSON);
    }

    const data = await response.json();
    const msgText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    
    try {
       const jsonStr = msgText.replace(/```json/g, "").replace(/```/g, "").trim();
       const parsedLesson = JSON.parse(jsonStr);
       return NextResponse.json(parsedLesson);
    } catch(e) {
       console.error("Failed to parse JSON lesson:", e);
       return NextResponse.json(STATIC_LESSON);
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json(STATIC_LESSON);
  }
}
