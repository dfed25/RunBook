"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_PERSONAS, DEMO_QUESTIONS } from "@/lib/demoScenario";
import { OnboardingTask } from "@/lib/types";
import { AppButton } from "@/components/ui/AppButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PersonSummary = {
  hireId: string;
  name: string;
  tasks: OnboardingTask[];
  progress: number;
  completedTasks: number;
  totalTasks: number;
  status: "On Track" | "At Risk";
};

export default function ManagerPage() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHireId, setActiveHireId] = useState<string>("ALL");

  useEffect(() => {
    const controller = new AbortController();
    async function loadOverview() {
      try {
        const res = await fetch("/api/manager/overview", { signal: controller.signal });
        if (!res.ok) {
          setError("Unable to load manager overview right now.");
          return;
        }
        const data = await res.json();
        const employees = Array.isArray(data?.employees) ? data.employees : [];
        setPeople(employees);
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error(error);
          setError("Unable to load manager overview right now.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void loadOverview();
    return () => controller.abort();
  }, []);

  const avgProgress = people.length
    ? Math.round(people.reduce((sum, person) => sum + person.progress, 0) / people.length)
    : 0;
  const onTrack = people.filter((person) => person.status === "On Track").length;
  const atRisk = people.filter((person) => person.status === "At Risk");
  const stuckTasks = people
    .flatMap((person) =>
      person.tasks
        .filter((task) => task.status !== "complete")
        .map((task) => ({ ...task, owner: person.name })),
    )
    .slice(0, 6);
  const knownHireIds = new Set(people.map((person) => person.hireId));
  const selectedHireId =
    activeHireId === "ALL" || knownHireIds.has(activeHireId) ? activeHireId : "ALL";
  const selectedPerson = people.find((person) => person.hireId === selectedHireId) || null;
  const visiblePeople = selectedHireId === "ALL" ? people : selectedPerson ? [selectedPerson] : [];

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
          {error ? <p className="text-sm text-amber-300">{error}</p> : null}
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

        <SectionCard title="Task status by employee" subtitle="Filter by hire to inspect blockers and completion trends.">
          {loading ? (
            <p className="mt-3 text-sm text-slate-300">Loading manager view...</p>
          ) : people.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No tasks found yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  onClick={() => setActiveHireId("ALL")}
                  className="rounded-full px-3 py-1 text-sm"
                  variant="ghost"
                  tone={selectedHireId === "ALL" ? "active" : "inactive"}
                >
                  All Employees
                </AppButton>
                {people.map((person) => (
                  <AppButton
                    key={person.hireId}
                    type="button"
                    onClick={() => setActiveHireId(person.hireId)}
                    className="rounded-full px-3 py-1 text-sm"
                    variant="ghost"
                    tone={selectedHireId === person.hireId ? "active" : "inactive"}
                  >
                    {person.name}
                  </AppButton>
                ))}
              </div>
              <div className="grid gap-3">
                {visiblePeople.map((person) => (
                  <article key={person.hireId} className="rounded border border-slate-700 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">{person.name}</p>
                      <StatusBadge tone={person.status === "On Track" ? "success" : "warning"}>
                        {person.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Progress: {person.progress}% ({person.completedTasks}/{person.totalTasks} tasks complete)
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
        </SectionCard>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold">Most asked questions</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {DEMO_QUESTIONS.slice(0, 5).map((question) => (
                <li key={question} className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                  {question}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold">Documentation gap insights</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                Add a short &quot;Environment troubleshooting matrix&quot; to reduce repetitive setup questions.
              </li>
              <li className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                Expand Product Overview with customer use cases to help new hires frame early work.
              </li>
              <li className="rounded border border-slate-700 bg-slate-950 px-3 py-2">
                Capture Slack escalation paths in one doc for faster unblock times.
              </li>
            </ul>
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-900 p-4 md:col-span-2">
            <h2 className="text-base font-semibold">Stuck tasks</h2>
            {stuckTasks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">No stuck tasks right now.</p>
            ) : (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {stuckTasks.map((task) => (
                  <li key={task.id} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-100">{task.title}</p>
                    <p className="text-slate-400">
                      {task.owner} · {task.status} · {task.sourceTitle}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-base font-semibold">Needs manager action</h2>
            {atRisk.length === 0 ? (
              <p className="mt-3 text-sm text-slate-300">No at-risk teammates right now.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {atRisk.map((person) => (
                  <li key={person.hireId}>
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
