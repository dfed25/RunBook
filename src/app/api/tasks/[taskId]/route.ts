import { NextResponse } from "next/server";
import { duplicateTask, getHires, moveTask, removeTask } from "@/lib/dataStore";

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
      const assigneeIds: unknown[] = Array.isArray(body.assigneeIds)
        ? body.assigneeIds
        : Array.isArray(body.assignees)
          ? body.assignees
          : [];
      const hires = await getHires();
      const hireIdSet = new Set(hires.filter((hire) => hire.active).map((hire) => hire.id));
      const validAssigneeIds = assigneeIds
        .filter((id): id is string => typeof id === "string")
        .filter((id) => hireIdSet.has(id));
      if (validAssigneeIds.length === 0) {
        return NextResponse.json({ error: "No valid assignees provided" }, { status: 400 });
      }
      const copies = await duplicateTask(taskId, validAssigneeIds);
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
