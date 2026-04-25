import { NextResponse } from "next/server";
import { addCustomDoc, getCustomDocs } from "@/lib/dataStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const docs = await getCustomDocs();
    return NextResponse.json(docs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to read docs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();

    if (!title || !content) {
      return NextResponse.json({ error: "title and content are required" }, { status: 400 });
    }

    const created = await addCustomDoc({ title, content, sourceType: "text" });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save doc" }, { status: 500 });
  }
}
