import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_CLIENT_ID is not configured" }, { status: 500 });
  }

  const redirectUri =
    process.env.GITHUB_OAUTH_REDIRECT_URL?.trim() ||
    `${req.nextUrl.origin}/api/embed/github/callback`;

  const state = randomBytes(24).toString("hex");
  const returnTo = req.nextUrl.searchParams.get("return") || "/studio";

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "read:user repo");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set("embed_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  res.cookies.set("embed_oauth_return", returnTo, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return res;
}
