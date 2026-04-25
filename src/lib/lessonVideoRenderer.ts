import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Lesson } from "./types";
import { renderAssetDir, renderOutputPath } from "./lessonRenderStore";

const execFileAsync = promisify(execFile);
let drawtextSupport: boolean | null = null;
const VIDEO_FPS = "24";
const X264_PRESET = "veryfast";

function slideDuration(slide: Lesson["slides"][number]) {
  const base = slide.estimatedDurationSec || 22;
  return Math.max(8, Math.min(45, Math.round(base)));
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
  const base = "eq=contrast=1.04:brightness=-0.03:saturation=0.9";
  if (value.includes("timeline")) {
    return [
      "hue=h=38:s=0.42",
      base,
      "drawgrid=w=160:h=120:t=1:c=white@0.08",
      "drawbox=x=80:y=120:w=1120:h=84:color=0x38bdf8@0.20:t=fill",
      "drawbox=x=80:y=280:w=920:h=84:color=0x22d3ee@0.18:t=fill",
      "drawbox=x=80:y=440:w=720:h=84:color=0x67e8f9@0.16:t=fill",
    ].join(",");
  }
  if (value.includes("checklist")) {
    return [
      "hue=h=95:s=0.32",
      base,
      "drawbox=x=120:y=90:w=1040:h=540:color=0x052e16@0.55:t=fill",
      "drawbox=x=170:y=150:w=28:h=28:color=0x4ade80@0.75:t=fill",
      "drawbox=x=220:y=158:w=650:h=12:color=0x86efac@0.45:t=fill",
      "drawbox=x=170:y=250:w=28:h=28:color=0x22c55e@0.75:t=fill",
      "drawbox=x=220:y=258:w=590:h=12:color=0xbbf7d0@0.42:t=fill",
      "drawbox=x=170:y=350:w=28:h=28:color=0x16a34a@0.75:t=fill",
      "drawbox=x=220:y=358:w=700:h=12:color=0xdcfce7@0.40:t=fill",
    ].join(",");
  }
  if (value.includes("support")) {
    return [
      "hue=h=260:s=0.38",
      base,
      "drawbox=x=110:y=100:w=1060:h=520:color=0x4c1d95@0.45:t=fill",
      "drawbox=x=160:y=160:w=960:h=110:color=0x7c3aed@0.25:t=fill",
      "drawbox=x=160:y=320:w=960:h=250:color=0x8b5cf6@0.22:t=fill",
      "drawgrid=w=120:h=120:t=1:c=white@0.07",
    ].join(",");
  }
  return [
    "hue=h=200:s=0.30",
    base,
    "drawbox=x=100:y=80:w=1080:h=560:color=0x0f172a@0.50:t=fill",
    "drawbox=x=130:y=120:w=1020:h=90:color=0x334155@0.35:t=fill",
    "drawbox=x=130:y=250:w=480:h=360:color=0x1e293b@0.35:t=fill",
    "drawbox=x=670:y=250:w=480:h=360:color=0x1e3a8a@0.30:t=fill",
  ].join(",");
}

function pickSlideVoiceText(lesson: Lesson, index: number) {
  const slide = lesson.slides[index];
  if (!slide) return "";
  return `${slide.title}. ${slide.speakerNotes || slide.body}`.trim();
}

