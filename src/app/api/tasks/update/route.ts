import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, status } = body;
    const ALLOWED = ["todo", "in_progress", "complete"] as const;

    if (!taskId || !status) {
      return NextResponse.json({ error: "Missing taskId or status" }, { status: 400 });
    }
    
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    console.log(`Updated task ${taskId} to status ${status}`);

    return NextResponse.json({ success: true, taskId, status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
