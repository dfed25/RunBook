import { fetchNotionPages } from "./ingestion/notion";
import { fetchDriveDocuments } from "./ingestion/gdrive";
import { fetchSlackChannelHistory } from "./ingestion/slack";
import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";

// This is the CRON/Webhook runner script!
// It aggregates all connected user data, chunks it, generates Gemini Embeddings, and syncs to Supabase.
export async function syncUserKnowledge() {
  console.log("Starting Enterprise Integration Sync...");
  
  // 1. Fetch raw strings from all platforms concurrently
  const [notionPages, gDocs, slackMsgs] = await Promise.all([
    fetchNotionPages(),
    fetchDriveDocuments(),
    fetchSlackChannelHistory(process.env.SLACK_ONBOARDING_CHANNEL_ID ?? "")
  ]);

  const rawDocuments = [
    ...notionPages.map(p => ({ ...p, provider: "notion" })),
    ...gDocs.map(d => ({ ...d, provider: "google_drive" })),
    ...slackMsgs.map(m => ({ ...m, provider: "slack" }))
  ];

  if (rawDocuments.length === 0) {
    console.log("No live data found or API keys are missing. Skipping sync.");
    return;
  }

  // 2. Chunker & Embedder loop
  for (const doc of rawDocuments) {
    try {
      // In production we would use Langchain RecursiveCharacterTextSplitter
      // For the hackathon, we simply embed the entire document struct/chunk
      const embedding = await generateEmbedding(doc.content);

      if (!embedding) continue;

      // 3. Upsert into Supabase pgvector table using Admin Client
      const { error } = await supabaseAdmin.from("runbook_documents").upsert({
        provider: doc.provider,
        external_id: doc.id,
        title: doc.title,
        content: doc.content,
        url: `https://${doc.provider}.com/${doc.id}`,
        embedding: `[${embedding.join(",")}]`
      }, { onConflict: "provider,external_id" });

      if (error) {
        console.error(`Failed to upsert document ${doc.title}:`, error.message);
      }
    } catch (err) {
      console.error(`Embedding failure for ${doc.id}:`, err);
    }
  }

  console.log(`Successfully synced ${rawDocuments.length} enterprise documents to Supabase Vector Engine!`);
}
