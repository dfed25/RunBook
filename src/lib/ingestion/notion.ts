import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const getNotionClient = () => {
  const secret = process.env.NOTION_CLIENT_SECRET ?? process.env.NOTION_API_KEY;
  if (!secret) return null;
  return new Client({ auth: secret });
};

interface IngestionDoc {
  id: string;
  title: string;
  content: string;
}

export async function fetchNotionPages(): Promise<IngestionDoc[]> {
  const notion = getNotionClient();
  if (!notion) {
    console.warn("Skipping Notion Sync: No Secret configured.");
    return [];
  }

  try {
    const response = await notion.search({
      filter: { value: "page", property: "object" }
    });

    const pages: IngestionDoc[] = [];

    for (const page of response.results) {
      const p = page as PageObjectResponse;
      const titleProp = p.properties?.["title"] ?? p.properties?.["Name"];
      let title = "Untitled Page";
      if (titleProp?.type === "title" && titleProp.title.length > 0) {
        title = titleProp.title[0].plain_text;
      }

      // Fetch actual block content for RAG quality
      let content = "";
      try {
        const blocks = await notion.blocks.children.list({ block_id: page.id });
        for (const block of blocks.results) {
          if ("type" in block && block.type === "paragraph") {
            const richText = block.paragraph?.rich_text ?? [];
            content += richText.map((t) => t.plain_text).join("") + "\n";
          }
        }
      } catch {
        content = `Notion page: ${title}`;
      }

      pages.push({ id: page.id, title, content: content.trim() || `Notion page: ${title}` });
    }

    return pages;
  } catch (err) {
    console.error("Notion API Error:", err);
    return [];
  }
}
