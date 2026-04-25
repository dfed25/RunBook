import { NextResponse } from "next/server";
import { patchTask } from "@/lib/dataStore";
import { OnboardingTask } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const taskId = typeof (body as { taskId?: unknown })?.taskId === "string"
      ? (body as { taskId: string }).taskId
      : null;
    const statusRaw = typeof (body as { status?: unknown })?.status === "string"
      ? (body as { status: string }).status
      : null;
    const currentStepRaw = (body as { currentStep?: unknown }).currentStep;
    const currentStep =
      typeof currentStepRaw === "number" && Number.isFinite(currentStepRaw) ? currentStepRaw : undefined;
    const ALLOWED: OnboardingTask["status"][] = ["todo", "in_progress", "complete"];

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const hasStatus = statusRaw !== null && statusRaw !== "";
    const hasStep = currentStep !== undefined;

    if (!hasStatus && !hasStep) {
      return NextResponse.json({ error: "Provide status and/or currentStep" }, { status: 400 });
    }

    if (hasStatus && !ALLOWED.includes(statusRaw as OnboardingTask["status"])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updatedTask = await patchTask(taskId, {
      ...(hasStatus ? { status: statusRaw as OnboardingTask["status"] } : {}),
      ...(hasStep ? { currentStep } : {}),
    });
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found or invalid patch" }, { status: 404 });
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
