import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";

interface RetrievedDoc {
  doc: {
    id: string;
    title: string;
    content: string;
    url: string | null;
    provider: string;
  };
  score: number;
}

interface MatchedDocument {
  id: string;
  title: string;
  content: string;
  url: string | null;
  provider: string;
  similarity: number;
}

function matchesHireScope(content: string, hireId?: string): boolean {
  if (!hireId) return true;
  const scopeMarkers = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\[hire:[^\]]+\]$/.test(line));
  if (scopeMarkers.length === 0) return true;
  if (scopeMarkers.includes(`[hire:${hireId}]`)) return true;
  return scopeMarkers.includes("[hire:global]");
}

export async function retrieveDocs(question: string, hireId?: string): Promise<RetrievedDoc[]> {
  try {
    const TOP_K = 3;
    const embedding = await generateEmbedding(question);
    if (!embedding) return [];

    const { data: documents, error } = await supabaseAdmin.rpc("match_documents", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: 0.7,
      match_count: hireId ? TOP_K * 10 : TOP_K
    });

    if (error) {
      console.error("Vector Search Error:", error);
      return [];
    }

    if (!documents) return [];

    const scoped = (documents as MatchedDocument[])
      .filter((doc) => matchesHireScope(doc.content, hireId))
      .slice(0, TOP_K);
    return scoped.map((doc) => ({
      doc: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        url: doc.url,
        provider: doc.provider,
      },
      score: doc.similarity
    }));
  } catch (err) {
    console.error("Retrieval Pipeline Error:", err);
    return [];
  }
}