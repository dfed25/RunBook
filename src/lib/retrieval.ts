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

export async function retrieveDocs(question: string): Promise<RetrievedDoc[]> {
  try {
    const embedding = await generateEmbedding(question);
    if (!embedding) return [];

    const { data: documents, error } = await supabaseAdmin.rpc("match_documents", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: 0.7,
      match_count: 3
    });

    if (error) {
      console.error("Vector Search Error:", error);
      return [];
    }

    if (!documents) return [];

    return (documents as MatchedDocument[]).map((doc) => ({
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