import { promises as fs } from "fs";
import path from "path";
import { demoDocs } from "./demoDocs";
import { initialTasks } from "./demoTasks";
import { Hire, HireKnowledgeSource, KnowledgeSourceType, OnboardingTask, SourceDoc } from "./types";
import { DEFAULT_ASSIGNEE, TRAINEES } from "./trainees";

const DATA_DIR = path.join(process.cwd(), ".runbook-data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const DOCS_FILE = path.join(DATA_DIR, "docs.json");
const HIRES_FILE = path.join(DATA_DIR, "hires.json");
const HIRE_SOURCES_FILE = path.join(DATA_DIR, "hire-sources.json");
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

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeAssigneeName(rawAssignee: unknown): string {
  const maybe = typeof rawAssignee === "string" ? rawAssignee.trim() : "";
  if (maybe.length > 0) return maybe;
  return DEFAULT_ASSIGNEE;
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeHire(hire: Partial<Hire> & { id?: string }): Hire {
  const current = nowIso();
  const normalizedName = String(hire.name || "").trim() || "Unnamed hire";
  return {
    id: String(hire.id || `hire-${slugFromName(normalizedName) || makeId("hire")}`),
    name: normalizedName,
    role: hire.role ? String(hire.role).trim() : undefined,
    email: hire.email ? String(hire.email).trim() : undefined,
    active: typeof hire.active === "boolean" ? hire.active : true,
    createdAt: hire.createdAt || current,
    updatedAt: current
  };
}

function normalizeSourceType(rawType: unknown): KnowledgeSourceType {
  const maybe = typeof rawType === "string" ? rawType : "";
  const allowed: KnowledgeSourceType[] = [
    "notion_page",
    "notion_database",
    "google_doc",
    "google_drive_folder",
    "google_drive_file",
    "slack_channel",
    "url"
  ];
  return allowed.includes(maybe as KnowledgeSourceType) ? (maybe as KnowledgeSourceType) : "url";
}

function normalizeHireSource(source: Partial<HireKnowledgeSource> & { id?: string }): HireKnowledgeSource {
  const current = nowIso();
  return {
    id: String(source.id || makeId("source")),
    hireId: String(source.hireId || "").trim(),
    type: normalizeSourceType(source.type),
    title: String(source.title || "Untitled source").trim(),
    url: String(source.url || "").trim(),
    providerRef: source.providerRef ? String(source.providerRef).trim() : undefined,
    createdAt: source.createdAt || current,
    updatedAt: current
  };
}

function buildHireNameMap(hires: Hire[]): Map<string, Hire> {
  return new Map(hires.map((hire) => [hire.name.toLowerCase(), hire]));
}

function normalizeTask(
  task: Partial<OnboardingTask> & { id?: string },
  hiresByName: Map<string, Hire>,
  defaultHire: Hire
): OnboardingTask {
  const assigneeName = normalizeAssigneeName(task.assignee);
  const matchedHire = hiresByName.get(assigneeName.toLowerCase());
  const assigneeId = String(task.assigneeId || matchedHire?.id || defaultHire.id).trim();
  const assignee = matchedHire?.name || assigneeName || defaultHire.name;
  return {
    id: String(task.id || makeId("task")),
    title: String(task.title || "Untitled task").trim(),
    description: String(task.description || "").trim(),
    assigneeId,
    assignee,
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

function seedHires(): Hire[] {
  return TRAINEES.map((name) =>
    normalizeHire({
      id: `hire-${slugFromName(name)}`,
      name
    })
  );
}

export async function getHires(): Promise<Hire[]> {
  const exists = await fileExists(HIRES_FILE);
  if (!exists) {
    const seed = seedHires();
    await writeJson(HIRES_FILE, seed);
    return seed;
  }
  const stored = await readJson<unknown[]>(HIRES_FILE, []);
  const normalized = stored
    .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
    .map((hire) => normalizeHire(hire));
  const deduped = Array.from(new Map(normalized.map((hire) => [hire.id, hire])).values());
  if (JSON.stringify(deduped) !== JSON.stringify(stored)) {
    await writeJson(HIRES_FILE, deduped);
  }
  return deduped;
}

export async function addHire(input: { name: string; role?: string; email?: string }): Promise<Hire> {
  return runMutation(async () => {
    const hires = await getHires();
    const next = normalizeHire({
      id: makeId("hire"),
      name: input.name,
      role: input.role,
      email: input.email,
      active: true
    });
    const updated = [...hires, next];
    await writeJson(HIRES_FILE, updated);
    return next;
  });
}

export async function updateHire(
  hireId: string,
  updates: Partial<Pick<Hire, "name" | "role" | "email" | "active">>
): Promise<Hire | null> {
  return runMutation(async () => {
    const hires = await getHires();
    const idx = hires.findIndex((hire) => hire.id === hireId);
    if (idx < 0) return null;
    const merged = normalizeHire({ ...hires[idx], ...updates, id: hireId });
    const next = [...hires];
    next[idx] = merged;
    await writeJson(HIRES_FILE, next);
    return merged;
  });
}

export async function removeHire(
  hireId: string,
  options?: { cascadeTasks?: boolean; reassignToHireId?: string }
): Promise<boolean> {
  return runMutation(async () => {
    const hires = await getHires();
    const target = hires.find((hire) => hire.id === hireId);
    if (!target) return false;
    const remainingHires = hires.filter((hire) => hire.id !== hireId);
    await writeJson(HIRES_FILE, remainingHires);

    const tasks = await getTasks();
    let nextTasks = tasks.filter((task) => task.assigneeId !== hireId);
    if (!options?.cascadeTasks) {
      const reassignedHire = remainingHires.find((hire) => hire.id === options?.reassignToHireId) || remainingHires[0];
      if (reassignedHire) {
        nextTasks = tasks.map((task) =>
          task.assigneeId === hireId ? { ...task, assigneeId: reassignedHire.id, assignee: reassignedHire.name } : task
        );
      }
    }
    await writeJson(TASKS_FILE, nextTasks);

    const sources = await getHireSources();
    await writeJson(
      HIRE_SOURCES_FILE,
      sources.filter((source) => source.hireId !== hireId)
    );
    return true;
  });
}

export async function getHireSources(hireId?: string): Promise<HireKnowledgeSource[]> {
  const exists = await fileExists(HIRE_SOURCES_FILE);
  if (!exists) {
    await writeJson(HIRE_SOURCES_FILE, []);
    return [];
  }
  const stored = await readJson<unknown[]>(HIRE_SOURCES_FILE, []);
  const normalized = stored
    .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
    .map((source) => normalizeHireSource(source))
    .filter((source) => source.hireId.length > 0 && source.url.length > 0);
  if (JSON.stringify(normalized) !== JSON.stringify(stored)) {
    await writeJson(HIRE_SOURCES_FILE, normalized);
  }
  return hireId ? normalized.filter((source) => source.hireId === hireId) : normalized;
}

export async function addHireSource(input: {
  hireId: string;
  type: KnowledgeSourceType;
  title: string;
  url: string;
  providerRef?: string;
}): Promise<HireKnowledgeSource> {
  return runMutation(async () => {
    const hires = await getHires();
    if (!hires.some((hire) => hire.id === input.hireId)) {
      throw new Error("Unknown hireId");
    }
    const sources = await getHireSources();
    const next = normalizeHireSource({
      id: makeId("source"),
      hireId: input.hireId,
      type: input.type,
      title: input.title,
      url: input.url,
      providerRef: input.providerRef
    });
    const updated = [...sources, next];
    await writeJson(HIRE_SOURCES_FILE, updated);
    return next;
  });
}

export async function removeHireSource(hireId: string, sourceId: string): Promise<boolean> {
  return runMutation(async () => {
    const sources = await getHireSources();
    const next = sources.filter((source) => !(source.id === sourceId && source.hireId === hireId));
    if (next.length === sources.length) return false;
    await writeJson(HIRE_SOURCES_FILE, next);
    return true;
  });
}

export async function getTasks(): Promise<OnboardingTask[]> {
  const hires = await getHires();
  const activeHires = hires.filter((hire) => hire.active);
  const defaultHire = activeHires[0] || seedHires()[0];
  const hiresByName = buildHireNameMap(hires);

  const exists = await fileExists(TASKS_FILE);
  if (!exists) {
    const seed = initialTasks.map((task) => normalizeTask(task, hiresByName, defaultHire));
    await writeJson(TASKS_FILE, seed);
    return [...seed];
  }
  const storedTasks = await readJson<unknown[]>(TASKS_FILE, []);
  const normalized = storedTasks
    .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
    .map((task) => normalizeTask(task, hiresByName, defaultHire));
  if (JSON.stringify(normalized) !== JSON.stringify(storedTasks)) {
    await writeJson(TASKS_FILE, normalized);
  }
  return normalized;
}

export async function addTask(input: {
  title: string;
  description: string;
  assigneeId?: string;
  assignee?: string;
  estimatedTime?: string;
  sourceTitle?: string;
}): Promise<OnboardingTask> {
  return runMutation(async () => {
    const hires = await getHires();
    const defaultHire = hires.find((hire) => hire.active) || seedHires()[0];
    const requestedHire = hires.find((hire) => hire.id === input.assigneeId);
    const assigneeHire = requestedHire || defaultHire;
    const hiresByName = buildHireNameMap(hires);
    const tasks = await getTasks();
    const nextTask = normalizeTask(
      {
        id: makeId("task"),
        title: input.title,
        description: input.description,
        assigneeId: assigneeHire.id,
        assignee: assigneeHire.name || input.assignee,
        status: "todo",
        sourceTitle: input.sourceTitle || "User Added",
        estimatedTime: input.estimatedTime || "15 min"
      },
      hiresByName,
      defaultHire
    );
    const updated = [...tasks, nextTask];
    await writeJson(TASKS_FILE, updated);
    return nextTask;
  });
}

export async function updateTaskStatus(taskId: string, status: OnboardingTask["status"]): Promise<OnboardingTask | null> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const idx = tasks.findIndex((task) => task.id === taskId);
    if (idx < 0) return null;
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
    if (filtered.length === tasks.length) return false;
    await writeJson(TASKS_FILE, filtered);
    return true;
  });
}

export async function moveTask(taskId: string, direction: "up" | "down"): Promise<OnboardingTask[] | null> {
  return runMutation(async () => {
    const tasks = await getTasks();
    const idx = tasks.findIndex((task) => task.id === taskId);
    if (idx < 0) return null;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tasks.length) return tasks;
    const next = [...tasks];
    const current = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = current;
    await writeJson(TASKS_FILE, next);
    return next;
  });
}

