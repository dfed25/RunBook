import { NextResponse } from "next/server";
import { addTask, getTasks } from "@/lib/dataStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to read tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const assignee = String(body.assignee || "").trim();
    const estimatedTime = String(body.estimatedTime || "").trim();
    const sourceTitle = String(body.sourceTitle || "").trim();

    if (!title || !description) {
      return NextResponse.json({ error: "title and description are required" }, { status: 400 });
    }

    const created = await addTask({ title, description, assignee, estimatedTime, sourceTitle });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
