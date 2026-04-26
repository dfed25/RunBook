import { NextRequest, NextResponse } from "next/server";
import { verifyEmbedSession } from "@/lib/embedSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = verifyEmbedSession(req.cookies.get("embed_session")?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    githubId: session.githubId,
    login: session.login
  });
}
