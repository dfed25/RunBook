import { promises as fs } from "fs";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { renderOutputPath } from "@/lib/lessonRenderStore";

export const runtime = "nodejs";
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const OUTPUT_ROOT = path.resolve(process.cwd(), ".runbook-data", "lesson-renders", "outputs");

export async function GET(req: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    if (!JOB_ID_PATTERN.test(jobId)) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }
    const outputPath = renderOutputPath(jobId);
    const resolvedOutputPath = path.resolve(outputPath);
    if (!resolvedOutputPath.startsWith(`${OUTPUT_ROOT}${path.sep}`)) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }

    const stat = await fs.stat(resolvedOutputPath);
    const size = stat.size;
    const range = req.headers.get("range");
    const commonHeaders = {
      "accept-ranges": "bytes",
      "content-type": "video/mp4",
      "content-disposition": `inline; filename="${jobId}.mp4"`,
    };

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: { ...commonHeaders, "content-range": `bytes */${size}` },
        });
      }
      const start = match[1] === "" ? 0 : Number(match[1]);
      const end = match[2] === "" ? size - 1 : Number(match[2]);
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end < start ||
        start >= size ||
        end >= size
      ) {
        return new NextResponse(null, {
          status: 416,
          headers: { ...commonHeaders, "content-range": `bytes */${size}` },
        });
      }
      const nodeStream = createReadStream(resolvedOutputPath, { start, end });
      return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
        status: 206,
        headers: {
          ...commonHeaders,
          "content-range": `bytes ${start}-${end}/${size}`,
          "content-length": String(end - start + 1),
        },
      });
    }

    const nodeStream = createReadStream(resolvedOutputPath);
    return new NextResponse(Readable.toWeb(nodeStream) as ReadableStream, {
      status: 200,
      headers: {
        ...commonHeaders,
        "content-length": String(size),
      },
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return NextResponse.json({ error: "Rendered video not found" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
