import { NextRequest, NextResponse } from "next/server";
import { saveGitHubToken } from "@/lib/embedStore";
import { signEmbedSession } from "@/lib/embedSession";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "GitHub OAuth is not configured" }, { status: 500 });
  }

  const url = req.nextUrl;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("embed_oauth_state")?.value;
  const returnTo = req.cookies.get("embed_oauth_return")?.value || "/studio";

  if (error) {
    return NextResponse.redirect(new URL(`/studio?error=${encodeURIComponent(error)}`, req.nextUrl.origin));
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/studio?error=oauth_state", req.nextUrl.origin));
  }

  const redirectUri =
    process.env.GITHUB_OAUTH_REDIRECT_URL?.trim() ||
    `${req.nextUrl.origin}/api/embed/github/callback`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  });

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    const msg = tokenJson.error_description || tokenJson.error || "token_exchange_failed";
    return NextResponse.redirect(new URL(`/studio?error=${encodeURIComponent(msg)}`, req.nextUrl.origin));
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json"
    }
  });
  const user = (await userRes.json()) as { id?: number; login?: string };
  if (!user.id || !user.login) {
    return NextResponse.redirect(new URL("/studio?error=github_user", req.nextUrl.origin));
  }

  await saveGitHubToken({
    githubId: user.id,
    login: user.login,
    accessToken: tokenJson.access_token,
    createdAt: new Date().toISOString()
  });

  const session = signEmbedSession({ githubId: user.id, login: user.login });
  const dest = returnTo.startsWith("/") ? new URL(returnTo, req.nextUrl.origin) : new URL("/studio", req.nextUrl.origin);
  const res = NextResponse.redirect(dest);
  const secure = req.nextUrl.protocol === "https:";
  res.cookies.set("embed_session", session, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60
  });
  res.cookies.delete("embed_oauth_state");
  res.cookies.delete("embed_oauth_return");
  return res;
}
