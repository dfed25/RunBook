"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { RunbookWidgetButton } from "./RunbookWidgetButton";
import { RunbookWidgetPanel } from "./RunbookWidgetPanel";
import { getDemoTaskContext } from "./demoTaskMap";
import { getTaskStatus, updateTaskStatus } from "@/lib/taskStatusAdapter";

type RunbookWidgetProps = {
  pageKey: string;
  children?: ReactNode;
};

export function RunbookWidget({ pageKey, children }: RunbookWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSource, setSaveSource] = useState<"api" | "local" | null>(null);
  const task = useMemo(() => getDemoTaskContext(pageKey), [pageKey]);
  const [taskStatus, setTaskStatus] = useState(() => getTaskStatus(task.taskId));

  async function handleMarkComplete() {
    setIsSaving(true);
    const source = await updateTaskStatus(task.taskId, "complete");
    setTaskStatus("complete");
    setSaveSource(source);
    setIsSaving(false);
  }

  return (
    <>
      {isOpen ? (
        <RunbookWidgetPanel task={task} onClose={() => setIsOpen(false)}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={isSaving || taskStatus === "complete"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {taskStatus === "complete"
                ? "Task Completed"
                : isSaving
                  ? "Saving..."
                  : "Mark Complete"}
            </button>
            {saveSource ? (
              <p className="text-xs text-slate-500">
                Status saved via {saveSource === "api" ? "API" : "local demo"}{" "}
                storage.
              </p>
            ) : null}
          </div>
          {children}
        </RunbookWidgetPanel>
      ) : null}
      <RunbookWidgetButton onClick={() => setIsOpen((previous) => !previous)} />
    </>
  );
}
