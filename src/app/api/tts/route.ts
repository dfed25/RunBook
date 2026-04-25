import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body?.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!elevenLabsKey) {
      return NextResponse.json({ error: "ELEVENLABS_API_KEY is not configured" }, { status: 503 });
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";
    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": elevenLabsKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 4500),
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      return NextResponse.json({ error: `ElevenLabs error: ${response.status} ${err}` }, { status: 502 });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to synthesize speech" }, { status: 500 });
  }
}

