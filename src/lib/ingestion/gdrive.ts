import { google } from "googleapis";

interface IngestionDoc {
  id: string;
  title: string;
  content: string;
}

const MAX_FOLDER_ITEMS = 45;
const MAX_CHARS_PER_FILE = 60_000;
const MAX_TOTAL_FOLDER_CHARS = 350_000;

function buildDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  if (refreshToken) {
    auth.setCredentials({ refresh_token: refreshToken });
  } else {
    console.warn("Google Drive: Missing GOOGLE_REFRESH_TOKEN — API calls will fail.");
    return null;
  }
  return google.drive({ version: "v3", auth });
}

type DriveClient = NonNullable<ReturnType<typeof buildDriveClient>>;

function truncateText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n...[truncated ${t.length - max} characters]...`;
}

/**
 * Recognize folder / file / open?id= links on drive.google.com.
 */
export function parseDriveGoogleUrl(rawUrl: string): { kind: "folder" | "file" | "open"; id: string } | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.toLowerCase();
    if (host !== "drive.google.com") return null;

    const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch?.[1]) return { kind: "folder", id: folderMatch[1] };

    const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return { kind: "file", id: fileMatch[1] };

    const idParam = url.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return { kind: "open", id: idParam };

    return null;
  } catch {
    return null;
  }
}

async function driveFileMeta(drive: DriveClient, fileId: string) {
  const { data } = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  return {
    id: data.id || fileId,
    name: data.name || "Untitled",
    mimeType: data.mimeType || "",
  };
}

async function exportGoogleWorkspacePlain(
  drive: DriveClient,
  fileId: string,
  mimeType: string
): Promise<string | null> {
  try {
    if (mimeType === "application/vnd.google-apps.document") {
      const res = await drive.files.export({
        fileId,
        mimeType: "text/plain",
      });
      return typeof res.data === "string" ? res.data : null;
    }
    if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const res = await drive.files.export({
        fileId,
        mimeType: "text/csv",
      });
      return typeof res.data === "string" ? res.data : null;
    }
    if (mimeType === "application/vnd.google-apps.presentation") {
      const res = await drive.files.export({
        fileId,
        mimeType: "text/plain",
      });
      return typeof res.data === "string" ? res.data : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function downloadPlainFile(
  drive: DriveClient,
  fileId: string,
  mimeType: string
): Promise<string | null> {
  const textish =
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType.endsWith("+json") ||
    mimeType.endsWith("+xml");

  if (!textish) return null;

  try {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    const buf = Buffer.from(res.data as ArrayBuffer);
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

async function extractDriveFileText(
  drive: DriveClient,
  fileId: string,
  name: string,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/vnd.google-apps.shortcut") {
    return `Shortcut "${name}" — replace this with the target file or folder URL to index its contents.`;
  }
  if (mimeType === "application/vnd.google-apps.folder") {
    return `Subfolder "${name}" — add this folder URL as its own knowledge source to index its files.`;
  }

  const exported = await exportGoogleWorkspacePlain(drive, fileId, mimeType);
  if (exported) return truncateText(exported, MAX_CHARS_PER_FILE);

  const plain = await downloadPlainFile(drive, fileId, mimeType);
  if (plain) return truncateText(plain, MAX_CHARS_PER_FILE);

  return `No extractable text for "${name}" (${mimeType}). Open in Drive: https://drive.google.com/file/d/${fileId}/view`;
}

async function ingestSingleDriveFile(
  drive: DriveClient,
  fileId: string,
  hintName?: string
): Promise<{ title: string; content: string }> {
  const meta = await driveFileMeta(drive, fileId);
  const body = await extractDriveFileText(drive, meta.id, meta.name, meta.mimeType);
  const content = [`Google Drive file: ${meta.name}`, `MIME type: ${meta.mimeType}`, `URL: https://drive.google.com/file/d/${meta.id}/view`, "", body].join("\n");
  return { title: `Drive: ${hintName ?? meta.name}`, content };
}

