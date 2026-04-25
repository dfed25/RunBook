import { NextResponse } from "next/server";
import path from "path";
import { addCustomDoc } from "@/lib/dataStore";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv", ".json"]);
const MAX_UPLOAD_BYTES = 1_000_000;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use txt, md, csv, or json." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const content = (await file.text()).trim();
    if (!content) {
      return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
    }

    const customTitle = String(formData.get("title") || "").trim();
    const title = customTitle || file.name;
    const created = await addCustomDoc({ title, content, sourceType: "upload" });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to upload doc" }, { status: 500 });
  }
}
