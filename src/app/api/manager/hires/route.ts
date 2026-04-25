import { NextResponse } from "next/server";
import { addHire, getHires } from "@/lib/dataStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const hires = await getHires();
    return NextResponse.json({ hires });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load hires" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid or missing JSON body" }, { status: 400 });
    }

    const name = String((body as { name?: unknown }).name || "").trim().slice(0, 120);
    const role = String((body as { role?: unknown }).role || "").trim().slice(0, 120);
    const email = String((body as { email?: unknown }).email || "").trim().slice(0, 254).toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (email && !emailRegex.test(email)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const created = await addHire({
      name,
      role: role || undefined,
      email: email || undefined
    });
    return NextResponse.json({ hire: created }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create hire" }, { status: 500 });
  }
}
