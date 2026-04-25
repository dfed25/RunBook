"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { RunbookWidgetButton } from "./RunbookWidgetButton";
import { RunbookWidgetPanel } from "./RunbookWidgetPanel";
import { getDemoTaskContext } from "./demoTaskMap";
import type { OnboardingTask } from "@/lib/types";
import {
  getTaskCurrentStep,
  getTaskStatus,
  subscribeToTaskCurrentStep,
  subscribeToTaskStatus,
  updateTaskCurrentStep,
  updateTaskStatus,
  type TaskStatus,
} from "@/lib/taskStatusAdapter";

type RunbookWidgetProps = {
  pageKey: string;
  children?: ReactNode;
};

function useTaskStatusFromStore(taskId: string): TaskStatus {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToTaskStatus(() => onStoreChange()),
    () => getTaskStatus(taskId),
    () => "todo",
  );
}

function useTaskStepFromStore(taskId: string): number {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToTaskCurrentStep(() => onStoreChange()),
    () => getTaskCurrentStep(taskId),
    () => 0,
  );
}

export function RunbookWidget({ pageKey, children }: RunbookWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSource, setSaveSource] = useState<"api" | "local" | "rejected" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [remoteTask, setRemoteTask] = useState<OnboardingTask | null>(null);

  const task = useMemo(() => getDemoTaskContext(pageKey), [pageKey]);
  const taskStatus = useTaskStatusFromStore(task.taskId);
  const localStep = useTaskStepFromStore(task.taskId);

  const steps = useMemo(() => {
    if (remoteTask?.actionSteps && remoteTask.actionSteps.length > 0) {
      return remoteTask.actionSteps;
    }
    return task.actionSteps;
  }, [remoteTask?.actionSteps, task.actionSteps]);

  const serverStep = remoteTask?.currentStep;
  const stepIndex = useMemo(() => {
    const max = Math.max(0, steps.length - 1);
    const fromServer =
      typeof serverStep === "number" && Number.isFinite(serverStep)
        ? Math.min(Math.max(0, Math.floor(serverStep)), max)
        : null;
    if (fromServer !== null) return fromServer;
    return Math.min(localStep, max);
  }, [serverStep, localStep, steps.length]);

  const currentStepText = steps[stepIndex] ?? "";

  const loadTask = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = (await res.json()) as OnboardingTask[];
      if (!Array.isArray(data)) return;
      const found = data.find((t) => t.id === task.taskId) ?? null;
      setRemoteTask(found);
    } catch {
      setRemoteTask(null);
    }
  }, [task.taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  async function persistStep(next: number) {
    const max = Math.max(0, steps.length - 1);
    const clamped = Math.min(Math.max(0, next), max);
    setSaveError(null);
    setSaveSource(null);
    setIsSaving(true);
    try {
      const source = await updateTaskCurrentStep(task.taskId, clamped);
      setSaveSource(source);
      await loadTask();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkComplete() {
    const taskIdAtStart = task.taskId;
    setSaveError(null);
    setSaveSource(null);
    setIsSaving(true);
    try {
      const source = await updateTaskStatus(taskIdAtStart, "complete");
      if (taskIdAtStart !== task.taskId) {
        return;
      }
      if (source === "rejected") {
        setSaveError(
          "The server rejected this update (check the task ID and status).",
        );
        return;
      }
      setSaveSource(source);
      await loadTask();
    } finally {
      setIsSaving(false);
    }
  }

  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < steps.length - 1;

  return (
    <>
      {isOpen ? (
        <RunbookWidgetPanel
          task={task}
          onClose={() => setIsOpen(false)}
          stepIndex={stepIndex}
          stepTotal={steps.length}
          currentStepText={currentStepText}
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void persistStep(stepIndex - 1)}
                disabled={isSaving || !canGoBack}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => void persistStep(stepIndex + 1)}
                disabled={isSaving || !canGoNext}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleMarkComplete()}
              disabled={isSaving || taskStatus === "complete"}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {taskStatus === "complete"
                ? "Task completed"
                : isSaving
                  ? "Saving..."
                  : "Mark complete"}
            </button>
            <Link
              href="/dashboard"
              className="text-center text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
            >
              Back to dashboard
            </Link>
            {saveError ? (
              <p className="text-xs text-red-600">{saveError}</p>
            ) : null}
            {saveSource ? (
              <p className="text-xs text-slate-500">
                Saved via{" "}
                {saveSource === "api" ? "API" : saveSource === "rejected" ? "fallback" : "local demo"} storage.
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
