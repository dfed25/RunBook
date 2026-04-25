import { NextResponse } from "next/server";
import { syncUserKnowledge } from "@/lib/vectorizer";
import { requireHireAccess } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const hireId = typeof body?.hireId === "string" ? body.hireId : undefined;
    if (hireId) {
      const auth = await requireHireAccess(hireId);
      if (!auth.ok) {
        return NextResponse.json(
          { success: false, error: auth.status === 401 ? "Authentication required" : "Forbidden" },
          { status: auth.status }
        );
      }
    }
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
