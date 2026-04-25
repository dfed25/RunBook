import { NextResponse } from "next/server";
import { addTask, getHires, getTasks } from "@/lib/dataStore";

export const runtime = "nodejs";

function normalizeTaskDescription(input: {
  description: string;
  objective?: string;
  steps?: string;
  verification?: string;
  escalation?: string;
}): string {
  const clean = (value?: string) => String(value || "").trim();
  const description = clean(input.description);
  const objective = clean(input.objective);
  const steps = clean(input.steps);
  const verification = clean(input.verification);
  const escalation = clean(input.escalation);

  // If caller already provided structured content, keep it.
  if (/objective:|steps:|verification:|if blocked:/i.test(description)) {
    return description;
  }

  const parts: string[] = [];
  if (objective) {
    parts.push(`Objective:\n${objective}`);
  } else if (description) {
    parts.push(`Objective:\n${description}`);
  }

  if (steps) {
    const normalizedSteps = steps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => (/^\d+\./.test(line) ? line : `${idx + 1}. ${line}`))
      .join("\n");
    parts.push(`Steps:\n${normalizedSteps}`);
  }

  if (verification) {
    parts.push(`Verification:\n${verification}`);
  }
  if (escalation) {
    parts.push(`If blocked:\n${escalation}`);
  }

  // Fallback to raw description if nothing else is set.
  return parts.join("\n\n") || description;
}

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
    const objective = String(body.objective || "").trim();
    const steps = String(body.steps || "").trim();
    const verification = String(body.verification || "").trim();
    const escalation = String(body.escalation || "").trim();
    const assigneeId = String(body.assigneeId || "").trim();
    const assignee = String(body.assignee || "").trim();
    const estimatedTime = String(body.estimatedTime || "").trim();
    const sourceTitle = String(body.sourceTitle || "").trim();

    if (!title || (!description && !objective)) {
      return NextResponse.json({ error: "title and either description or objective are required" }, { status: 400 });
    }

    const hires = await getHires();
    const activeHires = hires.filter((hire) => hire.active);
    if (assigneeId && !activeHires.some((hire) => hire.id === assigneeId)) {
      return NextResponse.json({ error: "Unknown or inactive assigneeId" }, { status: 400 });
    }
    const chosenAssigneeId = assigneeId || activeHires[0]?.id || "";
    if (!chosenAssigneeId) {
      return NextResponse.json({ error: "No active hires available to assign tasks." }, { status: 400 });
    }

    const detailedDescription = normalizeTaskDescription({
      description,
      objective,
      steps,
      verification,
      escalation,
    });

    const created = await addTask({
      title,
      description: detailedDescription,
      assigneeId: chosenAssigneeId,
      assignee,
      estimatedTime,
      sourceTitle,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
