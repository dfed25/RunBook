import { generateFromGemini } from "./ai";
import { demoDocs } from "./demoDocs";
import type { SourceDoc } from "./types";
import { buildNorthstarDemoResponse, type DemoChatResult } from "./embedDemoKnowledge";
import { retrieveKeywordSources } from "./embedKeywordRetrieval";

const NORTHSTAR_SYSTEM = `You are Runbook, an embedded in-app onboarding assistant for the "Northstar AI" demo product.
Use ONLY the knowledge excerpts provided in the user message. If something is not in the excerpts, say briefly that it is not documented and suggest where to look next.
Be practical and concise (under 180 words for the main answer).
For onboarding/how-to questions, infer likely end-user flow from the provided excerpts: where to begin in UI, what to click/type next, and how to verify success.
For location intents (where/find/locate/create account/sign up/get started/login), keep the answer short and action-first so a page highlighter can guide the user immediately.
After your answer, on a NEW final line, output exactly this format (single line):
RUNBOOK_STEPS_JSON: ["imperative step 1", "step 2", ...]
Use 3-6 short imperative steps. No markdown code fences.`;

export function isServerLlmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

function mergeSources(
  primary: { title: string; excerpt: string; url?: string }[],
  secondary: { title: string; excerpt: string; url?: string }[]
): { title: string; excerpt: string; url?: string }[] {
  const seen = new Set<string>();
  const out: { title: string; excerpt: string; url?: string }[] = [];
  for (const s of [...primary, ...secondary]) {
    const k = s.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.slice(0, 6);
}

function parseSteps(raw: string): { answer: string; steps: string[] } {
  let answer = raw.trim();
  let steps: string[] = [];
  const idx = answer.lastIndexOf("RUNBOOK_STEPS_JSON:");
  if (idx >= 0) {
    const jsonPart = answer.slice(idx + "RUNBOOK_STEPS_JSON:".length).trim();
    answer = answer.slice(0, idx).trim();
    try {
      const parsed = JSON.parse(jsonPart) as unknown;
      if (Array.isArray(parsed)) {
        steps = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
      }
    } catch {
      /* ignore */
    }
  }
  return { answer, steps };
}

export async function runNorthstarEmbedChat(input: {
  message: string;
  pageContext: string;
  customSources: { title: string; content: string }[];
}): Promise<DemoChatResult> {
  const extraDocs: SourceDoc[] = input.customSources.map((s, i) => ({
    id: `manual-${i}-${s.title.slice(0, 20)}`,
    title: s.title.trim().slice(0, 200),
    content: s.content.trim().slice(0, 12_000),
    sourceType: "text" as const
  }));

  const allDocs: SourceDoc[] = [...demoDocs, ...extraDocs];
  const ranked = retrieveKeywordSources(input.message, allDocs, 4);
  const keywordSources = ranked.map((r) => ({
    title: r.doc.title,
    excerpt: r.doc.content.replace(/\s+/g, " ").trim().slice(0, 220),
    url: r.doc.url
  }));

  const contextBlock =
    ranked.length > 0
      ? ranked
          .map(
            (r, i) =>
              `### Excerpt ${i + 1}: ${r.doc.title}\n${r.doc.content.slice(0, 4_000)}${r.doc.content.length > 4_000 ? "\n…" : ""}`
          )
          .join("\n\n")
      : demoDocs.map((d) => `### ${d.title}\n${d.content.slice(0, 1_500)}`).join("\n\n");

  const fallback = buildNorthstarDemoResponse(input.message, input.pageContext);

  if (!isServerLlmConfigured()) {
    return {
      ...fallback,
      sources: mergeSources(keywordSources, fallback.sources)
    };
  }

  const userBlock = `Page context:\n${input.pageContext || "(none)"}\n\nKnowledge excerpts (cite only from here):\n${contextBlock}\n\nUser question:\n${input.message}`;

  try {
    const raw = await generateFromGemini(NORTHSTAR_SYSTEM, userBlock);
    const { answer, steps } = parseSteps(raw);
    if (!answer) throw new Error("empty answer");
    const finalSteps =
      steps.length > 0
        ? steps
        : fallback.steps.length > 0
          ? fallback.steps
          : ["Review the sources below.", "Ask a more specific follow-up.", "Check with your team lead if unsure."];
    return {
      answer,
      sources: mergeSources(keywordSources, fallback.sources),
      steps: finalSteps
    };
  } catch (e) {
    console.warn("northstar LLM fallback:", e);
    return {
      ...fallback,
      sources: mergeSources(keywordSources, fallback.sources)
    };
  }
}