async function commandExists(command: string): Promise<boolean> {
  try {
    if (command === "say") {
      await execFileAsync("say", ["-v", "?"]);
      return true;
    }
    await execFileAsync(command, ["--help"]);
    return true;
  } catch {
    return false;
  }
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
      "expansion=none",
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
      "-preset",
      X264_PRESET,
      "-pix_fmt",
      "yuv420p",
      "-r",
      VIDEO_FPS,
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
    "-preset",
    X264_PRESET,
    "-pix_fmt",
    "yuv420p",
    "-r",
    VIDEO_FPS,
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

async function synthesizeSlideSpeech(assetDir: string, index: number, text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const elevenLabsKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
  const mp3Path = path.join(assetDir, `speech-${index + 1}.mp3`);
  const wavPath = path.join(assetDir, `speech-${index + 1}.wav`);

  if (elevenLabsKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response: Response;
    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": elevenLabsKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          text: trimmed.slice(0, 4500),
          model_id: modelId,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
          },
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("ElevenLabs TTS request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const err = await response.text().catch(() => "");
      throw new Error(`ElevenLabs TTS failed: ${response.status} ${err}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(mp3Path, audioBuffer);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      mp3Path,
      "-ar",
      "22050",
      "-ac",
      "1",
      wavPath,
    ]);
    await fs.rm(mp3Path, { force: true }).catch(() => {});
    return wavPath;
  }

  if (!(await commandExists("say"))) return null;
  const aiffPath = path.join(assetDir, `speech-${index + 1}.aiff`);
  // Fallback to local macOS speech when ElevenLabs key is not configured.
  await execFileAsync("say", ["-o", aiffPath, trimmed]);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    aiffPath,
    "-ar",
    "22050",
    "-ac",
    "1",
    wavPath,
  ]);
  await fs.rm(aiffPath, { force: true }).catch(() => {});
  return wavPath;
}

async function muxClipWithAudio(
  videoClipPath: string,
  audioPath: string,
  durationSec: number,
  outputClipPath: string
) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoClipPath,
    "-i",
    audioPath,
    "-filter_complex",
    `[1:a]apad=pad_dur=${durationSec}[a]`,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-t",
    String(durationSec),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    outputClipPath,
  ]);
}

async function muxClipWithSilentAudio(videoClipPath: string, durationSec: number, outputClipPath: string) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=mono:sample_rate=22050",
    "-i",
    videoClipPath,
    "-map",
    "1:v:0",
    "-map",
    "0:a:0",
    "-t",
    String(durationSec),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    outputClipPath,
  ]);
}

async function cleanupSpeechArtifacts(assetDir: string) {
  const entries = await fs.readdir(assetDir).catch(() => []);
  await Promise.all(
    entries
      .filter((name) => /^speech-\d+\.(mp3|aiff)$/i.test(name))
      .map((name) => fs.rm(path.join(assetDir, name), { force: true }).catch((error) => console.error(error)))
  );
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

  const clips: string[] = new Array(lesson.slides.length);
  const maxConcurrency = Math.min(3, Math.max(1, lesson.slides.length));
  let nextIndex = 0;
  let renderSucceeded = false;
  const renderOne = async (i: number) => {
    const slide = lesson.slides[i]!;
    const duration = slideDuration(slide);
    const color = bgColorForHint(slide.visualHint);
    const noteText = pickSlideVoiceText(lesson, i);
    const slideText = `${slide.body}${noteText ? `\n\nNarration: ${noteText}` : ""}`;
    const textPath = await writeSlideTextFile(assetDir, i, slide.title, slideText);
    const baseClipPath = await renderSlideClip(assetDir, i, color, duration, textPath, useDrawtext, slide.visualHint);
    const ttsText = `${slide.title}. ${slide.speakerNotes || slide.body}`;
    const audioPath = await synthesizeSlideSpeech(assetDir, i, ttsText);
    const finalClipPath = path.join(assetDir, `clip-final-${i + 1}.mp4`);
    if (audioPath) {
      await muxClipWithAudio(baseClipPath, audioPath, duration, finalClipPath);
    } else {
      await muxClipWithSilentAudio(baseClipPath, duration, finalClipPath);
    }
    clips[i] = finalClipPath;
  };
  try {
    const workers = Array.from({ length: maxConcurrency }, async () => {
      while (nextIndex < lesson.slides.length) {
        const current = nextIndex;
        nextIndex += 1;
        await renderOne(current);
      }
    });
    await Promise.all(workers);

    if (clips.length === 0 || clips.some((clip) => !clip)) {
      throw new Error("No slide clips were rendered.");
    }
    await concatSlideClips(assetDir, clips, outputPath);
    await cleanupSpeechArtifacts(assetDir);
    renderSucceeded = true;
    return { outputPath };
  } finally {
    if (renderSucceeded) {
      await fs.rm(assetDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
