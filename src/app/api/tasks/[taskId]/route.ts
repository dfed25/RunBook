import { NextResponse } from "next/server";
import { duplicateTask, moveTask, removeTask } from "@/lib/dataStore";
import { TRAINEES } from "@/lib/trainees";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ taskId: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { taskId } = await params;
    const removed = await removeTask(taskId);
    if (!removed) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to remove task" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { taskId } = await params;
    const body = await req.json();
    const action = String(body.action || "").trim();

    if (action === "move") {
      const direction = body.direction === "up" ? "up" : body.direction === "down" ? "down" : null;
      if (!direction) {
        return NextResponse.json({ error: "Invalid move direction" }, { status: 400 });
      }
      const tasks = await moveTask(taskId, direction);
      if (!tasks) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, tasks });
    }

    if (action === "duplicate") {
      const assignees = Array.isArray(body.assignees) ? body.assignees : [];
      const validAssignees = assignees.filter((name) => TRAINEES.includes(name));
      const copies = await duplicateTask(taskId, validAssignees);
      if (copies === null) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, created: copies });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
