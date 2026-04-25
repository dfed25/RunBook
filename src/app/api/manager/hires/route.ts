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
    const body = await req.json();
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim();
    const email = String(body.email || "").trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
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
