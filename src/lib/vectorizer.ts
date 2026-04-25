import { fetchNotionPages } from "./ingestion/notion";
import { fetchDriveDocuments } from "./ingestion/gdrive";
import { fetchSlackChannelHistory } from "./ingestion/slack";
import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";
import { getHireSources } from "./dataStore";
import type { KnowledgeSourceType } from "./types";

export type SyncKnowledgeResult = {
  scope: {
    hireId?: string;
    sourceCount: number;
  };
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

function providerForType(type: KnowledgeSourceType): "notion" | "google_drive" | "slack" | "manual" {
  if (type.startsWith("notion")) return "notion";
  if (type.startsWith("google")) return "google_drive";
  if (type === "slack_channel") return "slack";
  return "manual";
}

export async function syncUserKnowledge(hireId?: string): Promise<SyncKnowledgeResult> {
  console.log("Starting Enterprise Integration Sync...");

  const slackChannel = process.env.SLACK_ONBOARDING_CHANNEL_ID;
  const hireSources = await getHireSources(hireId);
  const scopeToken = hireId ? `[hire:${hireId}]` : "[hire:global]";

  const [notionPages, gDocs, slackMsgs] = await Promise.all([
    fetchNotionPages(),
    fetchDriveDocuments(),
    slackChannel ? fetchSlackChannelHistory(slackChannel) : Promise.resolve([]),
  ]);

  const rawDocuments = [
    ...notionPages.map((p) => ({ ...p, provider: "notion" as const })),
    ...gDocs.map((d) => ({ ...d, provider: "google_drive" as const })),
    ...slackMsgs.map((m) => ({ ...m, provider: "slack" as const })),
    ...hireSources.map((source) => ({
      id: source.id,
      title: source.title,
      content: `${scopeToken}\nKnowledge source URL: ${source.url}\nProvider type: ${source.type}`,
      provider: providerForType(source.type),
      url: source.url
    }))
  ];

  const result: SyncKnowledgeResult = {
    scope: {
      hireId,
      sourceCount: hireSources.length
    },
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
          external_id: hireId ? `${hireId}:${doc.id}` : doc.id,
          title: `${scopeToken} ${doc.title}`,
          content: doc.content.includes(scopeToken) ? doc.content : `${scopeToken}\n${doc.content}`,
          url: "url" in doc ? doc.url : null,
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
            external_id: hireId ? `${hireId}:${doc.id}` : doc.id,
            title: `${scopeToken} ${doc.title}`,
            content: doc.content.includes(scopeToken) ? doc.content : `${scopeToken}\n${doc.content}`,
            url: "url" in doc ? doc.url : null,
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