export async function duplicateTask(taskId: string, assigneeIds: string[]): Promise<OnboardingTask[] | null> {
  return runMutation(async () => {
    const hires = await getHires();
    const tasks = await getTasks();
    const source = tasks.find((task) => task.id === taskId);
    if (!source) return null;
    const normalizedAssignees = assigneeIds
      .filter((assigneeId, index, arr) => arr.indexOf(assigneeId) === index)
      .map((assigneeId) => hires.find((hire) => hire.id === assigneeId))
      .filter((hire): hire is Hire => !!hire);
    if (normalizedAssignees.length === 0) return [];
    const copies = normalizedAssignees.map((assigneeHire) => ({
      ...source,
      id: makeId("task"),
      assigneeId: assigneeHire.id,
      assignee: assigneeHire.name,
      status: "todo" as const
    }));
    const nextTasks = [...tasks, ...copies];
    await writeJson(TASKS_FILE, nextTasks);
    return copies;
  });
}

export async function getManagerOverview() {
  const tasks = await getTasks();
  const hires = await getHires();
  const activeHires = hires.filter((hire) => hire.active);
  const grouped = tasks.reduce<Record<string, OnboardingTask[]>>((acc, task) => {
    if (!acc[task.assigneeId]) acc[task.assigneeId] = [];
    acc[task.assigneeId].push(task);
    return acc;
  }, Object.fromEntries(activeHires.map((hire) => [hire.id, [] as OnboardingTask[]])));

  const employees = Object.entries(grouped).map(([hireId, employeeTasks]) => {
    const hire = hires.find((value) => value.id === hireId);
    const completed = employeeTasks.filter((task) => task.status === "complete").length;
    const progress = employeeTasks.length > 0 ? Math.round((completed / employeeTasks.length) * 100) : 0;
    return {
      hireId,
      name: hire?.name || employeeTasks[0]?.assignee || "Unknown",
      totalTasks: employeeTasks.length,
      completedTasks: completed,
      progress,
      status: progress >= 70 ? "On Track" : "At Risk",
      tasks: employeeTasks
    };
  });

  return {
    employees,
    totalEmployees: activeHires.length,
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
      createdAt: nowIso()
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
