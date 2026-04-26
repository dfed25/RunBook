import { randomBytes, scryptSync } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { EmbedApiKeyRecord, EmbedGitHubToken, EmbedProject } from "./embedTypes";

const DATA_DIR = path.join(process.cwd(), ".runbook-data");
const PROJECTS_FILE = path.join(DATA_DIR, "embed-projects.json");
const KEYS_FILE = path.join(DATA_DIR, "embed-api-keys.json");
const TOKENS_FILE = path.join(DATA_DIR, "embed-github-tokens.json");
const EMBED_KEY_HASH_SALT = "embed-api-key-hash-v1";
const EMBED_KEY_HASH_LEN = 32;
const EMBED_KEY_HASH_SCRYPT_OPTIONS = { N: 1 << 15, r: 8, p: 1 };

let mutationQueue: Promise<void> = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(6).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function runMutation<T>(fn: () => Promise<T>): Promise<T> {
  const previous = mutationQueue;
  let release: () => void = () => {};
  mutationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function hashEmbedKey(rawKey: string): string {
  return scryptSync(rawKey, EMBED_KEY_HASH_SALT, EMBED_KEY_HASH_LEN, EMBED_KEY_HASH_SCRYPT_OPTIONS).toString("hex");
}

export async function listProjectsForOwner(githubId: number): Promise<EmbedProject[]> {
  const all = await readJson<EmbedProject[]>(PROJECTS_FILE, []);
  return all.filter((p) => p.ownerGitHubId === githubId);
}

export async function getProject(projectId: string): Promise<EmbedProject | null> {
  const all = await readJson<EmbedProject[]>(PROJECTS_FILE, []);
  return all.find((p) => p.id === projectId) || null;
}

export async function assertProjectOwner(projectId: string, githubId: number): Promise<EmbedProject | null> {
  const p = await getProject(projectId);
  if (!p || p.ownerGitHubId !== githubId) return null;
  return p;
}

export async function createProject(input: {
  ownerGitHubId: number;
  ownerGitHubLogin: string;
  name: string;
  githubRepoFullName: string;
  defaultBranch: string;
  siteUrl?: string;
}): Promise<{ project: EmbedProject; rawApiKey: string }> {
  return runMutation(async () => {
    const projects = await readJson<EmbedProject[]>(PROJECTS_FILE, []);
    const t = nowIso();
    const project: EmbedProject = {
      id: makeId("emb"),
      name: input.name.trim() || "Untitled project",
      ownerGitHubId: input.ownerGitHubId,
      ownerGitHubLogin: input.ownerGitHubLogin,
      githubRepoFullName: input.githubRepoFullName.trim(),
      defaultBranch: input.defaultBranch.trim() || "main",
      siteUrl: input.siteUrl?.trim() || undefined,
      createdAt: t,
      updatedAt: t,
      lastIndexStatus: "idle"
    };
    projects.push(project);
    await writeJson(PROJECTS_FILE, projects);

    const rawApiKey = `rk_${randomBytes(24).toString("base64url")}`;
    const keys = await readJson<EmbedApiKeyRecord[]>(KEYS_FILE, []);
    const rec: EmbedApiKeyRecord = {
      id: makeId("key"),
      projectId: project.id,
      keyHash: hashEmbedKey(rawApiKey),
      keyPrefix: rawApiKey.slice(0, 14),
      createdAt: t
    };
    keys.push(rec);
    await writeJson(KEYS_FILE, keys);
    return { project, rawApiKey };
  });
}

export async function resolveProjectFromApiKey(rawKey: string): Promise<{ project: EmbedProject; keyId: string } | null> {
  const hash = hashEmbedKey(rawKey.trim());
  const keys = await readJson<EmbedApiKeyRecord[]>(KEYS_FILE, []);
  const key = keys.find((k) => k.keyHash === hash && !k.revokedAt);
  if (!key) return null;
  const project = await getProject(key.projectId);
  if (!project) return null;
  return { project, keyId: key.id };
}

export async function updateProjectIndexMeta(
  projectId: string,
  meta: Pick<EmbedProject, "lastIndexStatus" | "lastIndexError" | "lastIndexedAt" | "lastIndexStats">
): Promise<void> {
  await runMutation(async () => {
    const projects = await readJson<EmbedProject[]>(PROJECTS_FILE, []);
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx < 0) return;
    projects[idx] = {
      ...projects[idx]!,
      ...meta,
      updatedAt: nowIso()
    };
    await writeJson(PROJECTS_FILE, projects);
  });
}

export async function patchProject(
  projectId: string,
  patch: Partial<Pick<EmbedProject, "name" | "githubRepoFullName" | "defaultBranch" | "siteUrl">>
): Promise<EmbedProject | null> {
  return runMutation(async () => {
    const projects = await readJson<EmbedProject[]>(PROJECTS_FILE, []);
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx < 0) return null;
    const cur = projects[idx]!;
    const next: EmbedProject = {
      ...cur,
      ...patch,
      updatedAt: nowIso()
    };
    projects[idx] = next;
    await writeJson(PROJECTS_FILE, projects);
    return next;
  });
}

export async function saveGitHubToken(token: EmbedGitHubToken): Promise<void> {
  await runMutation(async () => {
    const map = await readJson<Record<string, EmbedGitHubToken>>(TOKENS_FILE, {});
    map[String(token.githubId)] = token;
    await writeJson(TOKENS_FILE, map);
  });
}

export async function getGitHubToken(githubId: number): Promise<EmbedGitHubToken | null> {
  const map = await readJson<Record<string, EmbedGitHubToken>>(TOKENS_FILE, {});
  return map[String(githubId)] || null;
}
