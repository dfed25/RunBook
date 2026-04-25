import { promises as fs } from "fs";
import path from "path";
import { demoDocs } from "./demoDocs";
import { initialTasks } from "./demoTasks";
import { OnboardingTask, SourceDoc } from "./types";
import { TRAINEES } from "./trainees";

const DATA_DIR = path.join(process.cwd(), ".runbook-data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const DOCS_FILE = path.join(DATA_DIR, "docs.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
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

export async function getTasks(): Promise<OnboardingTask[]> {
  const storedTasks = await readJson<OnboardingTask[]>(TASKS_FILE, []);
  if (storedTasks.length > 0) {
    const normalized = storedTasks.map((task) => ({
      ...task,
      assignee: task.assignee?.trim() || "Alex Rivera"
    }));
    const changed = normalized.some((task, index) => task.assignee !== storedTasks[index].assignee);
    if (changed) {
      await writeJson(TASKS_FILE, normalized);
    }
    return normalized;
  }
  await writeJson(TASKS_FILE, initialTasks);
  return initialTasks;
}

export async function addTask(input: {
  title: string;
  description: string;
  assignee?: string;
  estimatedTime?: string;
  sourceTitle?: string;
}): Promise<OnboardingTask> {
  const tasks = await getTasks();
  const nextTask: OnboardingTask = {
    id: makeId("task"),
    title: input.title.trim(),
    description: input.description.trim(),
    assignee: input.assignee?.trim() || "Alex Rivera",
    status: "todo",
    sourceTitle: input.sourceTitle?.trim() || "User Added",
    estimatedTime: input.estimatedTime?.trim() || "15 min"
  };
  const updated = [...tasks, nextTask];
  await writeJson(TASKS_FILE, updated);
  return nextTask;
}

export async function updateTaskStatus(taskId: string, status: OnboardingTask["status"]): Promise<OnboardingTask | null> {
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
}

export async function removeTask(taskId: string): Promise<boolean> {
  const tasks = await getTasks();
  const filtered = tasks.filter((task) => task.id !== taskId);
  if (filtered.length === tasks.length) {
    return false;
  }
  await writeJson(TASKS_FILE, filtered);
  return true;
}

export async function moveTask(taskId: string, direction: "up" | "down"): Promise<OnboardingTask[] | null> {
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
}

export async function duplicateTask(taskId: string, assignees: string[]): Promise<OnboardingTask[] | null> {
  const tasks = await getTasks();
  const source = tasks.find((task) => task.id === taskId);
  if (!source) {
    return null;
  }
  const normalizedAssignees = assignees
    .map((assignee) => assignee.trim())
    .filter((assignee, index, arr) => assignee.length > 0 && arr.indexOf(assignee) === index);
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
}

export async function getAllDocs(): Promise<SourceDoc[]> {
  const customDocs = await getCustomDocs();
  return [...demoDocs, ...customDocs];
}
