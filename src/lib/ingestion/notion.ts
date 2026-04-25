import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  BlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

interface IngestionDoc {
  id: string;
  title: string;
  content: string;
}

const RICH_TEXT_BLOCKS = [
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "to_do",
  "quote",
  "callout",
  "code",
] as const;

const getNotionClient = () => {
  const secret = process.env.NOTION_CLIENT_SECRET ?? process.env.NOTION_API_KEY;
  if (!secret) return null;
  return new Client({ auth: secret });
};

function extractBlockText(block: BlockObjectResponse): string {
  if (!("type" in block)) return "";
  const blockType = block.type;
  if (!RICH_TEXT_BLOCKS.includes(blockType as (typeof RICH_TEXT_BLOCKS)[number])) return "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const richText = (block as Record<string, any>)[blockType]?.rich_text;
  if (!Array.isArray(richText)) return "";
  return richText.map((t: { plain_text: string }) => t.plain_text).join("");
}

export async function fetchNotionPages(): Promise<IngestionDoc[]> {
  const notion = getNotionClient();
  if (!notion) {
    console.warn("Skipping Notion Sync: No Secret configured.");
    return [];
  }

  try {
    // Paginate through all search results
    const allPages: PageObjectResponse[] = [];
    let cursor: string | undefined;
    do {
      const response = await notion.search({
        filter: { value: "page", property: "object" },
        start_cursor: cursor,
      });
      for (const result of response.results) {
        allPages.push(result as PageObjectResponse);
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    const pages: IngestionDoc[] = [];

    for (const page of allPages) {
      const titleProp = page.properties?.["title"] ?? page.properties?.["Name"];
      let title = "Untitled Page";
      if (titleProp?.type === "title" && titleProp.title.length > 0) {
        title = titleProp.title[0].plain_text;
      }

      // Paginate block children and extract all rich-text block types
      let content = "";
      try {
        let blockCursor: string | undefined;
        do {
          const blocks = await notion.blocks.children.list({
            block_id: page.id,
            start_cursor: blockCursor,
          });
          for (const block of blocks.results) {
            const text = extractBlockText(block as BlockObjectResponse);
            if (text) content += text + "\n";
          }
          blockCursor = blocks.has_more ? (blocks.next_cursor ?? undefined) : undefined;
        } while (blockCursor);
      } catch {
        content = `Notion page: ${title}`;
      }

      pages.push({
        id: page.id,
        title,
        content: content.trim() || `Notion page: ${title}`,
      });
    }

    return pages;
  } catch (err) {
    console.error("Notion API Error:", err);
    return [];
  }
}
