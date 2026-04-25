export type TaskStatus = "todo" | "in_progress" | "complete";

export type TaskStatusMap = Record<string, TaskStatus>;

export type UpdateTaskStatusResult = "api" | "local" | "rejected";

/** Stable empty map for `useSyncExternalStore` (must not return a fresh `{}` each render). */
export const EMPTY_TASK_STATUS_MAP: TaskStatusMap = Object.freeze({});

const STORAGE_KEY = "runbook-task-statuses";
const STATUS_EVENT_NAME = "runbook-task-status-updated";

const ALLOWED_STATUSES: TaskStatus[] = ["todo", "in_progress", "complete"];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Serialized localStorage value; `""` means missing / empty key (distinct from unset). */
let snapshotKey: string | undefined;
let snapshotMap: TaskStatusMap = EMPTY_TASK_STATUS_MAP;

function storageKeyFromRaw(raw: string | null): string {
  return raw === null ? "" : raw;
}

function parseStoredTaskStatuses(raw: string): TaskStatusMap {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return EMPTY_TASK_STATUS_MAP;
    }
    const out: TaskStatusMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || typeof value !== "string") {
        continue;
      }
      if ((ALLOWED_STATUSES as readonly string[]).includes(value)) {
        out[key] = value as TaskStatus;
      }
    }
    return Object.keys(out).length === 0 ? EMPTY_TASK_STATUS_MAP : out;
  } catch {
    return EMPTY_TASK_STATUS_MAP;
  }
}

export function getTaskStatuses(): TaskStatusMap {
  if (!isBrowser()) {
    return EMPTY_TASK_STATUS_MAP;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const key = storageKeyFromRaw(raw);
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshotMap = key ? parseStoredTaskStatuses(raw!) : EMPTY_TASK_STATUS_MAP;
  }
  return snapshotMap;
}

export function getTaskStatus(taskId: string): TaskStatus {
  const taskStatuses = getTaskStatuses();
  return taskStatuses[taskId] ?? "todo";
}

function saveTaskStatuses(taskStatuses: TaskStatusMap) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskStatuses));
  const raw = window.localStorage.getItem(STORAGE_KEY);
  snapshotKey = storageKeyFromRaw(raw);
  snapshotMap = snapshotKey ? parseStoredTaskStatuses(raw!) : EMPTY_TASK_STATUS_MAP;
  window.dispatchEvent(
    new CustomEvent(STATUS_EVENT_NAME, {
      detail: snapshotMap,
    }),
  );
}

function setTaskStatus(taskId: string, status: TaskStatus) {
  const current = getTaskStatuses();
  const next: TaskStatusMap = { ...current, [taskId]: status };
  saveTaskStatuses(next);
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<UpdateTaskStatusResult> {
  if (!isBrowser()) {
    return "local";
  }

  try {
    const response = await fetch("/api/tasks/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status }),
    });

    if (response.ok) {
      setTaskStatus(taskId, status);
      return "api";
    }

    const bodyText = await response.text().catch(() => "");
    console.warn(
      `[updateTaskStatus] API ${response.status} for taskId=${taskId} status=${status}:`,
      bodyText.slice(0, 500),
    );
    // Demo safety net: when backend does not recognize the task ID,
    // keep UI progress working via local storage fallback.
    setTaskStatus(taskId, status);
    return "local";
  } catch (error) {
    console.warn("[updateTaskStatus] network error; using local fallback:", error);
  }

  setTaskStatus(taskId, status);
  return "local";
}

export function subscribeToTaskStatus(
  callback: (taskStatuses: TaskStatusMap) => void,
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const storageHandler = (event: Event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key !== null && storageEvent.key !== STORAGE_KEY) {
      return;
    }
    snapshotKey = undefined;
    callback(getTaskStatuses());
  };

  const customHandler = (event: Event) => {
    const customEvent = event as CustomEvent<TaskStatusMap>;
    callback(customEvent.detail ?? getTaskStatuses());
  };

  window.addEventListener("storage", storageHandler);
  window.addEventListener(STATUS_EVENT_NAME, customHandler as EventListener);

  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener(
      STATUS_EVENT_NAME,
      customHandler as EventListener,
    );
  };
}
