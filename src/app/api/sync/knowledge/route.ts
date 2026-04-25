import { NextResponse } from "next/server";
import { syncUserKnowledge } from "@/lib/vectorizer";

export async function POST() {
  try {
    const result = await syncUserKnowledge();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Knowledge sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Knowledge sync failed" },
      { status: 500 },
    );
  }
}
