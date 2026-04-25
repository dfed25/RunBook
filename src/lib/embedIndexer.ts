import { createHash } from "crypto";
import { Octokit } from "@octokit/rest";
import { supabaseAdmin } from "./supabase-admin";
import { generateEmbedding } from "./ai";
import { updateProjectIndexMeta } from "./embedStore";
import type { EmbedProject } from "./embedTypes";

const MAX_FILES = 80;
const MAX_TOTAL_BYTES = 450_000;
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;

const TEXT_EXT = new Set([
  ".md",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".css",
  ".html",
  ".sql",
  ".sh",
  ".env.example",
  ".toml",
  ".rs",
  ".go",
  ".py",
  ".java",
  ".kt",
  ".swift",
  ".vue",
  ".svelte"
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "__pycache__",
  ".venv",
  "vendor",
  "Pods"
]);

function chunkContent(content: string): string[] {
  if (content.length <= CHUNK_SIZE) return [content];
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(content.length, start + CHUNK_SIZE);
    const chunk = content.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end >= content.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

function pathHash(path: string): string {
  return createHash("sha1").update(path, "utf8").digest("hex").slice(0, 16);
}

function embedScopeToken(projectId: string): string {
  return `[embed:${projectId}]`;
}

async function deleteExistingEmbedDocs(projectId: string): Promise<void> {
  const prefix = `embed:${projectId}:`;
  try {
    const { error } = await supabaseAdmin.from("runbook_documents").delete().like("external_id", `${prefix}%`);
    if (error) console.error("embed delete old docs:", error.message);
  } catch (e) {
    console.warn("embed delete skipped:", e);
  }
}

export type IndexEmbedResult = {
  files: number;
  chunks: number;
  bytes: number;
  errors: string[];
};

export async function indexGitHubRepo(project: EmbedProject, accessToken: string): Promise<IndexEmbedResult> {
  const errors: string[] = [];
  if (!process.env.GEMINI_API_KEY?.trim()) {
    await updateProjectIndexMeta(project.id, {
      lastIndexStatus: "error",
      lastIndexError: "GEMINI_API_KEY is not set — cannot generate embeddings",
      lastIndexedAt: new Date().toISOString()
    });
    return { files: 0, chunks: 0, bytes: 0, errors: ["GEMINI_API_KEY missing"] };
  }
  await updateProjectIndexMeta(project.id, { lastIndexStatus: "running", lastIndexError: undefined });

  const octokit = new Octokit({ auth: accessToken });
  const [owner, repo] = project.githubRepoFullName.split("/");
  if (!owner || !repo) {
    await updateProjectIndexMeta(project.id, {
      lastIndexStatus: "error",
      lastIndexError: "Invalid repo full name (expected owner/repo)",
      lastIndexedAt: new Date().toISOString()
    });
    return { files: 0, chunks: 0, bytes: 0, errors: ["Invalid repo"] };
  }

  let defaultBranch = project.defaultBranch;
  try {
    const rep = await octokit.repos.get({ owner, repo });
    if (rep.data.default_branch) defaultBranch = rep.data.default_branch;
  } catch (e) {
    errors.push(`repo meta: ${e instanceof Error ? e.message : String(e)}`);
  }

  let treeSha: string | undefined;
  try {
    const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
    const commit = await octokit.git.getCommit({ owner, repo, commit_sha: ref.data.object.sha });
    treeSha = commit.data.tree.sha;
  } catch (e) {
    await updateProjectIndexMeta(project.id, {
      lastIndexStatus: "error",
      lastIndexError: `Could not read branch ${defaultBranch}: ${e instanceof Error ? e.message : String(e)}`,
      lastIndexedAt: new Date().toISOString()
    });
    return { files: 0, chunks: 0, bytes: 0, errors: [...errors, "branch/tree"] };
  }

  let paths: string[] = [];
  try {
    const tree = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: "1" });
    for (const item of tree.data.tree) {
      if (item.type !== "blob" || !item.path) continue;
      const segments = item.path.split("/");
      if (segments.some((s) => SKIP_DIRS.has(s))) continue;
      const lower = item.path.toLowerCase();
      const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
      const allowed =
        TEXT_EXT.has(ext) ||
        lower.endsWith("dockerfile") ||
        lower.endsWith("makefile") ||
        item.path === "README" ||
        item.path.endsWith("/README");
      if (!allowed) continue;
      paths.push(item.path);
    }
  } catch (e) {
    errors.push(`tree: ${e instanceof Error ? e.message : String(e)}`);
  }

  paths = paths.slice(0, MAX_FILES);
  await deleteExistingEmbedDocs(project.id);

  const scope = embedScopeToken(project.id);
  let totalBytes = 0;
  let filesIndexed = 0;
  let chunksIndexed = 0;

  for (const filePath of paths) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    try {
      const blob = await octokit.repos.getContent({ owner, repo, path: filePath, ref: defaultBranch });
      if (!("content" in blob.data) || blob.data.type !== "file") continue;
      const buf = Buffer.from(blob.data.content, "base64");
      const text = buf.toString("utf8");
      if (!text || text.includes("\u0000")) continue;
      const slice = text.slice(0, 120_000);
      totalBytes += slice.length;
      const chunks = chunkContent(slice);
      const baseId = pathHash(filePath);
      let cIdx = 0;
      let storedChunksForFile = 0;
      for (const chunk of chunks) {
        const externalId = `embed:${project.id}:${baseId}#${cIdx}`;
        const titled = `${filePath} (chunk ${cIdx + 1}/${chunks.length})`;
        const content = `${scope}\nFile: ${filePath}\nBranch: ${defaultBranch}\n\n${chunk}`;
        const embedding = await generateEmbedding(content);
        if (!embedding) {
          errors.push(`${filePath}#${cIdx}: embedding failed (check GEMINI_API_KEY / quota)`);
          cIdx++;
          continue;
        }
        const row = {
          provider: "github_embed",
          external_id: externalId,
          title: `${scope} ${titled}`,
          content,
          url: `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${filePath}`,
          embedding: `[${embedding.join(",")}]`
        };
        const { error } = await supabaseAdmin.from("runbook_documents").upsert(row, { onConflict: "provider,external_id" });
        let stored = false;
        if (error) {
          const { error: insErr } = await supabaseAdmin.from("runbook_documents").insert(row);
          if (insErr) errors.push(`${filePath}#${cIdx}: ${insErr.message}`);
          else stored = true;
        } else {
          stored = true;
        }
        if (stored) {
          storedChunksForFile++;
          chunksIndexed++;
        }
        cIdx++;
      }
      if (storedChunksForFile > 0) filesIndexed++;
    } catch (e) {
      errors.push(`${filePath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await updateProjectIndexMeta(project.id, {
    lastIndexStatus:
      (chunksIndexed === 0 && paths.length > 0) || (errors.length > 0 && filesIndexed === 0) ? "error" : "ok",
    lastIndexError: errors.length ? errors.slice(0, 5).join("; ") : undefined,
    lastIndexedAt: new Date().toISOString(),
    lastIndexStats: { files: filesIndexed, chunks: chunksIndexed, bytes: totalBytes }
  });

  return { files: filesIndexed, chunks: chunksIndexed, bytes: totalBytes, errors };
}
