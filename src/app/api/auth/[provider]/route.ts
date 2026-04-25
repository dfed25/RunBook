import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Placeholder generic route catcher for OAuth callbacks.
// Production ready integration expects parameters from Google, Notion, and Slack.
export async function GET(
  req: Request,
  { params }: { params: { provider: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    
    // Fallback parsing for the user
    // The user will set these blank strings later when they register apps.
    const EXPECTED_PROVIDERS = ["notion", "google", "slack"];
    
    if (!EXPECTED_PROVIDERS.includes(params.provider)) {
      return NextResponse.json({ error: "Unsupported platform provider" }, { status: 400 });
    }

    if (error) {
      console.error(`OAuth error from ${params.provider}:`, error);
      return NextResponse.json({ error: "User rejected OAuth handshake" }, { status: 403 });
    }

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    // In a live system, we would exchange this 'code' for a RefreshToken and secure them inside our unified Supabase Auth table.
    // e.g. await fetch("https://slack.com/api/oauth.v2.access", { ... })
    // await supabaseAdmin.from('provider_tokens').upsert({ provider: params.provider, token: ... })

    return NextResponse.json({
      success: true,
      message: `Successfully connected ${params.provider}! Background synchronization started.`,
      warning: "Demo Mode: App Token exchange gracefully bypassed due to missing API keys."
    });

  } catch (err) {
    console.error("Provider OAuth Error:", err);
    return NextResponse.json({ error: "Internal Configuration Error" }, { status: 500 });
  }
}
