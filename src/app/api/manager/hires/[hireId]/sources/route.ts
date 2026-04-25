import { NextResponse } from "next/server";
import { addHireSource, getHireSources } from "@/lib/dataStore";
import type { KnowledgeSourceType } from "@/lib/types";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ hireId: string }>;
};

const sourceTypes: KnowledgeSourceType[] = [
  "notion_page",
  "notion_database",
  "google_doc",
  "google_drive_folder",
  "google_drive_file",
  "slack_channel",
  "url"
];

export async function GET(_req: Request, { params }: Params) {
  try {
    const { hireId } = await params;
    const sources = await getHireSources(hireId);
    return NextResponse.json({ sources });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load sources" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { hireId } = await params;
    const body = await req.json();
    const type = String(body.type || "").trim() as KnowledgeSourceType;
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    const providerRef = String(body.providerRef || "").trim();
    if (!sourceTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid source type" }, { status: 400 });
    }
    if (!title || !url) {
      return NextResponse.json({ error: "title and url are required" }, { status: 400 });
    }

    const source = await addHireSource({
      hireId,
      type,
      title,
      url,
      providerRef: providerRef || undefined
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create source" }, { status: 500 });
  }
}
