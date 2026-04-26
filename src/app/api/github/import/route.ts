import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ImportedDocument = { title: string; path: string; content: string };

const DOC_FILE_RE = /\.(md|mdx|txt)$/i;
const CODE_FILE_RE = /\.(js|jsx|ts|tsx|py|go|java|rb|rs|php|cs|swift|kt|sql|json|ya?ml|toml|sh)$/i;
const EXCLUDED_PATH_RE = /(^|\/)(node_modules|dist|build|coverage|\.next|vendor|tmp|\.git|assets|public\/images)(\/|$)/i;
const MAX_DOCS = 80;
const MAX_CHARS_PER_DOC = 20_000;
const MAX_TOTAL_CHARS = 900_000;
const GITHUB_REPO_SEGMENT_RE = /^[A-Za-z0-9_.-]{1,100}$/;

function normalizeRepoSegment(input: string): string | null {
  const value = input.trim().replace(/\.git$/i, "");
  if (!value || value === "." || value === "..") return null;
  if (!GITHUB_REPO_SEGMENT_RE.test(value)) return null;
  return value;
}

function parseRepoUrl(repoUrl: string): { owner: string; name: string } | null {
  const raw = repoUrl.trim();
  const shorthand = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) {
    const owner = normalizeRepoSegment(shorthand[1]!);
    const name = normalizeRepoSegment(shorthand[2]!);
    if (!owner || !name) return null;
    return { owner, name };
  }
  try {
    const u = new URL(raw);
    if (!["github.com", "www.github.com"].includes(u.hostname.toLowerCase())) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    const owner = normalizeRepoSegment(parts[0]!);
    const name = normalizeRepoSegment(parts[1]!);
    if (!owner || !name) return null;
    return { owner, name };
  } catch {
    return null;
  }
}

async function ghFetch(path: string): Promise<Response> {
  if (!path.startsWith("/repos/") || path.includes("..") || path.includes("://") || path.startsWith("//")) {
    throw new Error("Invalid GitHub API path");
  }
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "runbook-demo-importer"
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`https://api.github.com${path}`, { headers });
}

function decodeBase64Content(content: string): string {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

async function loadContentFile(owner: string, repo: string, filePath: string): Promise<ImportedDocument | null> {
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, "/")}`);
  if (!res.ok) return null;
  const j = (await res.json()) as { type?: string; content?: string; encoding?: string; name?: string; path?: string; size?: number };
  if (j.type !== "file" || j.encoding !== "base64" || typeof j.content !== "string") return null;
  if ((j.size ?? 0) > 200_000) return null;
  const content = decodeBase64Content(j.content).slice(0, MAX_CHARS_PER_DOC);
  const path = j.path || filePath;
  return { title: j.name || path.split("/").pop() || path, path, content };
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}`);
  if (!res.ok) return "main";
  const j = (await res.json()) as { default_branch?: string };
  return j.default_branch || "main";
}

function scorePath(path: string): number {
  let score = 0;
  if (/^README\./i.test(path)) score += 120;
  if (/^docs\//i.test(path)) score += 90;
  if (/^src\//i.test(path)) score += 75;
  if (/^app\//i.test(path) || /^pages\//i.test(path)) score += 65;
  if (/package\.json$/i.test(path)) score += 40;
  if (DOC_FILE_RE.test(path)) score += 30;
  if (/\/(test|spec)\./i.test(path)) score -= 20;
  return score;
}

export async function POST(req: NextRequest) {
  let body: { repoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = String(body.repoUrl || "").trim();
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Please provide a valid GitHub repository URL." }, { status: 400 });
  }

  const { owner, name } = parsed;
  const docs: ImportedDocument[] = [];
  let totalChars = 0;

  // README first (best signal for demos)
  const readmeRes = await ghFetch(`/repos/${owner}/${name}/readme`);
  if (readmeRes.ok) {
    const j = (await readmeRes.json()) as { content?: string; encoding?: string; path?: string; name?: string };
    if (j.encoding === "base64" && typeof j.content === "string") {
      docs.push({
        title: j.name || "README.md",
        path: j.path || "README.md",
        content: decodeBase64Content(j.content).slice(0, MAX_CHARS_PER_DOC)
      });
    }
  }

  const rootRes = await ghFetch(`/repos/${owner}/${name}/contents`);
  if (!rootRes.ok) {
    const msg = rootRes.status === 404 ? "Repository not found or is private." : "GitHub import failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const root = (await rootRes.json()) as Array<{ type: string; name: string; path: string }>;

  const candidatePaths = new Set<string>();
  for (const item of root) {
    if (item.type === "file" && (DOC_FILE_RE.test(item.name) || CODE_FILE_RE.test(item.name))) {
      candidatePaths.add(item.path);
    }
  }

  const docsDir = root.find((i) => i.type === "dir" && i.name.toLowerCase() === "docs");
  if (docsDir) {
    const docsRes = await ghFetch(`/repos/${owner}/${name}/contents/docs`);
    if (docsRes.ok) {
      const children = (await docsRes.json()) as Array<{ type: string; name: string; path: string }>;
      for (const c of children) {
        if (c.type === "file" && (DOC_FILE_RE.test(c.name) || CODE_FILE_RE.test(c.name))) candidatePaths.add(c.path);
      }
    }
  }

  // Pull a broader codebase snapshot via recursive tree.
  const defaultBranch = await getDefaultBranch(owner, name);
  const treeRes = await ghFetch(`/repos/${owner}/${name}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`);
  if (treeRes.ok) {
    const treeJson = (await treeRes.json()) as { tree?: Array<{ path: string; type: string; size?: number }> };
    const tree = Array.isArray(treeJson.tree) ? treeJson.tree : [];
    const selectedPaths = tree
      .filter((t) => {
        if (t.type !== "blob") return false;
        if (!t.path || EXCLUDED_PATH_RE.test(t.path)) return false;
        const looksReadable = DOC_FILE_RE.test(t.path) || CODE_FILE_RE.test(t.path);
        if (!looksReadable) return false;
        if ((t.size ?? 0) > 180_000) return false;
        return true;
      })
      .sort((a, b) => scorePath(b.path) - scorePath(a.path))
      .slice(0, MAX_DOCS);

    for (const item of selectedPaths) {
      candidatePaths.add(item.path);
    }
  }

  const sortedCandidates = Array.from(candidatePaths)
    .filter((p) => !EXCLUDED_PATH_RE.test(p))
    .sort((a, b) => scorePath(b) - scorePath(a))
    .slice(0, MAX_DOCS);

  for (const p of sortedCandidates) {
    if (docs.some((d) => d.path === p)) continue;
    const doc = await loadContentFile(owner, name, p);
    if (doc) {
      const nextTotal = totalChars + doc.content.length;
      if (nextTotal > MAX_TOTAL_CHARS) continue;
      docs.push(doc);
      totalChars = nextTotal;
    }
  }

  if (docs.length === 0) {
    return NextResponse.json(
      { error: "No readable markdown/text docs found in this repository." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    projectId: `${owner}-${name}`.toLowerCase(),
    repo: { owner, name, url: `https://github.com/${owner}/${name}` },
    documents: docs
  });
}