async function ingestDriveFolder(
  drive: DriveClient,
  folderId: string,
  folderName: string,
  sourceUrl: string
): Promise<{ title: string; content: string }> {
  const lines: string[] = [];
  lines.push(`Google Drive folder: ${folderName}`);
  lines.push(`Folder ID: ${folderId}`);
  lines.push(`Folder URL: ${sourceUrl}`);
  lines.push("");

  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: MAX_FOLDER_ITEMS,
    fields: "files(id, name, mimeType)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: "folder,name",
  });

  const files = list.data.files || [];
  if (files.length === 0) {
    lines.push("(This folder has no files, or the service account cannot list them.)");
    return { title: `Drive folder: ${folderName}`, content: lines.join("\n") };
  }

  lines.push(`Items (${files.length}):`);
  lines.push("");

  for (const f of files) {
    const id = f.id;
    const name = f.name || "Untitled";
    const mime = f.mimeType || "";
    if (!id) continue;

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`## ${name}`);
    lines.push(`MIME: ${mime}`);
    lines.push("");

    try {
      const chunk = await extractDriveFileText(drive, id, name, mime);
      lines.push(chunk);
    } catch (err) {
      lines.push(`(Failed to read this item: ${err instanceof Error ? err.message : String(err)})`);
    }
    lines.push("");
    if (lines.join("\n").length > MAX_TOTAL_FOLDER_CHARS) {
      lines.push(`...[stopped: folder content capped at ${MAX_TOTAL_FOLDER_CHARS} characters]...`);
      break;
    }
  }

  return {
    title: `Drive folder: ${folderName}`,
    content: truncateText(lines.join("\n"), MAX_TOTAL_FOLDER_CHARS),
  };
}

/**
 * Fetch real Drive content for a hire-scoped URL (folder listing + per-file text).
 * Returns null if URL is not a Drive link, credentials are missing, or the API call fails.
 * Callers should fall back to generic URL fetch only for non-Drive pages.
 */
export async function fetchGoogleDriveUrlContent(
  rawUrl: string
): Promise<{ title: string; content: string } | null> {
  const parsed = parseDriveGoogleUrl(rawUrl);
  if (!parsed) return null;

  const drive = buildDriveClient();
  if (!drive) return null;

  try {
    if (parsed.kind === "folder") {
      const meta = await driveFileMeta(drive, parsed.id);
      if (meta.mimeType !== "application/vnd.google-apps.folder") {
        return ingestSingleDriveFile(drive, parsed.id, meta.name);
      }
      return await ingestDriveFolder(drive, parsed.id, meta.name, rawUrl.trim());
    }

    if (parsed.kind === "file") {
      return await ingestSingleDriveFile(drive, parsed.id);
    }

    // open?id= — resolve via metadata
    const meta = await driveFileMeta(drive, parsed.id);
    if (meta.mimeType === "application/vnd.google-apps.folder") {
      return await ingestDriveFolder(drive, meta.id, meta.name, rawUrl.trim());
    }
    return await ingestSingleDriveFile(drive, meta.id, meta.name);
  } catch (e) {
    console.error("Google Drive URL ingest error:", e);
    return null;
  }
}

export async function fetchDriveDocuments(): Promise<IngestionDoc[]> {
  const drive = buildDriveClient();
  if (!drive) {
    console.warn("Skipping Google Drive Sync: No credentials configured.");
    return [];
  }

  try {
    const res = await drive.files.list({
      pageSize: 10,
      fields: "nextPageToken, files(id, name, mimeType)",
      q: "mimeType='application/vnd.google-apps.document'",
    });

    const files = res.data.files || [];

    const docs = await Promise.all(
      files.map(async (f) => {
        let content = "";
        try {
          const exported = await drive.files.export({
            fileId: f.id!,
            mimeType: "text/plain",
          });
          content = typeof exported.data === "string" ? exported.data : "";
        } catch {
          content = "";
        }
        return {
          id: f.id!,
          title: f.name || "Untitled Google Doc",
          content: content || `Google Drive document: ${f.name}`,
        };
      })
    );

    return docs;
  } catch (e) {
    console.error("Google Drive API Error:", e);
    return [];
  }
}
