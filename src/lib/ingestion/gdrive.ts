import { google } from "googleapis";

// Initializes the Google Drive API client using application-default rules
// Gracefully degrades if scopes or keys are missing.
const getDriveClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  
  const auth = new google.auth.OAuth2(
    clientId,
    process.env.GOOGLE_CLIENT_SECRET
  );
  // Ideally auth.setCredentials({ refresh_token: ... }) would map to our Database keys
  return google.drive({ version: "v3", auth });
};

export async function fetchDriveDocuments() {
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
    
    // For full implementation, drive.files.export would parse Google Docs out as text format
    return files.map(f => ({
      id: f.id!,
      title: f.name || "Untitled Google Doc",
      content: `A synchronized document originating from Google Drive: ${f.name}`
    }));

  } catch (e) {
    console.error("Google Drive API Error:", e);
    return [];
  }
}
