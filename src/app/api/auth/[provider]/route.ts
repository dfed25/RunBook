import { NextRequest, NextResponse } from "next/server";

const EXPECTED_PROVIDERS = ["notion", "google", "slack"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (!EXPECTED_PROVIDERS.includes(provider as (typeof EXPECTED_PROVIDERS)[number])) {
      return NextResponse.json({ error: "Unsupported platform provider" }, { status: 400 });
    }

    if (error) {
      console.error(`OAuth error from ${provider}:`, error);
      return NextResponse.json({ error: "User rejected OAuth handshake" }, { status: 403 });
    }

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // TODO: Validate OAuth state parameter against a server-issued cookie/JWT for CSRF protection.
    // TODO: Exchange `code` for a RefreshToken and persist in Supabase provider_tokens table.

    return NextResponse.json({
      success: true,
      message: `Successfully connected ${provider}! Background synchronization started.`,
      warning: "Demo Mode: Token exchange bypassed — API keys not yet configured."
    });

  } catch (err) {
    console.error("Provider OAuth Error:", err);
    return NextResponse.json({ error: "Internal Configuration Error" }, { status: 500 });
  }
}
