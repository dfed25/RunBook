import { promises as fs } from "fs";
import path from "path";
import { demoDocs } from "./demoDocs";
import { initialTasks } from "./demoTasks";
import { OnboardingTask, SourceDoc } from "./types";
import { DEFAULT_ASSIGNEE, TRAINEES, TraineeName } from "./trainees";

const DATA_DIR = path.join(process.cwd(), ".runbook-data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const DOCS_FILE = path.join(DATA_DIR, "docs.json");
let mutationQueue: Promise<void> = Promise.resolve();

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAssignee(rawAssignee: unknown): TraineeName {
  const maybe = typeof rawAssignee === "string" ? rawAssignee.trim() : "";
  if (TRAINEES.includes(maybe as TraineeName)) {
    return maybe as TraineeName;
  }
  return DEFAULT_ASSIGNEE;
}

function normalizeTask(task: Partial<OnboardingTask> & { id?: string }): OnboardingTask {
  return {
    id: String(task.id || makeId("task")),
    title: String(task.title || "Untitled task").trim(),
    description: String(task.description || "").trim(),
    assignee: normalizeAssignee(task.assignee),
    status:
      task.status === "todo" || task.status === "in_progress" || task.status === "complete"
        ? task.status
        : "todo",
    sourceTitle: String(task.sourceTitle || "User Added").trim(),
    estimatedTime: String(task.estimatedTime || "15 min").trim()
  };
}

async function runMutation<T>(mutate: () => Promise<T>): Promise<T> {
  const previous = mutationQueue;
  let release: () => void = () => {};
  mutationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await mutate();
  } finally {
    release();
  }
}

export async function getTasks(): Promise<OnboardingTask[]> {
  const exists = await fileExists(TASKS_FILE);
  if (!exists) {
    const seed = initialTasks.map((task) => normalizeTask(task));
    await writeJson(TASKS_FILE, seed);
    return [...seed];
  }
  const storedTasks = await readJson<unknown[]>(TASKS_FILE, []);
  const normalized = storedTasks
    .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
    .map((task) => normalizeTask(task));
  const changed = JSON.stringify(normalized) !== JSON.stringify(storedTasks);
  if (changed) {
    await writeJson(TASKS_FILE, normalized);
  }
  return normalized;
}

export async function addTask(input: {
  title: string;
  description: string;
  assignee?: TraineeName;
  estimatedTime?: string;
  sourceTitle?: string;
}): Promise<OnboardingTask> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const nextTask = normalizeTask({
      id: makeId("task"),
      title: input.title,
      description: input.description,
      assignee: input.assignee,
      status: "todo",
      sourceTitle: input.sourceTitle || "User Added",
      estimatedTime: input.estimatedTime || "15 min"
    });
    const updated = [...tasks, nextTask];
    await writeJson(TASKS_FILE, updated);
    return nextTask;
  });
}

export async function updateTaskStatus(taskId: string, status: OnboardingTask["status"]): Promise<OnboardingTask | null> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const idx = tasks.findIndex((task) => task.id === taskId);
    if (idx < 0) {
      return null;
    }
    const updatedTask = { ...tasks[idx], status };
    const nextTasks = [...tasks];
    nextTasks[idx] = updatedTask;
    await writeJson(TASKS_FILE, nextTasks);
    return updatedTask;
  });
}

export async function removeTask(taskId: string): Promise<boolean> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const filtered = tasks.filter((task) => task.id !== taskId);
    if (filtered.length === tasks.length) {
      return false;
    }
    await writeJson(TASKS_FILE, filtered);
    return true;
  });
}

export async function moveTask(taskId: string, direction: "up" | "down"): Promise<OnboardingTask[] | null> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const idx = tasks.findIndex((task) => task.id === taskId);
    if (idx < 0) {
      return null;
    }
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tasks.length) {
      return tasks;
    }
    const next = [...tasks];
    const current = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = current;
    await writeJson(TASKS_FILE, next);
    return next;
  });
}

export async function duplicateTask(taskId: string, assignees: TraineeName[]): Promise<OnboardingTask[] | null> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const source = tasks.find((task) => task.id === taskId);
    if (!source) {
      return null;
    }
    const normalizedAssignees = assignees.filter((assignee, index, arr) => arr.indexOf(assignee) === index);
    if (normalizedAssignees.length === 0) {
      return [];
    }
    const copies = normalizedAssignees.map((assignee) => ({
      ...source,
      id: makeId("task"),
      assignee,
      status: "todo" as const
    }));
    const nextTasks = [...tasks, ...copies];
    await writeJson(TASKS_FILE, nextTasks);
    return copies;
  });
}

export async function getManagerOverview() {
  const tasks = await getTasks();
  const grouped = tasks.reduce<Record<string, OnboardingTask[]>>((acc, task) => {
    if (!acc[task.assignee]) {
      acc[task.assignee] = [];
    }
    acc[task.assignee].push(task);
    return acc;
  }, Object.fromEntries(TRAINEES.map((name) => [name, [] as OnboardingTask[]])));

  const employees = Object.entries(grouped).map(([name, employeeTasks]) => {
    const completed = employeeTasks.filter((task) => task.status === "complete").length;
    const progress = employeeTasks.length > 0 ? Math.round((completed / employeeTasks.length) * 100) : 0;
    return {
      name,
      totalTasks: employeeTasks.length,
      completedTasks: completed,
      progress,
      status: progress >= 70 ? "On Track" : "At Risk",
      tasks: employeeTasks
    };
  });

  return {
    employees,
    totalEmployees: employees.length,
    totalTasks: tasks.length
  };
}

export async function getCustomDocs(): Promise<SourceDoc[]> {
  return readJson<SourceDoc[]>(DOCS_FILE, []);
}

export async function addCustomDoc(input: { title: string; content: string; sourceType?: "text" | "upload" }): Promise<SourceDoc> {
  return runMutation(async () => {
    const existing = await getCustomDocs();
    const nextDoc: SourceDoc = {
      id: makeId("doc"),
      title: input.title.trim(),
      content: input.content.trim(),
      sourceType: input.sourceType || "text",
      createdAt: new Date().toISOString()
    };
    const updated = [...existing, nextDoc];
    await writeJson(DOCS_FILE, updated);
    return nextDoc;
  });
}

export async function getAllDocs(): Promise<SourceDoc[]> {
  const customDocs = await getCustomDocs();
  return [...demoDocs, ...customDocs];
}
