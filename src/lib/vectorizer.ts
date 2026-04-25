import { fetchNotionPages } from "./ingestion/notion";
import { fetchDriveDocuments } from "./ingestion/gdrive";
import { fetchSlackChannelHistory } from "./ingestion/slack";
import { fetchUrlDocument } from "./ingestion/url";
import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";
import { getHireSources } from "./dataStore";
import type { HireKnowledgeSource, KnowledgeSourceType } from "./types";

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

type SyncDocument = {
  id: string;
  title: string;
  content: string;
  provider: "notion" | "google_drive" | "slack" | "manual";
  url: string | null;
  scope: "global" | string;
  scopeToken: string;
};

function sourceScopeToken(hireId: string): string {
  return `[hire:${hireId}]`;
}

function sourceExternalId(source: HireKnowledgeSource): string {
  return `${source.hireId}:${source.id}`;
}

function chunkContent(content: string, chunkSize = 1800, overlap = 200): string[] {
  if (content.length <= chunkSize) return [content];
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(content.length, start + chunkSize);
    const chunk = content.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end >= content.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

async function resolveSourceDocument(source: HireKnowledgeSource): Promise<SyncDocument[]> {
  const scopeToken = sourceScopeToken(source.hireId);
  const fallbackContent = `${scopeToken}
Source title: ${source.title}
Source URL: ${source.url}
Source type: ${source.type}`;

  const fetched = await fetchUrlDocument(source.url);
  const content = fetched?.content || fallbackContent;
  const title = fetched?.title || source.title || "Knowledge source";
  const scopedContent = content.includes(scopeToken) ? content : `${scopeToken}\n${content}`;
  const chunks = chunkContent(scopedContent);
  return chunks.map((chunk, index) => ({
    id: `${sourceExternalId(source)}#${index}`,
    title,
    content: chunk.includes(scopeToken) ? chunk : `${scopeToken}\n${chunk}`,
    provider: providerForType(source.type),
    url: source.url,
    scope: source.hireId,
    scopeToken,
  }));
}

export async function syncUserKnowledge(hireId?: string): Promise<SyncKnowledgeResult> {
  console.log("Starting Enterprise Integration Sync...");

  const slackChannel = process.env.SLACK_ONBOARDING_CHANNEL_ID;
  const hireSources = hireId ? await getHireSources(hireId) : [];

  const [notionPages, gDocs, slackMsgs] = hireId
    ? await Promise.all([Promise.resolve([]), Promise.resolve([]), Promise.resolve([])])
    : await Promise.all([
        fetchNotionPages(),
        fetchDriveDocuments(),
        slackChannel ? fetchSlackChannelHistory(slackChannel) : Promise.resolve([]),
      ]);

  const globalDocuments: SyncDocument[] = [
    ...notionPages.map((p) => ({
      ...p,
      provider: "notion" as const,
      url: null,
      scope: "global" as const,
      scopeToken: "[hire:global]"
    })),
    ...gDocs.map((d) => ({
      ...d,
      provider: "google_drive" as const,
      url: null,
      scope: "global" as const,
      scopeToken: "[hire:global]"
    })),
    ...slackMsgs.map((m) => ({
      ...m,
      provider: "slack" as const,
      url: null,
      scope: "global" as const,
      scopeToken: "[hire:global]"
    }))
  ];
  const hireDocumentsNested = await Promise.all(hireSources.map((source) => resolveSourceDocument(source)));
  const hireDocuments = hireDocumentsNested.flat();
  const rawDocuments = hireId ? hireDocuments : globalDocuments;

  const result: SyncKnowledgeResult = {
    scope: {
      hireId,
      sourceCount: hireId ? hireSources.length : 0
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

      const row = {
        provider: doc.provider,
        external_id: doc.id,
        title: `${doc.scopeToken} ${doc.title}`,
        content: doc.content.includes(doc.scopeToken) ? doc.content : `${doc.scopeToken}\n${doc.content}`,
        url: doc.url,
        embedding: `[${embedding.join(",")}]`,
      };
      const { error } = await supabaseAdmin
        .from("runbook_documents")
        .upsert(row, { onConflict: "provider,external_id" });

      if (error) {
        const missingConstraint =
          error.message?.includes(
            "there is no unique or exclusion constraint matching the ON CONFLICT specification",
          ) ?? false;
        if (missingConstraint) {
          // Dev-friendly fallback: allow ingestion even when DB migration/constraint wasn't applied yet.
          const { error: insertError } = await supabaseAdmin.from("runbook_documents").insert(row);
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
