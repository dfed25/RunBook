import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, status } = body;
    
    if (!taskId || !status) {
      return NextResponse.json({ error: "Missing taskId or status" }, { status: 400 });
    }

    // In a real database we would update the row here.
    // E.g. db.tasks.update({ id: taskId }, { status });
    console.log(`Updated task ${taskId} to status ${status}`);

    return NextResponse.json({ success: true, taskId, status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
