import { NextResponse } from "next/server";
import { addHireSource, getHireSources } from "@/lib/dataStore";
import { KNOWLEDGE_SOURCE_TYPES, type KnowledgeSourceType } from "@/lib/types";
import { requireHireAccess } from "@/lib/apiAuth";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ hireId: string }>;
};

const sourceTypes: readonly KnowledgeSourceType[] = KNOWLEDGE_SOURCE_TYPES;

export async function GET(_req: Request, { params }: Params) {
  try {
    const { hireId } = await params;
    const auth = await requireHireAccess(hireId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
        { status: auth.status }
      );
    }
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
    const auth = await requireHireAccess(hireId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
        { status: auth.status }
      );
    }
    const body = await req.json();
    const rawType = String(body.type || "").trim();
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    const providerRef = String(body.providerRef || "").trim();
    if (!sourceTypes.includes(rawType as KnowledgeSourceType)) {
      return NextResponse.json({ error: "Invalid source type" }, { status: 400 });
    }
    const type = rawType as KnowledgeSourceType;
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
