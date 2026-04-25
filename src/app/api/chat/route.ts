import { NextResponse } from "next/server";
import { retrieveDocs } from "@/lib/retrieval";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { ChatResponse, ChatSource } from "@/lib/types";

// Static fallbacks for the 5 core demo questions
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = body.question || "";
    const qLower = question.toLowerCase().trim().replace(/[?!.]$/, "");

    // P3-5: Static fallback check
    for (const [key, fallback] of Object.entries(FALLBACKS)) {
      if (qLower.includes(key.replace(/[?!.]$/, ""))) {
        return NextResponse.json(fallback);
      }
    }

    // P3-2 & P3-4: Retrieve docs
    const docs = retrieveDocs(question);
    const sources: ChatSource[] = docs.map(d => ({ title: d.title, excerpt: d.content.substring(0, 150) + "..." }));
    
    const context = docs.map(d => `Document Title: ${d.title}\nContent:\n${d.content}`).join("\n\n");

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
       // Return fallback if API key is not configured, to keep demo alive
       return NextResponse.json({
         answer: "API Key not found, falling back. Could not process your exact request. Please refer to the initial tasks.",
         sources
       });
    }

    // Call Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json"
       },
       body: JSON.stringify({
         contents: [
           { role: "user", parts: [{ text: `${CHAT_SYSTEM_PROMPT}\n\nCompany Context:\n${context}\n\nUser Question: ${question}` }] }
         ]
       })
    });

    if (!response.ok) {
       const err = await response.text();
       console.error("Gemini error:", err);
       return NextResponse.json({ answer: "Runbook AI is temporarily unavailable.", sources }, { status: 500 });
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, an unexpected API structure was returned.";

    return NextResponse.json({
      answer,
      sources
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
