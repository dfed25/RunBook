-- Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a generic table to store documents and chunks synced from integrations
CREATE TABLE runbook_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- "notion", "google_drive", "slack", "manual"
  external_id TEXT NOT NULL, -- ID of the file/page/message on the remote platform
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT,
  embedding vector(768), -- Gemini text-embedding-004 output dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT runbook_documents_provider_external_id_key UNIQUE (provider, external_id)
);

-- Use HNSW index (better than IVFFlat for initially-empty tables)
CREATE INDEX runbook_documents_embedding_idx ON runbook_documents USING hnsw (embedding vector_cosine_ops);

-- Create the similarity search function used by our Next.js API
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  url text,
  provider text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    runbook_documents.id,
    runbook_documents.title,
    runbook_documents.content,
    runbook_documents.url,
    runbook_documents.provider,
    1 - (runbook_documents.embedding <=> query_embedding) AS similarity
  FROM runbook_documents
  WHERE 1 - (runbook_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY runbook_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Secure the table with Row Level Security
ALTER TABLE runbook_documents ENABLE ROW LEVEL SECURITY;
