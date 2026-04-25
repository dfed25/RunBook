import { fetchNotionPages } from "./ingestion/notion";
import { fetchDriveDocuments } from "./ingestion/gdrive";
import { fetchSlackChannelHistory } from "./ingestion/slack";
import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";

export type SyncKnowledgeResult = {
  scanned: number;
  synced: number;
  embeddingFailed: number;
  upsertFailed: number;
  byProvider: {
    notion: number;
    google_drive: number;
    slack: number;
  };
};

export async function syncUserKnowledge(): Promise<SyncKnowledgeResult> {
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

  const result: SyncKnowledgeResult = {
    scanned: rawDocuments.length,
    synced: 0,
    embeddingFailed: 0,
    upsertFailed: 0,
    byProvider: {
      notion: notionPages.length,
      google_drive: gDocs.length,
      slack: slackMsgs.length,
    },
  };

  if (rawDocuments.length === 0) {
    console.log("No live data found or API keys are missing. Skipping sync.");
    return result;
  }

  let synced = 0;
  for (const doc of rawDocuments) {
    try {
      const embedding = await generateEmbedding(doc.content);
      if (!embedding) {
        result.embeddingFailed += 1;
        continue;
      }

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
        const missingConstraint =
          error.message?.includes(
            "there is no unique or exclusion constraint matching the ON CONFLICT specification",
          ) ?? false;
        if (missingConstraint) {
          // Dev-friendly fallback: allow ingestion even when DB migration/constraint wasn't applied yet.
          const { error: insertError } = await supabaseAdmin.from("runbook_documents").insert({
            provider: doc.provider,
            external_id: doc.id,
            title: doc.title,
            content: doc.content,
            url: null,
            embedding: `[${embedding.join(",")}]`,
          });
          if (insertError) {
            console.error(`Failed fallback insert for document ${doc.title}:`, insertError.message);
            result.upsertFailed += 1;
          } else {
            synced++;
          }
        } else {
          console.error(`Failed to upsert document ${doc.title}:`, error.message);
          result.upsertFailed += 1;
        }
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
  result.synced = synced;
  return result;
}
