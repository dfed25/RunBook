export type TaskStatus = "todo" | "in_progress" | "complete";

type TaskStatusMap = Record<string, TaskStatus>;

const STORAGE_KEY = "runbook-task-statuses";
const STATUS_EVENT_NAME = "runbook-task-status-updated";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getTaskStatuses(): TaskStatusMap {
  if (!isBrowser()) {
    return {};
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (!storedValue) {
    return {};
  }

  try {
    return JSON.parse(storedValue) as TaskStatusMap;
  } catch {
    return {};
  }
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
): Promise<"api" | "local"> {
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
  } catch {
    // Fall back to local persistence for demo resiliency.
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

  const handler = () => callback(getTaskStatuses());
  const customHandler = (event: Event) => {
    const customEvent = event as CustomEvent<TaskStatusMap>;
    callback(customEvent.detail);
  };

  window.addEventListener("storage", handler);
  window.addEventListener(STATUS_EVENT_NAME, customHandler as EventListener);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(
      STATUS_EVENT_NAME,
      customHandler as EventListener,
    );
  };
}
