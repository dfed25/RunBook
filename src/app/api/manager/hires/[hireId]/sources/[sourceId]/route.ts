import { NextResponse } from "next/server";
import { removeHireSource } from "@/lib/dataStore";
import { requireHireAccess } from "@/lib/apiAuth";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ hireId: string; sourceId: string }>;
};

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { hireId, sourceId } = await params;
    const auth = await requireHireAccess(hireId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
        { status: auth.status }
      );
    }
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
