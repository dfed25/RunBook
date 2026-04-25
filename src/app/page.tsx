import Link from "next/link";
import { DEMO_PERSONAS } from "@/lib/demoScenario";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <p className="inline-block rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
            Northstar AI - Runbook
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            Turn company knowledge into guided onboarding across every app.
          </h1>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            Runbook connects policies and playbooks to assignee tasks, in-app walkthroughs on demo tools, and a copilot
            that answers with numbered steps—so new hires move from reading docs to doing the work in GitHub, finance,
            security portals, and more.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">1) How it works</h2>
            <p className="mt-2 text-sm text-slate-300">
              Managers create onboarding tasks by assignee. Task status updates from dashboards, APIs, and demo flows
              roll up into one manager view with progress and risk.
            </p>
          </article>
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">2) View results</h2>
            <p className="mt-2 text-sm text-slate-300">
              Open the manager dashboard to toggle between employees and inspect each person&apos;s completion rate and
              task statuses.
            </p>
          </article>
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">3) Create tasks</h2>
            <p className="mt-2 text-sm text-slate-300">
              Use manager task setup to assign new onboarding tasks to {DEMO_PERSONAS.newHire.name} or other new hires
              and immediately surface them in reporting.
            </p>
          </article>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link href="/manager" className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300">
            Open Manager Dashboard
          </Link>
          <Link href="/manager/tasks" className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold hover:border-slate-400">
            Open Manager Task Creation
          </Link>
          <Link href="/dashboard" className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold hover:border-slate-400">
            Open New Hire Dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
