import { NextRequest, NextResponse } from "next/server";
import { verifyEmbedSession } from "@/lib/embedSession";
import { assertProjectOwner } from "@/lib/embedStore";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = verifyEmbedSession(req.cookies.get("embed_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { projectId } = await params;
  const project = await assertProjectOwner(projectId, session.githubId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}
