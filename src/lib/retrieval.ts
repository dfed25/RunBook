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

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "so",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

function extractScopeMarkers(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\[hire:[^\]]+\]$/.test(line));
}

function matchesRetrievalScope(content: string, hireId?: string): boolean {
  const markers = extractScopeMarkers(content);

  // Hire chat: only allow explicitly hire-scoped chunks for that hire.
  // This prevents global Slack onboarding dumps from masquerading as hire-specific docs.
  if (hireId) {
    return markers.includes(`[hire:${hireId}]`);
  }

  // Global chat: allow unscoped legacy rows, or explicitly global rows.
  // If a chunk is explicitly scoped to a specific hire, do not surface it in global chat.
  if (markers.length === 0) return true;
  return markers.includes("[hire:global]");
}

function tokenizeQuestion(question: string): string[] {
  const raw = question
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  // De-dupe while preserving order
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, 8);
}

async function fetchHireKeywordFallback(question: string, hireId: string): Promise<MatchedDocument[]> {
  const tokens = tokenizeQuestion(question);
  if (tokens.length === 0) return [];

  const hirePrefix = `${hireId}:`;
  const orFilter = tokens.map((t) => `title.ilike.%${t}%`).join(",");

  const { data, error } = await supabaseAdmin
    .from("runbook_documents")
    .select("id,title,content,url,provider")
    .ilike("external_id", `${hirePrefix}%`)
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Hire keyword fallback error:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: String(row.id),
    title: String(row.title || ""),
    content: String(row.content || ""),
    url: (row.url as string | null) ?? null,
    provider: String(row.provider || "manual"),
    similarity: 0.2,
  }));
}

async function matchDocumentsWithBackoff(
  embedding: number[],
  hireId?: string
): Promise<MatchedDocument[]> {
  const TOP_K = 3;
  const thresholds = hireId ? [0.45, 0.35, 0.25, 0.15] : [0.6, 0.45, 0.35];
  const matchCounts = hireId ? [TOP_K * 12, TOP_K * 18, TOP_K * 24, TOP_K * 30] : [TOP_K * 3, TOP_K * 6, TOP_K * 10];

  let best: MatchedDocument[] = [];
  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i]!;
    const match_count = matchCounts[Math.min(i, matchCounts.length - 1)]!;

    const { data: documents, error } = await supabaseAdmin.rpc("match_documents", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: threshold,
      match_count,
    });

    if (error) {
      console.error("Vector Search Error:", error);
      return best;
    }

    const batch = (documents || []) as MatchedDocument[];
    const merged = new Map<string, MatchedDocument>();
    for (const doc of [...best, ...batch]) merged.set(doc.id, doc);
    best = Array.from(merged.values()).sort((a, b) => b.similarity - a.similarity);

    const scopedCount = best.filter((d) => matchesRetrievalScope(d.content, hireId)).length;
    if (scopedCount >= TOP_K) break;
  }

  return best;
}

export async function retrieveDocs(question: string, hireId?: string): Promise<RetrievedDoc[]> {
  try {
    const TOP_K = 3;
    const embedding = await generateEmbedding(question);
    if (!embedding) {
      if (!hireId) return [];
      const fallbackOnly = await fetchHireKeywordFallback(question, hireId);
      return fallbackOnly
        .filter((doc) => matchesRetrievalScope(doc.content, hireId))
        .slice(0, TOP_K)
        .map((doc) => ({
          doc: {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            url: doc.url,
            provider: doc.provider,
          },
          score: doc.similarity,
        }));
    }

    const documents = await matchDocumentsWithBackoff(embedding, hireId);
    const vectorScoped = documents
      .filter((doc) => matchesRetrievalScope(doc.content, hireId))
      .slice(0, TOP_K);

    if (hireId && vectorScoped.length < TOP_K) {
      const fallback = await fetchHireKeywordFallback(question, hireId);
      const merged = new Map<string, MatchedDocument>();
      for (const doc of [...vectorScoped, ...fallback]) merged.set(doc.id, doc);
      const filled = Array.from(merged.values())
        .filter((doc) => matchesRetrievalScope(doc.content, hireId))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, TOP_K);

      return filled.map((doc) => ({
        doc: {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          url: doc.url,
          provider: doc.provider,
        },
        score: doc.similarity,
      }));
    }

    return vectorScoped.map((doc) => ({
      doc: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        url: doc.url,
        provider: doc.provider,
      },
      score: doc.similarity,
    }));
  } catch (err) {
    console.error("Retrieval Pipeline Error:", err);
    return [];
  }
}