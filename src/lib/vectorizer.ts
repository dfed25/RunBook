import { fetchNotionPages } from "./ingestion/notion";
import { fetchDriveDocuments } from "./ingestion/gdrive";
import { fetchSlackChannelHistory } from "./ingestion/slack";
import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";

export async function syncUserKnowledge() {
  console.log("Starting Enterprise Integration Sync...");

  const slackChannel = process.env.SLACK_ONBOARDING_CHANNEL_ID;

  const [notionPages, gDocs, slackMsgs] = await Promise.all([
    fetchNotionPages(),
    fetchDriveDocuments(),
    slackChannel ? fetchSlackChannelHistory(slackChannel) : Promise.resolve([]),
  ]);

  const rawDocuments = [
    ...notionPages.map((p) => ({ ...p, provider: "notion" })),
    ...gDocs.map((d) => ({ ...d, provider: "google_drive" })),
    ...slackMsgs.map((m) => ({ ...m, provider: "slack" })),
  ];

  if (rawDocuments.length === 0) {
    console.log("No live data found or API keys are missing. Skipping sync.");
    return;
  }

  let synced = 0;
  for (const doc of rawDocuments) {
    try {
      const embedding = await generateEmbedding(doc.content);
      if (!embedding) continue;

      const { error } = await supabaseAdmin.from("runbook_documents").upsert(
        {
          provider: doc.provider,
          external_id: doc.id,
          title: doc.title,
          content: doc.content,
          url: null,
          embedding: `[${embedding.join(",")}]`,
        },
        { onConflict: "provider,external_id" }
      );

      if (error) {
        console.error(`Failed to upsert document ${doc.title}:`, error.message);
      } else {
        synced++;
      }
    } catch (err) {
      console.error(`Embedding failure for ${doc.id}:`, err);
    }
  }

  console.log(
    `Successfully synced ${synced}/${rawDocuments.length} enterprise documents to Supabase Vector Engine!`
  );
}
