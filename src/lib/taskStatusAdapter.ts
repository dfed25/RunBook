export type TaskStatus = "todo" | "in_progress" | "complete";

export type TaskStatusMap = Record<string, TaskStatus>;

export type UpdateTaskStatusResult = "api" | "local" | "rejected";

const STORAGE_KEY = "runbook-task-statuses";
const STATUS_EVENT_NAME = "runbook-task-status-updated";

const ALLOWED_STATUSES: TaskStatus[] = ["todo", "in_progress", "complete"];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseStoredTaskStatuses(raw: string): TaskStatusMap {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
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
    return out;
  } catch {
    return {};
  }
}

export function getTaskStatuses(): TaskStatusMap {
  if (!isBrowser()) {
    return {};
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return {};
  }

  return parseStoredTaskStatuses(storedValue);
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
  window.dispatchEvent(
    new CustomEvent(STATUS_EVENT_NAME, {
      detail: taskStatuses,
    }),
  );
}

function setTaskStatus(taskId: string, status: TaskStatus) {
  const taskStatuses = getTaskStatuses();
  taskStatuses[taskId] = status;
  saveTaskStatuses(taskStatuses);
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
    return "rejected";
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
    callback(getTaskStatuses());
  };

  const customHandler = (event: Event) => {
    const customEvent = event as CustomEvent<TaskStatusMap>;
    callback(customEvent.detail);
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
