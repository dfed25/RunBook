"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getTaskStatuses,
  subscribeToTaskStatus,
  type TaskStatus,
} from "@/lib/taskStatusAdapter";

type DemoTask = {
  id: string;
  title: string;
  owner: string;
};

const demoTasks: DemoTask[] = [
  { id: "get-github-access", title: "Get GitHub Access", owner: "Alex Chen" },
  {
    id: "submit-first-expense",
    title: "Submit First Expense",
    owner: "Alex Chen",
  },
];

function statusLabel(status: TaskStatus): string {
  if (status === "complete") {
    return "Complete";
  }
  if (status === "in_progress") {
    return "In Progress";
  }
  return "Todo";
}

function statusClasses(status: TaskStatus): string {
  if (status === "complete") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "in_progress") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

export default function DashboardPage() {
  const [taskStatuses, setTaskStatuses] = useState(getTaskStatuses());

  useEffect(() => {
    const unsubscribe = subscribeToTaskStatus(setTaskStatuses);
    return unsubscribe;
  }, []);

  const completedCount = useMemo(() => {
    return demoTasks.filter((task) => taskStatuses[task.id] === "complete").length;
  }, [taskStatuses]);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Runbook Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Welcome, Alex. Track onboarding task progress and complete actions from
            demo pages.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Progress: {completedCount}/{demoTasks.length} tasks complete
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Task Checklist</h2>
          <div className="mt-4 space-y-3">
            {demoTasks.map((task) => {
              const status = taskStatuses[task.id] ?? "todo";
              return (
                <article
                  key={task.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{task.title}</p>
                    <p className="text-sm text-slate-500">Owner: {task.owner}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(status)}`}
                  >
                    {statusLabel(status)}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}