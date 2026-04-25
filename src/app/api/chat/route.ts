import { NextResponse } from "next/server";
import { retrieveDocs } from "@/lib/retrieval";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { ChatResponse, ChatSource } from "@/lib/types";
import { generateFromGemini } from "@/lib/ai";
import { requireHireAccess } from "@/lib/apiAuth";

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

    const fallbackKeys = Object.keys(FALLBACKS).sort((a, b) => b.length - a.length);
    for (const key of fallbackKeys) {
      const normalizedKey = key.replace(/[?!.]$/, "");
      const regex = new RegExp(`\\b${escapeRegExp(normalizedKey)}\\b`);
      if (regex.test(qLower) || qLower === normalizedKey) {
        return NextResponse.json(FALLBACKS[key]);
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
      const userPrompt = `Company Context:\n${context || "No context found."}\n\nUser Question: ${question}\n\nWrite the answer in clear, scannable markdown: use "## " section headings, "- " bullets or numbered steps where appropriate, and **bold** for key terms. Ground every claim in the sources above.`;
      const answer = await generateFromGemini(CHAT_SYSTEM_PROMPT, userPrompt);
      return NextResponse.json({ answer, sources });
    } catch (e) {
      console.error("Chat API Gemini Error:", e);
      const errorText = e instanceof Error ? e.message : String(e);
      const isQuotaError =
        /RESOURCE_EXHAUSTED|quota|429|rate[- ]?limit/i.test(errorText);
      const fallbackAnswer = isQuotaError
        ? "Runbook hit model quota temporarily. I can still help using retrieved docs, but answers may be less detailed for the next minute."
        : "Runbook AI is temporarily unavailable. I can still provide a best-effort response from retrieved docs.";

      if (sources.length > 0) {
        const top = sources.slice(0, 3);
        const summarized = top
          .map((s, idx) => `${idx + 1}. ${s.title}: ${s.excerpt}`)
          .join("\n");
        return NextResponse.json({
          answer: `${fallbackAnswer}\n\nRelevant references:\n${summarized}`,
          sources: top,
        });
      }

      return NextResponse.json({
        answer: fallbackAnswer,
        sources: [],
      });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
