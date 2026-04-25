import { NextResponse } from "next/server";
import { removeHireSource } from "@/lib/dataStore";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ hireId: string; sourceId: string }>;
};

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { hireId, sourceId } = await params;
    const removed = await removeHireSource(hireId, sourceId);
    if (!removed) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 });
  }
}
