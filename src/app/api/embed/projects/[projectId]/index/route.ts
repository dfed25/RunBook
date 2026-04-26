import { NextRequest, NextResponse } from "next/server";
import { verifyEmbedSession } from "@/lib/embedSession";
import { assertProjectOwner, getGitHubToken } from "@/lib/embedStore";
import { indexGitHubRepo } from "@/lib/embedIndexer";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = verifyEmbedSession(req.cookies.get("embed_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { projectId } = await params;
  const project = await assertProjectOwner(projectId, session.githubId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const gh = await getGitHubToken(session.githubId);
  if (!gh?.accessToken) {
    return NextResponse.json({ error: "GitHub token missing — reconnect" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is required to embed and index repository chunks" },
      { status: 503 }
    );
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 503 }
    );
  }

  try {
    const result = await indexGitHubRepo(project, gh.accessToken);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Index failed" },
      { status: 500 }
    );
  }
}
