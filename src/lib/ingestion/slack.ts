import { WebClient } from "@slack/web-api";

// Initialize a Slack WebClient instance
// Gracefully returns null if keys are blank
const getSlackClient = () => {
  const token = process.env.SLACK_BOT_TOKEN || process.env.SLACK_CLIENT_SECRET;
  if (!token) return null;
  return new WebClient(token);
};

export async function fetchSlackChannelHistory(channelId: string) {
  const slack = getSlackClient();
  if (!slack) {
    console.warn("Skipping Slack Sync: No Bot Token configured.");
    return [];
  }

  try {
    // Pull the last 50 messages from a designated internal onboarding channel
    const result = await slack.conversations.history({
      channel: channelId,
      limit: 50
    });

    if (!result.messages) return [];

    return result.messages.map(msg => ({
      id: msg.ts || Date.now().toString(),
      title: `Slack Message from ${msg.user || "Unknown"}`,
      content: msg.text || ""
    }));

  } catch (error) {
    console.error("Slack API Error:", error);
    return [];
  }
}
