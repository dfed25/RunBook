import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";

const DEFAULT_MATCH_THRESHOLD = 0.35;

function embedScopeLine(projectId: string): string {
  return `[embed:${projectId}]`;
}

function matchesEmbedScope(content: string, projectId: string): boolean {
  const marker = embedScopeLine(projectId);
  return content.split("\n").some((line) => line.trim() === marker);
}

interface MatchedDocument {
  id: string;
  title: string;
  content: string;
  url: string | null;
  provider: string;
  similarity: number;
}

export type EmbedRetrievedDoc = {
  doc: { id: string; title: string; content: string; url: string | null; provider: string };
  score: number;
};

function buildEmbedQueries(question: string): string[] {
  const q = question.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const queries = [q];
  const flowIntent = /(steps|how do i|how to|start using|onboard|register|sign up|signup|create account|login|log in)/i;
  if (flowIntent.test(lower)) {
    queries.push(
      `${q}\nFocus on user onboarding flow from code: routes, controllers, API handlers, UI forms, submit actions, redirects, and required verification steps.`,
      `${q}\nFind entrypoint screens and sequence: sign up, email verification, first login, workspace setup, and first successful action.`
    );
  }
  return queries;
}

export async function retrieveDocsForEmbed(question: string, projectId: string): Promise<EmbedRetrievedDoc[]> {
  const TOP_K = 6;
  const marker = embedScopeLine(projectId);
  const queries = buildEmbedQueries(question);
  const merged = new Map<string, MatchedDocument>();

  for (const query of queries) {
    const embedding = await generateEmbedding(query);
    if (!embedding) continue;

    const { data: documents, error } = await supabaseAdmin.rpc("match_documents", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: DEFAULT_MATCH_THRESHOLD,
      match_count: TOP_K * 8
    });

    if (error) {
      console.error("Embed vector search error:", error);
      continue;
    }

    const batch = (documents || []) as MatchedDocument[];
    for (const doc of batch) {
      if (!matchesEmbedScope(doc.content, projectId)) continue;
      const prev = merged.get(doc.id);
      if (!prev || doc.similarity > prev.similarity) merged.set(doc.id, doc);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K)
    .map((doc) => ({
      doc: {
        id: doc.id,
        title: doc.title.replace(new RegExp(`^\\s*${escapeRegExp(marker)}\\s*`, "i"), "").trim() || doc.title,
        content: doc.content,
        url: doc.url,
        provider: doc.provider
      },
      score: doc.similarity
    }));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
