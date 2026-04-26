import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,.35),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-20 text-center sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-300/90">Runbook</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl sm:leading-tight">
            Turn your docs into an embedded onboarding copilot.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
            Runbook lets teams connect their knowledge base, generate a lightweight AI assistant, and embed it into any
            website or app with one line of code — Intercom / Grammarly style, but for onboarding and product guidance.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/studio"
              className="rounded-xl bg-indigo-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400"
            >
              Open Studio
            </Link>
            <Link
              href="/embed-demo"
              className="rounded-xl border border-white/20 px-8 py-3.5 text-sm font-semibold text-white hover:border-white/40"
            >
              View live embed demo
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-500">How it works</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            { step: "1", title: "Connect knowledge", body: "Start with GitHub, docs, and wiki content your team already trusts." },
            { step: "2", title: "Configure assistant", body: "Tune name, welcome copy, and suggested questions in Studio." },
            { step: "3", title: "Embed anywhere", body: "Paste one script tag — users get answers and step-by-step help in context." }
          ].map((c) => (
            <div
              key={c.step}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left shadow-lg shadow-black/20"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-300">
                {c.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-white">See it on a real-looking product page</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
            The Runbook bubble sits on top of your UI — users never leave your app to read a static handbook.
          </p>
          <div className="relative mx-auto mt-14 max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex h-10 items-center gap-2 border-b border-white/10 bg-slate-900/80 px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-3 flex-1 truncate rounded bg-slate-800 py-1 text-center text-[10px] text-slate-500">
                northstar.dev / portal
              </span>
            </div>
            <div className="grid gap-0 md:grid-cols-[140px_1fr]">
              <div className="hidden border-r border-white/10 bg-slate-900/60 p-4 text-xs text-slate-500 md:block">
                <p className="font-medium text-slate-400">Nav</p>
                <p className="mt-3">Getting started</p>
                <p className="mt-2">API keys</p>
                <p className="mt-2">GitHub</p>
              </div>
              <div className="min-h-[220px] p-6 sm:min-h-[260px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Fake SaaS viewport</p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                  Your actual embed loads a floating assistant here. Open the live demo to try questions like &quot;How
                  do I get GitHub access?&quot;
                </p>
              </div>
            </div>
            <div
              className="pointer-events-none absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-xl"
              aria-hidden
            >
              R
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Try the real widget on{" "}
            <Link href="/embed-demo" className="font-medium text-indigo-400 hover:text-indigo-300">
              /embed-demo
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-white">Not another chatbot dashboard.</h2>
        <p className="mt-4 text-slate-400">
          Runbook lives <strong className="text-slate-200">inside the workflow</strong> — next to your forms, your
          settings, and your empty states. Companies embed AI onboarding directly in the product, docs, or internal
          tools so users get guided without context-switching.
        </p>
      </section>
    </main>
  );
}
