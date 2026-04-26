import { NextRequest, NextResponse } from "next/server";
import { verifyEmbedSession } from "@/lib/embedSession";
import { createProject, listProjectsForOwner } from "@/lib/embedStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = verifyEmbedSession(req.cookies.get("embed_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const projects = await listProjectsForOwner(session.githubId);
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = verifyEmbedSession(req.cookies.get("embed_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const githubRepoFullName = String(body.githubRepoFullName || "").trim();
    const defaultBranch = String(body.defaultBranch || "main").trim();
    const siteUrl = body.siteUrl != null ? String(body.siteUrl).trim() : "";
    if (!name || !githubRepoFullName) {
      return NextResponse.json({ error: "name and githubRepoFullName are required" }, { status: 400 });
    }
    if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(githubRepoFullName)) {
      return NextResponse.json({ error: "githubRepoFullName must look like owner/repo" }, { status: 400 });
    }
    const { project, rawApiKey } = await createProject({
      ownerGitHubId: session.githubId,
      ownerGitHubLogin: session.login,
      name,
      githubRepoFullName,
      defaultBranch,
      siteUrl: siteUrl || undefined
    });
    return NextResponse.json({ project, apiKey: rawApiKey }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
