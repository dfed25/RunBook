import { NextResponse } from "next/server";
import { getLessonRenderJob } from "@/lib/lessonRenderStore";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const job = await getLessonRenderJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Render job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to read render job" }, { status: 500 });
  }
}
