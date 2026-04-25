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

export async function retrieveDocsForEmbed(question: string, projectId: string): Promise<EmbedRetrievedDoc[]> {
  const TOP_K = 6;
  const marker = embedScopeLine(projectId);
  const embedding = await generateEmbedding(question);
  if (!embedding) return [];

  const { data: documents, error } = await supabaseAdmin.rpc("match_documents", {
    query_embedding: `[${embedding.join(",")}]`,
    match_threshold: DEFAULT_MATCH_THRESHOLD,
    match_count: TOP_K * 8
  });

  if (error) {
    console.error("Embed vector search error:", error);
    return [];
  }

  const batch = (documents || []) as MatchedDocument[];
  const scoped = batch.filter((d) => matchesEmbedScope(d.content, projectId));
  return scoped
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
