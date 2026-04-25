import { NextResponse } from "next/server";
import { getManagerOverview } from "@/lib/dataStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const overview = await getManagerOverview();
    return NextResponse.json(overview);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load manager overview" }, { status: 500 });
  }
}
