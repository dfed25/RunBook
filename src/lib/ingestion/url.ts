import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type UrlIngestionDoc = {
  id: string;
  title: string;
  content: string;
  url: string;
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; RunbookBot/1.0; +https://runbook.local)";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

const ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  mdash: "—",
  ndash: "–",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\"",
  ldquo: "\"",
};

function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _match;
    }
    const named = ENTITY_MAP[entity.toLowerCase()];
    return named ?? _match;
  });
}

function stripHtmlTags(input: string): string {
  const textOnly = input
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .trim();
  return decodeHtmlEntities(textOnly).replace(/\s+/g, " ").trim();
}

function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return stripHtmlTags(match[1]).slice(0, 180) || null;
}

function googleDocIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (host !== "docs.google.com") return null;
    const pathMatch = url.pathname.match(/\/document\/d\/([^/]+)/);
    return pathMatch?.[1] || null;
  } catch {
    return null;
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map((value) => Number.parseInt(value, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    return false;
  }
  return true;
}

async function hostnameIsAllowed(hostname: string): Promise<boolean> {
  const ipVersion = isIP(hostname);
  if (ipVersion > 0) {
    return !isPrivateOrReservedIp(hostname);
  }
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return false;
    return addresses.every((entry) => !isPrivateOrReservedIp(entry.address));
  } catch {
    return false;
  }
}

async function validateDestination(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return hostnameIsAllowed(url.hostname);
}

async function readBodyWithCap(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}

async function safeFetch(rawUrl: URL): Promise<{ finalUrl: URL; body: string; contentType: string } | null> {
  let current = rawUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(current.href, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html, text/plain;q=0.9, application/json;q=0.5, */*;q=0.1",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        const nextUrl = new URL(location, current.href);
        if (!(await validateDestination(nextUrl))) return null;
        current = nextUrl;
        continue;
      }

      if (!res.ok) return null;
      const body = await readBodyWithCap(res, MAX_RESPONSE_BYTES);
      if (!body) return null;
      const contentType = res.headers.get("content-type") || "";
      return { finalUrl: current, body, contentType };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function fetchGoogleDocText(rawUrl: string): Promise<string | null> {
  const docId = googleDocIdFromUrl(rawUrl);
  if (!docId) return null;
  const exportUrl = new URL(`https://docs.google.com/document/d/${docId}/export?format=txt`);
  if (!(await validateDestination(exportUrl))) return null;
  const response = await safeFetch(exportUrl);
  if (!response) return null;
  const lowerBody = response.body.trim().toLowerCase();
  const contentType = response.contentType.toLowerCase();
  if (!contentType.includes("text/plain") && !contentType.startsWith("text/")) return null;
  if (
    lowerBody.startsWith("<!doctype") ||
    lowerBody.startsWith("<html") ||
    lowerBody.includes("accounts.google.com") ||
    lowerBody.includes("sign in")
  ) {
    return null;
  }
  const text = response.body.trim();
  return text || null;
}

export async function fetchUrlDocument(rawUrl: string): Promise<UrlIngestionDoc | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!(await validateDestination(parsed))) return null;

  try {
    const googleDocText = await fetchGoogleDocText(rawUrl);
    if (googleDocText) {
      return {
        id: parsed.href,
        title: "Google Doc",
        content: googleDocText,
        url: parsed.href,
      };
    }
  } catch {
    // Fall through to generic fetch path.
  }

  try {
    const response = await safeFetch(parsed);
    if (!response) return null;
    const { finalUrl, body, contentType } = response;
    if (!body.trim()) return null;

    const title =
      extractTitleFromHtml(body) ||
      finalUrl.hostname ||
      "Web source";
    const content =
      contentType.includes("text/plain")
        ? body.trim()
        : stripHtmlTags(body);

    if (!content) return null;

    return {
      id: finalUrl.href,
      title,
      content,
      url: finalUrl.href,
    };
  } catch {
    return null;
  }
}
