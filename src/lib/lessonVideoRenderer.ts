import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Lesson } from "./types";
import { renderAssetDir, renderOutputPath } from "./lessonRenderStore";

const execFileAsync = promisify(execFile);
let drawtextSupport: boolean | null = null;

function slideDuration(slide: Lesson["slides"][number]) {
  const base = slide.estimatedDurationSec || 22;
  return Math.max(8, Math.min(70, Math.round(base)));
}

function bgColorForHint(hint?: string): string {
  const value = (hint || "").toLowerCase();
  if (value.includes("timeline")) return "0x172554";
  if (value.includes("checklist")) return "0x14532d";
  if (value.includes("support")) return "0x4a044e";
  if (value.includes("gradient")) return "0x1e293b";
  return "0x0f172a";
}

function fallbackVisualFilterForHint(hint?: string): string {
  const value = (hint || "").toLowerCase();
  if (value.includes("timeline")) return "hue=h=45:s=0.35,eq=contrast=1.05:brightness=-0.02";
  if (value.includes("checklist")) return "hue=h=95:s=0.32,eq=contrast=1.03:brightness=-0.03";
  if (value.includes("support")) return "hue=h=260:s=0.38,eq=contrast=1.06:brightness=-0.01";
  return "hue=h=200:s=0.28,eq=contrast=1.02:brightness=-0.02";
}

function pickSlideVoiceText(lesson: Lesson, index: number) {
  const slide = lesson.slides[index];
  if (!slide) return "";
  return `${slide.title}. ${slide.speakerNotes || slide.body}`.trim();
}

async function ensureFfmpegInstalled() {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
  } catch {
    throw new Error("ffmpeg is required but was not found on PATH.");
  }
}

async function supportsDrawtext(): Promise<boolean> {
  if (drawtextSupport != null) return drawtextSupport;
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-hide_banner", "-filters"]);
    drawtextSupport = /\bdrawtext\b/.test(stdout);
    return drawtextSupport;
  } catch {
    drawtextSupport = false;
    return false;
  }
}

function sanitizeForTextFile(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

async function writeSlideTextFile(assetDir: string, index: number, slideTitle: string, body: string): Promise<string> {
  const filePath = path.join(assetDir, `slide-${index + 1}.txt`);
  const text = `${sanitizeForTextFile(slideTitle)}\n\n${sanitizeForTextFile(body)}`;
  await fs.writeFile(filePath, text, "utf-8");
  return filePath;
}

async function renderSlideClip(
  assetDir: string,
  index: number,
  color: string,
  durationSec: number,
  textPath: string,
  useDrawtext: boolean,
  hint?: string
): Promise<string> {
  const output = path.join(assetDir, `clip-${index + 1}.mp4`);
  if (useDrawtext) {
    const relativeTextPath = path.basename(textPath);
    const drawtext = [
      `drawtext=textfile=${relativeTextPath}`,
      "reload=0",
      "fontcolor=white",
      "fontsize=42",
      "line_spacing=14",
      "x=72",
      "y=120",
      "box=1",
      "boxcolor=0x00000088",
      "boxborderw=24",
    ].join(":");

    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=1280x720:d=${durationSec}`,
      "-vf",
      drawtext,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-an",
      output,
    ], { cwd: assetDir });
    return output;
  }

  // Fallback for ffmpeg builds without drawtext (no libfreetype):
  // produce a moving patterned background so output isn't a flat single-color screen.
  const fallbackFilter = fallbackVisualFilterForHint(hint);
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=s=1280x720:r=30:d=${durationSec}`,
    "-vf",
    fallbackFilter,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-an",
    output,
  ], { cwd: assetDir });
  return output;
}

async function concatSlideClips(assetDir: string, clips: string[], outputFile: string) {
  const concatList = path.join(assetDir, "concat.txt");
  const body = clips.map((clip) => `file '${clip.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(concatList, body, "utf-8");

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatList,
    "-c",
    "copy",
    outputFile,
  ], { cwd: assetDir });
}

/**
 * Accuracy-safe video render:
 * - On-screen facts come from grounded lesson slides.
 * - visualHint only influences decorative background color.
 */
export async function renderLessonVideo(jobId: string, lesson: Lesson): Promise<{ outputPath: string }> {
  await ensureFfmpegInstalled();
  const useDrawtext = await supportsDrawtext();
  const assetDir = renderAssetDir(jobId);
  const outputPath = renderOutputPath(jobId);
  await fs.mkdir(assetDir, { recursive: true });

  const clips: string[] = [];
  for (let i = 0; i < lesson.slides.length; i += 1) {
    const slide = lesson.slides[i]!;
    const duration = slideDuration(slide);
    const color = bgColorForHint(slide.visualHint);
    const noteText = pickSlideVoiceText(lesson, i);
    const slideText = `${slide.body}${noteText ? `\n\nNarration: ${noteText}` : ""}`;
    const textPath = await writeSlideTextFile(assetDir, i, slide.title, slideText);
    const clipPath = await renderSlideClip(assetDir, i, color, duration, textPath, useDrawtext, slide.visualHint);
    clips.push(clipPath);
  }

  if (clips.length === 0) {
    throw new Error("No slide clips were rendered.");
  }
  await concatSlideClips(assetDir, clips, outputPath);
  return { outputPath };
}
