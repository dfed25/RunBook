import { NextResponse } from "next/server";
import { syncUserKnowledge } from "@/lib/vectorizer";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const hireId = typeof body?.hireId === "string" ? body.hireId : undefined;
    const result = await syncUserKnowledge(hireId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Knowledge sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Knowledge sync failed" },
      { status: 500 },
    );
  }
}
