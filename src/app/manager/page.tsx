"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DEMO_PERSONAS } from "@/lib/demoScenario";
import { OnboardingTask } from "@/lib/types";
import { TRAINEES } from "@/lib/trainees";

type PersonSummary = {
  name: string;
  tasks: OnboardingTask[];
  progress: number;
  completed: number;
  total: number;
  status: "On Track" | "At Risk";
};

export default function ManagerPage() {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEmployee, setActiveEmployee] = useState<string>("ALL");

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
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const people = useMemo<PersonSummary[]>(() => {
    const grouped = tasks.reduce<Record<string, OnboardingTask[]>>((acc, task) => {
      const assignee = task.assignee || "Unassigned";
      if (!acc[assignee]) {
        acc[assignee] = [];
      }
      acc[assignee].push(task);
      return acc;
    }, Object.fromEntries(TRAINEES.map((name) => [name, [] as OnboardingTask[]])));

    return Object.entries(grouped).map(([name, personTasks]) => {
      const completed = personTasks.filter((task) => task.status === "complete").length;
      const progress = personTasks.length === 0 ? 0 : Math.round((completed / personTasks.length) * 100);
      return {
        name,
        tasks: personTasks,
        progress,
        completed,
        total: personTasks.length,
        status: progress >= 70 ? "On Track" : "At Risk"
      };
    });
  }, [tasks]);

  const avgProgress = people.length
    ? Math.round(people.reduce((sum, person) => sum + person.progress, 0) / people.length)
    : 0;
  const onTrack = people.filter((person) => person.status === "On Track").length;
  const atRisk = people.filter((person) => person.status === "At Risk");
  const employeeNames = people.map((person) => person.name);
  const selectedEmployee =
    activeEmployee === "ALL" || employeeNames.includes(activeEmployee) ? activeEmployee : "ALL";
  const selectedPerson = people.find((person) => person.name === selectedEmployee) || null;
  const visiblePeople = selectedEmployee === "ALL" ? people : selectedPerson ? [selectedPerson] : [];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{DEMO_PERSONAS.manager.name} - Manager Dashboard</h1>
          <p className="text-sm text-slate-300">
            Live task visibility by person. New tasks added in the new hire dashboard appear here automatically.
          </p>
          <Link href="/manager/tasks" className="inline-block text-sm text-cyan-300 hover:text-cyan-200">
            Open manager task setup
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Team avg progress</p>
            <p className="mt-2 text-3xl font-bold">{avgProgress}%</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">On track</p>
            <p className="mt-2 text-3xl font-bold">{onTrack}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Needs intervention</p>
            <p className="mt-2 text-3xl font-bold">{people.length - onTrack}</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-base font-semibold">Task status by employee</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-300">Loading manager view...</p>
          ) : people.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No tasks found yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveEmployee("ALL")}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    selectedEmployee === "ALL"
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  All Employees
                </button>
                {people.map((person) => (
                  <button
                    key={person.name}
                    type="button"
                    onClick={() => setActiveEmployee(person.name)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      selectedEmployee === person.name
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
              <div className="grid gap-3">
                {visiblePeople.map((person) => (
                  <article key={person.name} className="rounded border border-slate-700 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{person.name}</p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          person.status === "On Track"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {person.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Progress: {person.progress}% ({person.completed}/{person.total} tasks complete)
                    </p>
                    <div className="mt-2 h-2 w-full rounded bg-slate-700">
                      <div className="h-2 rounded bg-cyan-400" style={{ width: `${person.progress}%` }} />
                    </div>
                    {person.tasks.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-400">No tasks assigned yet.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm">
                        {person.tasks.map((task) => (
                          <li key={task.id} className="rounded border border-slate-700 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span>{task.title}</span>
                              <span className="rounded bg-slate-700 px-2 py-1 text-xs">{task.status}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold">Needs manager action</h2>
            {atRisk.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">No at-risk teammates right now.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {atRisk.map((person) => (
                  <li key={person.name}>
                    <span className="font-medium text-slate-100">{person.name}:</span> follow up on incomplete tasks.
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold">Recommended next actions</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Review task lists by assignee each morning.</li>
              <li>Resolve blockers for anyone below 70% completion.</li>
              <li>Confirm all required security tasks are marked complete.</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
