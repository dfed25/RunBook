import { NextResponse, after } from "next/server";
import { Lesson } from "@/lib/types";
import { createLessonRenderJob, setLessonRenderStatus } from "@/lib/lessonRenderStore";
import { renderLessonVideo } from "@/lib/lessonVideoRenderer";
import { requireHireAccess } from "@/lib/apiAuth";

export const runtime = "nodejs";
const MAX_RENDER_CONCURRENCY = 2;
const MAX_LESSON_JSON_BYTES = 200_000;
let activeRenders = 0;

function isLessonPayload(value: unknown): value is Lesson {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Partial<Lesson>;
  return typeof maybe.title === "string" && Array.isArray(maybe.slides) && typeof maybe.summary === "string";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const hireId = String(body.hireId || "").trim();
    if (!hireId) {
      return NextResponse.json({ error: "hireId is required" }, { status: 400 });
    }
    const auth = await requireHireAccess(hireId);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Authentication required" : "Forbidden" },
        { status: auth.status }
      );
    }
    if (!isLessonPayload(body.lesson)) {
      return NextResponse.json({ error: "lesson payload is required" }, { status: 400 });
    }
    const lessonJson = JSON.stringify(body.lesson);
    if (body.lesson.slides.length > 20 || lessonJson.length > MAX_LESSON_JSON_BYTES) {
      return NextResponse.json({ error: "lesson payload too large" }, { status: 400 });
    }
    if (activeRenders >= MAX_RENDER_CONCURRENCY) {
      return NextResponse.json({ error: "Render queue is busy. Try again shortly." }, { status: 429 });
    }
    activeRenders += 1;

    const job = await createLessonRenderJob(body.lesson);
    after(async () => {
      try {
        await setLessonRenderStatus(job.id, "running");
        await renderLessonVideo(job.id, body.lesson);
        await setLessonRenderStatus(job.id, "completed", {
          outputUrl: `/api/lesson/render/${job.id}/video`,
        });
      } catch (error) {
        console.error("Lesson video render failed:", error);
        try {
          await setLessonRenderStatus(job.id, "failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        } catch (storeError) {
          console.error("Failed to persist render failure:", storeError);
        }
      } finally {
        activeRenders = Math.max(0, activeRenders - 1);
      }
    });

    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    activeRenders = Math.max(0, activeRenders - 1);
    console.error(error);
    return NextResponse.json({ error: "Failed to queue lesson render" }, { status: 500 });
  }
}
