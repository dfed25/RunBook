import { WebClient } from "@slack/web-api";

interface IngestionDoc {
  id: string;
  title: string;
  content: string;
}

const getSlackClient = () => {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  return new WebClient(token);
};

export async function fetchSlackChannelHistory(
  channelId: string
): Promise<IngestionDoc[]> {
  const slack = getSlackClient();
  if (!slack) {
    console.warn("Skipping Slack Sync: No Bot Token configured.");
    return [];
  }

  try {
    const result = await slack.conversations.history({
      channel: channelId,
      limit: 50
    });

    if (!result.messages) return [];

    return result.messages
      .filter((msg): msg is typeof msg & { ts: string; text: string } =>
        typeof msg.ts === "string" && typeof msg.text === "string" && msg.text.trim().length > 0
      )
      .map((msg) => ({
        id: msg.ts,
        title: `Slack Message from ${msg.user || "Unknown"}`,
        content: msg.text,
      }));
  } catch (error) {
    console.error("Slack API Error:", error);
    return [];
  }
}
