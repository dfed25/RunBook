import { NextRequest, NextResponse } from "next/server";
import { generateFromGemini } from "@/lib/ai";
import { EMBED_CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { retrieveDocsForEmbed } from "@/lib/embedRetrieval";
import { resolveProjectFromApiKey } from "@/lib/embedStore";
import { checkEmbedRateLimit } from "@/lib/embedRateLimit";
import { NORTHSTAR_DEMO_PROJECT_ID } from "@/lib/embedDemoKnowledge";
import { isServerLlmConfigured, runNorthstarEmbedChat } from "@/lib/embedNorthstarChat";

export const runtime = "nodejs";

function corsHeaders(originAllow: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin"
  };
  if (originAllow) {
    headers["Access-Control-Allow-Origin"] = originAllow;
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

function originAllowed(projectSite: string | undefined, origin: string | null): boolean {
  if (!projectSite || !origin) return true;
  try {
    const allowed = new URL(projectSite.includes("://") ? projectSite : `https://${projectSite}`);
    const actual = new URL(origin);
    return allowed.hostname === actual.hostname;
  } catch {
    return false;
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin)
  });
}

type ChatBody = {
  projectId?: string;
  message?: string;
  question?: string;
  pageContext?: string;
  pageUrl?: string;
  pageTitle?: string;
  /** Optional manual sources from Studio (demo only). */
  customSources?: unknown;
  /** Optional imported repository docs from Studio/embed demo. */
  documents?: unknown;
};

function sanitizeCustomSources(raw: unknown): { title: string; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { title: string; content: string }[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? "").trim().slice(0, 200);
    const content = String(o.content ?? "").trim().slice(0, 12_000);
    if (title.length === 0 || content.length === 0) continue;
    out.push({ title, content });
  }
  return out;
}

function sanitizeDocuments(raw: unknown): { title: string; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { title: string; content: string }[] = [];
  for (const item of raw.slice(0, 24)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const path = String(o.path ?? "").trim();
    const titleFromPath = path.length > 0 ? path : "Imported document";
    const title = String(o.title ?? titleFromPath).trim().slice(0, 260);
    const content = String(o.content ?? "").trim().slice(0, 20_000);
    if (!title || !content) continue;
    out.push({ title, content });
  }
  return out;
}

function normalizePageContext(body: ChatBody): string {
  if (typeof body.pageContext === "string" && body.pageContext.trim()) {
    return body.pageContext.trim();
  }
  const parts = [body.pageUrl, body.pageTitle].filter(Boolean) as string[];
  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(origin) });
  }

  const projectId = String(body.projectId || "").trim();
  const message = String(body.message || body.question || "").trim();
  const pageContext = normalizePageContext(body);
  const requestDocs = sanitizeDocuments(body.documents);

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400, headers: corsHeaders(origin) });
  }

  /** Public demo/import path — no Bearer key; rate limit by project bucket */
  if (projectId === NORTHSTAR_DEMO_PROJECT_ID || requestDocs.length > 0) {
    const rl = checkEmbedRateLimit(`${projectId || "public"}-public`);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limited", retryAfter: rl.retryAfter },
        { status: 429, headers: { ...corsHeaders(origin), "Retry-After": String(rl.retryAfter) } }
      );
    }

    const customSources = [...sanitizeCustomSources(body.customSources), ...requestDocs];
    const payload = await runNorthstarEmbedChat({ message, pageContext, customSources });
    return NextResponse.json({ ...payload, mode: "demo" }, { headers: corsHeaders(origin) });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401, headers: corsHeaders(origin) });
  }

  const resolved = await resolveProjectFromApiKey(token);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers: corsHeaders(origin) });
  }

  const { project, keyId } = resolved;
  if (!originAllowed(project.siteUrl, origin)) {
    return NextResponse.json({ error: "Origin not allowed for this project" }, { status: 403, headers: corsHeaders(origin) });
  }

  const rl = checkEmbedRateLimit(keyId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limited", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...corsHeaders(origin), "Retry-After": String(rl.retryAfter) } }
    );
  }

  if (projectId !== project.id) {
    return NextResponse.json({ error: "projectId does not match API key" }, { status: 403, headers: corsHeaders(origin) });
  }

  const retrieved = await retrieveDocsForEmbed(message, project.id);
  const context = retrieved
    .map(
      (r, i) =>
        `[Source ${i + 1}] ${r.doc.title}\nURL: ${r.doc.url || "n/a"}\n${r.doc.content}`
    )
    .join("\n\n");

  const userPrompt = `Repository: ${project.githubRepoFullName} (default branch hint: ${project.defaultBranch})
Page context:
${pageContext || "(not provided)"}

Indexed sources:
${context || "(no indexed chunks yet)"}

User question: ${message}

If this is an onboarding/how-to question, infer the concrete user journey from the indexed code/docs: identify entry UI, exact actions, and what success looks like after each action.
Also output 3-6 short imperative steps as a JSON array string at the very end on its own line prefixed exactly with RUNBOOK_STEPS_JSON: e.g. RUNBOOK_STEPS_JSON: ["step1","step2"]`;

  const baseSources = retrieved.map((r) => ({
    title: r.doc.title,
    excerpt: r.doc.content.replace(/\s+/g, " ").trim().slice(0, 220),
    url: r.doc.url || undefined
  }));

  if (!isServerLlmConfigured()) {
    return NextResponse.json(
      {
        answer:
          "AI is not configured. Set GEMINI_API_KEY and/or OPENAI_API_KEY in .env.local for grounded answers from your indexed repository.",
        sources: baseSources,
        mode: "fallback",
        steps: [
          "Connect knowledge in Runbook Studio.",
          "Run **Index repository** so chunks exist in the vector store.",
          "Add GEMINI_API_KEY or OPENAI_API_KEY, then ask again."
        ]
      },
      { headers: corsHeaders(origin) }
    );
  }

  try {
    const raw = await generateFromGemini(EMBED_CHAT_SYSTEM_PROMPT, userPrompt);
    let answer = raw.trim();
    let steps: string[] = [];
    const idx = answer.lastIndexOf("RUNBOOK_STEPS_JSON:");
    if (idx >= 0) {
      const jsonPart = answer.slice(idx + "RUNBOOK_STEPS_JSON:".length).trim();
      answer = answer.slice(0, idx).trim();
      try {
        const parsed = JSON.parse(jsonPart) as unknown;
        if (Array.isArray(parsed)) {
          steps = parsed.filter((x): x is string => typeof x === "string");
        }
      } catch {
        /* ignore */
      }
    }
    if (steps.length === 0) {
      steps = ["Review the sources below for exact policy text.", "If anything is unclear, ask your team lead."];
    }

    return NextResponse.json(
      {
        answer,
        sources: baseSources,
        mode: "live",
        steps
      },
      { headers: corsHeaders(origin) }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        answer:
          "Runbook AI is temporarily unavailable. I can still guide you from indexed docs below while full reasoning recovers.",
        sources: baseSources,
        mode: "fallback",
        steps: [
          "Open the most relevant source below and confirm the exact policy text.",
          "Follow the documented path in order, then retry this question for a deeper walkthrough.",
          "If the action is still blocked, share the exact error message with your onboarding owner."
        ]
      },
      { headers: corsHeaders(origin) }
    );
  }
}
