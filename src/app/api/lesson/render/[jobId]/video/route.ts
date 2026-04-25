import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { renderOutputPath } from "@/lib/lessonRenderStore";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const outputPath = renderOutputPath(jobId);
    const data = await fs.readFile(outputPath);
    return new NextResponse(data, {
      headers: {
        "content-type": "video/mp4",
        "content-disposition": `inline; filename="${jobId}.mp4"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Rendered video not found" }, { status: 404 });
  }
}
