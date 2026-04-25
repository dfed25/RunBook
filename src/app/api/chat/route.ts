import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Chat endpoint is not implemented yet." },
    { status: 501 },
  );
}
