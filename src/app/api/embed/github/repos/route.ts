import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { verifyEmbedSession } from "@/lib/embedSession";
import { getGitHubToken } from "@/lib/embedStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = verifyEmbedSession(req.cookies.get("embed_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const stored = await getGitHubToken(session.githubId);
  if (!stored?.accessToken) {
    return NextResponse.json({ error: "No GitHub token — connect again" }, { status: 400 });
  }

  const octokit = new Octokit({ auth: stored.accessToken });
  try {
    const repos: { full_name: string; default_branch: string | null }[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, page, sort: "updated" });
      for (const r of data) {
        repos.push({ full_name: r.full_name, default_branch: r.default_branch });
      }
      if (data.length < 100) break;
    }
    return NextResponse.json({ repos });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list repositories" },
      { status: 500 }
    );
  }
}
