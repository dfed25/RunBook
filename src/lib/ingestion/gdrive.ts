import { google } from "googleapis";

interface IngestionDoc {
  id: string;
  title: string;
  content: string;
}

const getDriveClient = () => {
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
};

export async function fetchDriveDocuments(): Promise<IngestionDoc[]> {
  const drive = getDriveClient();
  if (!drive) {
    console.warn("Skipping Google Drive Sync: No credentials configured.");
    return [];
  }

  try {
    const res = await drive.files.list({
      pageSize: 10,
      fields: "nextPageToken, files(id, name, mimeType)",
      q: "mimeType='application/vnd.google-apps.document'"
    });

    const files = res.data.files || [];

    const docs = await Promise.all(
      files.map(async (f) => {
        let content = "";
        try {
          const exported = await drive.files.export({
            fileId: f.id!,
            mimeType: "text/plain"
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
