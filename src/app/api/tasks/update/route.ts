import { NextResponse } from "next/server";
import { updateTaskStatus } from "@/lib/dataStore";
import { OnboardingTask } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const taskId = typeof (body as { taskId?: unknown })?.taskId === "string"
      ? (body as { taskId: string }).taskId
      : null;
    const status = typeof (body as { status?: unknown })?.status === "string"
      ? (body as { status: string }).status
      : null;
    const ALLOWED: OnboardingTask["status"][] = ["todo", "in_progress", "complete"];

    if (!taskId || !status) {
      return NextResponse.json({ error: "taskId and status must be strings" }, { status: 400 });
    }
    
    if (!ALLOWED.includes(status as OnboardingTask["status"])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updatedTask = await updateTaskStatus(taskId, status as OnboardingTask["status"]);
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
