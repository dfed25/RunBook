import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { Lesson, LessonRenderJob, LessonRenderStatus } from "./types";

const ROOT = path.join(process.cwd(), ".runbook-data", "lesson-renders");
const JOBS_DIR = path.join(ROOT, "jobs");
const ASSETS_DIR = path.join(ROOT, "assets");
const OUTPUT_DIR = path.join(ROOT, "outputs");
const JOB_ID_RE = /^lesson-(?:[a-f0-9-]{36}|\d+-[a-z0-9]+)$/i;

async function ensureDirs() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function assertSafeJobId(jobId: string) {
  if (!JOB_ID_RE.test(jobId)) {
    throw new Error("Invalid lesson render job id");
  }
}

function jobPath(jobId: string) {
  assertSafeJobId(jobId);
  return path.join(JOBS_DIR, `${jobId}.json`);
}

function makeJobId() {
  return `lesson-${randomUUID()}`;
}

export function renderOutputPath(jobId: string) {
  assertSafeJobId(jobId);
  return path.join(OUTPUT_DIR, `${jobId}.mp4`);
}

export function renderAssetDir(jobId: string) {
  assertSafeJobId(jobId);
  return path.join(ASSETS_DIR, jobId);
}

async function writeJsonAtomic(filePath: string, payload: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${randomUUID()}`;
  try {
    await fs.writeFile(tempPath, payload, "utf-8");
    await fs.rename(tempPath, filePath);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
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
  await writeJsonAtomic(jobPath(id), JSON.stringify(job, null, 2));
  return job;
}

export async function getLessonRenderJob(jobId: string): Promise<LessonRenderJob | null> {
  try {
    const raw = await fs.readFile(jobPath(jobId), "utf-8");
    return JSON.parse(raw) as LessonRenderJob;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") return null;
    throw error;
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
  await writeJsonAtomic(jobPath(jobId), JSON.stringify(next, null, 2));
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
