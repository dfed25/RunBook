type UrlIngestionDoc = {
  id: string;
  title: string;
  content: string;
  url: string;
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; RunbookBot/1.0; +https://runbook.local)";

function stripHtmlTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return stripHtmlTags(match[1]).slice(0, 180) || null;
}

function googleDocIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.includes("docs.google.com")) return null;
    const pathMatch = url.pathname.match(/\/document\/d\/([^/]+)/);
    return pathMatch?.[1] || null;
  } catch {
    return null;
  }
}

async function fetchGoogleDocText(rawUrl: string): Promise<string | null> {
  const docId = googleDocIdFromUrl(rawUrl);
  if (!docId) return null;
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(exportUrl, {
    headers: { "user-agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const text = (await res.text()).trim();
  return text || null;
}

export async function fetchUrlDocument(rawUrl: string): Promise<UrlIngestionDoc | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

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
    const res = await fetch(parsed.href, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html, text/plain;q=0.9, application/json;q=0.5, */*;q=0.1",
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    const body = await res.text();
    if (!body.trim()) return null;

    const title =
      extractTitleFromHtml(body) ||
      parsed.hostname ||
      "Web source";
    const content =
      contentType.includes("text/plain")
        ? body.trim()
        : stripHtmlTags(body);

    if (!content) return null;

    return {
      id: parsed.href,
      title,
      content,
      url: parsed.href,
    };
  } catch {
    return null;
  }
}
