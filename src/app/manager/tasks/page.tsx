"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { OnboardingTask } from "@/lib/types";
import { TRAINEES, type TraineeName } from "@/lib/trainees";

const EMPLOYEE_OPTIONS = [...TRAINEES];
type TaskFormState = {
  title: string;
  description: string;
  assignee: TraineeName;
  estimatedTime: string;
  sourceTitle: string;
};

export default function ManagerTasksPage() {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    description: "",
    assignee: EMPLOYEE_OPTIONS[0],
    estimatedTime: "",
    sourceTitle: ""
  });
  const [duplicateTargets, setDuplicateTargets] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/tasks");
        const data = await res.json();
        if (res.ok) {
          setTasks(data);
        }
      } catch (error) {
        console.error(error);
        setMessage("Failed to load existing tasks.");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to create task.");
      return;
    }
    setTasks((prev) => [...prev, data]);
    setForm({
      title: "",
      description: "",
      assignee: form.assignee,
      estimatedTime: "",
      sourceTitle: ""
    });
    setMessage("Task created and visible in manager dashboard.");
  }

  function toggleDuplicateTarget(taskId: string, employee: string) {
    setDuplicateTargets((prev) => {
      const current = prev[taskId] || [];
      const next = current.includes(employee)
        ? current.filter((entry) => entry !== employee)
        : [...current, employee];
      return { ...prev, [taskId]: next };
    });
  }

  async function removeTask(taskId: string) {
    setMessage("");
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to remove task.");
      return;
    }
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setDuplicateTargets((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setMessage("Task removed.");
  }

  async function moveTask(taskId: string, direction: "up" | "down") {
    setMessage("");
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", direction })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to reorder task.");
      return;
    }
    setTasks(data.tasks);
    setMessage("Task order updated.");
  }

  async function duplicateTask(taskId: string) {
    const selected = duplicateTargets[taskId] || [];
    if (selected.length === 0) {
      setMessage("Select at least one trainee to duplicate to.");
      return;
    }
    setMessage("");
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", assignees: selected })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Failed to duplicate task.");
      return;
    }
    setTasks((prev) => [...prev, ...(data.created || [])]);
    setDuplicateTargets((prev) => ({ ...prev, [taskId]: [] }));
    setMessage("Task duplicated.");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Manager Task Control</h1>
          <p className="text-sm text-slate-300">
            Create onboarding tasks per employee. These tasks feed directly into `/manager` and task APIs used by the demo widget.
          </p>
          <Link href="/manager" className="inline-block text-sm text-cyan-300 hover:text-cyan-200">
            Back to manager dashboard
          </Link>
          {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Create task</h2>
          <form className="mt-4 space-y-3" onSubmit={submitTask}>
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Task title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
            <textarea
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Task description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              required
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={form.assignee}
                onChange={(event) => {
                  const value = event.target.value;
                  if (TRAINEES.includes(value as TraineeName)) {
                    setForm((prev) => ({ ...prev, assignee: value as TraineeName }));
                  }
                }}
              >
                {EMPLOYEE_OPTIONS.map((employee) => (
                  <option key={employee} value={employee}>
                    {employee}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Estimated time (e.g. 20 min)"
                value={form.estimatedTime}
                onChange={(event) => setForm((prev) => ({ ...prev, estimatedTime: event.target.value }))}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Source title"
                value={form.sourceTitle}
                onChange={(event) => setForm((prev) => ({ ...prev, sourceTitle: event.target.value }))}
              />
            </div>
            <button className="rounded bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300" type="submit">
              Create task
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Current tasks</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-300">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No tasks found.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {tasks.map((task) => (
                <li key={task.id} className="rounded border border-slate-700 bg-slate-950 p-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-slate-300">{task.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Assignee: {task.assignee} | Status: {task.status} | ETA: {task.estimatedTime}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, "up")}
                      className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, "down")}
                      className="rounded border border-slate-600 px-2 py-1 text-xs hover:border-slate-400"
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="rounded border border-red-500/50 px-2 py-1 text-xs text-red-200 hover:border-red-400"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 rounded border border-slate-800 bg-slate-900 p-2">
                    <p className="text-xs text-slate-300">Duplicate to trainees:</p>
                    <div className="flex flex-wrap gap-2">
                      {EMPLOYEE_OPTIONS.filter((employee) => employee !== task.assignee).map((employee) => {
                        const active = (duplicateTargets[task.id] || []).includes(employee);
                        return (
                          <button
                            key={`${task.id}-${employee}`}
                            type="button"
                            onClick={() => toggleDuplicateTarget(task.id, employee)}
                            className={`rounded-full border px-2 py-1 text-xs ${
                              active
                                ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                                : "border-slate-700 text-slate-300"
                            }`}
                          >
                            {employee}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => duplicateTask(task.id)}
                      className="rounded bg-cyan-400 px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-cyan-300"
                    >
                      Duplicate selected
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
