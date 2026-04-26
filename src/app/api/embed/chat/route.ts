import { NextRequest, NextResponse } from "next/server";
import { generateFromGemini } from "@/lib/ai";
import { EMBED_CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import { retrieveDocsForEmbed } from "@/lib/embedRetrieval";
import { resolveProjectFromApiKey } from "@/lib/embedStore";
import { checkEmbedRateLimit } from "@/lib/embedRateLimit";
import { NORTHSTAR_DEMO_PROJECT_ID } from "@/lib/embedDemoKnowledge";
import { isServerLlmConfigured, runNorthstarEmbedChat } from "@/lib/embedNorthstarChat";
import {
  bulletsFromText,
  clipWords,
  DEFAULT_FALLBACK_BULLETS,
  DEFAULT_SUGGESTIONS,
  MAX_ANSWER_WORDS,
  MAX_SOURCES,
  normalizeBullets,
  normalizeSteps,
  normalizeSuggestions
} from "@/lib/embedStructured";

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
    return actual.hostname === allowed.hostname || actual.hostname.endsWith(`.${allowed.hostname}`);
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
  hoveredFeature?: unknown;
  appState?: unknown;
};

type StructuredChatPayload = {
  answer: string;
  bullets: string[];
  steps: string[];
  sources: { title: string; excerpt?: string; url?: string }[];
  suggestions: string[];
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
  const hovered = sanitizeHoveredFeature(body.hoveredFeature);
  const appState =
    body.appState && typeof body.appState === "object" ? JSON.stringify(body.appState).slice(0, 400) : "(none)";
  const pageBody = typeof body.pageContext === "string" ? body.pageContext.trim() : "";
  const pageSection = [
    "Page context:",
    `Page URL: ${body.pageUrl || "n/a"}`,
    `Page title: ${body.pageTitle || "n/a"}`,
    pageBody || "(none)"
  ].join("\n");
  const hoverSection = ["Hovered feature context:", hovered || "(none)"].join("\n");
  const appStateSection = ["App state:", appState].join("\n");
  if (typeof body.pageContext === "string" && body.pageContext.trim()) {
    return [pageSection, appStateSection, hoverSection].join("\n\n");
  }
  return [pageSection, appStateSection, hoverSection].join("\n\n");
}

function sanitizeHoveredFeature(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  const asStr = (v: unknown, limit: number): string =>
    (typeof v === "string" ? v : "")
      .replace(/[\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  const feature = asStr(obj.feature, 120);
  const title = asStr(obj.title, 120);
  const description = asStr(obj.description, 400);
  const joined = [title || feature, description].filter(Boolean).join(" — ");
  return joined.slice(0, 520);
}

function normalizeStructured(payload: Partial<StructuredChatPayload>): StructuredChatPayload {
  const normalizedBullets = normalizeBullets(payload.bullets || []);
  const fallbackBullets = payload.answer ? bulletsFromText(String(payload.answer)) : DEFAULT_FALLBACK_BULLETS;
  return {
    answer: clipWords(payload.answer || "Here is what you can do next.", MAX_ANSWER_WORDS),
    bullets: normalizedBullets.length > 0 ? normalizedBullets : normalizeBullets(fallbackBullets),
    steps: normalizeSteps(payload.steps || []),
    sources: (payload.sources || []).slice(0, MAX_SOURCES),
    suggestions: normalizeSuggestions(payload.suggestions || DEFAULT_SUGGESTIONS)
  };
}

function parseStructuredFromRaw(raw: string): Partial<StructuredChatPayload> {
  const trimmed = raw.trim();
  const idx = trimmed.lastIndexOf("RUNBOOK_JSON:");
  if (idx >= 0) {
    const prose = trimmed.slice(0, idx).trim();
    const jsonPart = trimmed.slice(idx + "RUNBOOK_JSON:".length).trim();
    try {
      const parsed = JSON.parse(jsonPart) as Partial<StructuredChatPayload>;
      return parsed;
    } catch {
      return { answer: prose, bullets: bulletsFromText(prose) };
    }
  }
  return { answer: trimmed, bullets: bulletsFromText(trimmed) };
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
    const payload = await runNorthstarEmbedChat({
      message,
      pageContext,
      hoveredFeature: sanitizeHoveredFeature(body.hoveredFeature),
      customSources
    });
    return NextResponse.json(normalizeStructured(payload), { headers: corsHeaders(origin) });
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

  const hoveredFeature = sanitizeHoveredFeature(body.hoveredFeature);
  const userPrompt = `Repository: ${project.githubRepoFullName} (default branch hint: ${project.defaultBranch})
Answer priority:
1) Current page context
2) Hovered feature details
3) Repository sources
Only use repository context for deeper explanation.

Page context:
${pageContext || "(not provided)"}
Hovered feature context:
${hoveredFeature || "(none)"}

Indexed sources:
${context || "(no indexed chunks yet)"}

User question: ${message}
Return compact JSON on one final line:
RUNBOOK_JSON: {"answer":"<=10 words","bullets":["<=12 words"],"steps":["2-4 concise steps"],"suggestions":["Guide me step-by-step","Explain this page","What can I do next?"]}`;

  const baseSources = retrieved.map((r) => ({
    title: r.doc.title,
    excerpt: r.doc.content.replace(/\s+/g, " ").trim().slice(0, 220),
    url: r.doc.url || undefined
  }));

  if (!isServerLlmConfigured()) {
    return NextResponse.json(
      normalizeStructured({
        answer: "AI setup missing; use docs mode for now.",
        bullets: ["Connect knowledge in Studio", "Index repository chunks", "Set GEMINI_API_KEY or OPENAI_API_KEY"],
        sources: baseSources,
        steps: ["Connect knowledge in Studio.", "Run repository indexing.", "Add AI key and retry."]
      }),
      { headers: corsHeaders(origin) }
    );
  }

  try {
    const raw = await generateFromGemini(EMBED_CHAT_SYSTEM_PROMPT, userPrompt);
    const parsed = parseStructuredFromRaw(raw);
    const normalized = normalizeStructured({
      ...parsed,
      bullets: parsed.bullets && parsed.bullets.length > 0 ? parsed.bullets : bulletsFromText(parsed.answer || ""),
      steps:
        parsed.steps && parsed.steps.length > 0
          ? parsed.steps
          : ["Review highlighted sources.", "Follow the next action.", "Ask follow-up if blocked."],
      sources: baseSources
    });

    return NextResponse.json(normalized, { headers: corsHeaders(origin) });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      normalizeStructured({
        answer: "AI unavailable; showing grounded fallback.",
        bullets: ["Use source cards below", "Follow step mode checklist", "Retry in a moment"],
        sources: baseSources,
        steps: ["Review the top source card.", "Complete the first checklist step.", "Retry your question."]
      }),
      { status: 503, headers: corsHeaders(origin) }
    );
  }
}
