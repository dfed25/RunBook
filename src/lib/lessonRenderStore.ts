import { promises as fs } from "fs";
import path from "path";
import { Lesson, LessonRenderJob, LessonRenderStatus } from "./types";

const ROOT = path.join(process.cwd(), ".runbook-data", "lesson-renders");
const JOBS_DIR = path.join(ROOT, "jobs");
const ASSETS_DIR = path.join(ROOT, "assets");
const OUTPUT_DIR = path.join(ROOT, "outputs");

async function ensureDirs() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function jobPath(jobId: string) {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

function makeJobId() {
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function renderOutputPath(jobId: string) {
  return path.join(OUTPUT_DIR, `${jobId}.mp4`);
}

export function renderAssetDir(jobId: string) {
  return path.join(ASSETS_DIR, jobId);
}

export async function createLessonRenderJob(lesson: Lesson): Promise<LessonRenderJob> {
  await ensureDirs();
  const id = makeJobId();
  const timestamp = nowIso();
  const job: LessonRenderJob = {
    id,
    status: "queued",
    createdAt: timestamp,
    updatedAt: timestamp,
    lesson,
  };
  await fs.writeFile(jobPath(id), JSON.stringify(job, null, 2), "utf-8");
  return job;
}

export async function getLessonRenderJob(jobId: string): Promise<LessonRenderJob | null> {
  try {
    const raw = await fs.readFile(jobPath(jobId), "utf-8");
    return JSON.parse(raw) as LessonRenderJob;
  } catch {
    return null;
  }
}

export async function updateLessonRenderJob(
  jobId: string,
  patch: Partial<Omit<LessonRenderJob, "id" | "createdAt" | "lesson">>
): Promise<LessonRenderJob | null> {
  const existing = await getLessonRenderJob(jobId);
  if (!existing) return null;
  const next: LessonRenderJob = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };
  await fs.writeFile(jobPath(jobId), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export async function setLessonRenderStatus(
  jobId: string,
  status: LessonRenderStatus,
  extras?: { outputUrl?: string; error?: string }
) {
  return updateLessonRenderJob(jobId, {
    status,
    outputUrl: extras?.outputUrl,
    error: extras?.error,
  });
}
