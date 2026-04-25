import { NextResponse } from "next/server";
import { Lesson } from "@/lib/types";
import { createLessonRenderJob, setLessonRenderStatus } from "@/lib/lessonRenderStore";
import { renderLessonVideo } from "@/lib/lessonVideoRenderer";

export const runtime = "nodejs";

function isLessonPayload(value: unknown): value is Lesson {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<Lesson>;
  return typeof maybe.title === "string" && Array.isArray(maybe.slides) && typeof maybe.summary === "string";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!isLessonPayload(body.lesson)) {
      return NextResponse.json({ error: "lesson payload is required" }, { status: 400 });
    }

    const job = await createLessonRenderJob(body.lesson);
    try {
      await setLessonRenderStatus(job.id, "running");
      await renderLessonVideo(job.id, body.lesson);
      const completed = await setLessonRenderStatus(job.id, "completed", {
        outputUrl: `/api/lesson/render/${job.id}/video`,
      });
      return NextResponse.json(completed || job, { status: 200 });
    } catch (error) {
      console.error("Lesson video render failed:", error);
      const failed = await setLessonRenderStatus(job.id, "failed", {
        error: error instanceof Error ? error.message : "Unknown render error",
      });
      return NextResponse.json(failed || job, { status: 500 });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to queue lesson render" }, { status: 500 });
  }
}
