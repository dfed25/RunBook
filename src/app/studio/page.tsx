"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmbeddedRunbookAssistant } from "@/components/EmbeddedRunbookAssistant";
import {
  DEFAULT_DEMO_BUNDLE,
  loadDemoBundle,
  type DemoManualSource,
  saveDemoBundle
} from "@/lib/studioDemoStorage";

const SEEDED_SOURCES = [
  { id: "gh", name: "GitHub repository", detail: "northstar-ai/platform · main", status: "Connected", tone: "emerald" },
  { id: "notion", name: "Notion wiki", detail: "Engineering handbook + playbooks", status: "Synced", tone: "emerald" },
  { id: "docs", name: "Product docs", detail: "OpenAPI + internal guides", status: "Imported", tone: "emerald" }
] as const;

export default function StudioPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [assistantName, setAssistantName] = useState(() => loadDemoBundle().assistantName);
  const [welcome, setWelcome] = useState(() => loadDemoBundle().welcome);
  const [primaryColor, setPrimaryColor] = useState(() => loadDemoBundle().primaryColor);
  const [suggestedRaw, setSuggestedRaw] = useState(() => {
    const questions = loadDemoBundle().suggestedQuestions;
    return questions.length ? questions.join("\n") : DEFAULT_DEMO_BUNDLE.suggestedQuestions.join("\n");
  });
  const [manualSources, setManualSources] = useState<DemoManualSource[]>(() => loadDemoBundle().manualSources);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const suggestedQuestions = useMemo(
    () =>
      suggestedRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [suggestedRaw]
  );

  useEffect(() => {
    saveDemoBundle({
      assistantName,
      welcome,
      primaryColor,
      suggestedQuestions,
      manualSources
    });
  }, [assistantName, welcome, primaryColor, suggestedQuestions, manualSources]);

  const embedSnippet = origin
    ? `<script src="${origin}/runbook-embed.js" data-project-id="northstar-demo" async></script>`
    : `<script src="https://your-runbook-host/runbook-embed.js" data-project-id="northstar-demo" async></script>`;

  const addManualSource = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const title = newTitle.trim();
      const content = newContent.trim();
      if (!title || !content) return;
      setManualSources((prev) => [
        ...prev,
        { id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}`, title, content }
      ]);
      setNewTitle("");
      setNewContent("");
    },
    [newTitle, newContent]
  );

  const removeManual = useCallback((id: string) => {
    setManualSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/30 pb-20 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/90">Runbook Studio</p>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">Northstar AI Onboarding</h1>
            <p className="mt-1 text-xs text-slate-500">Demo workspace · knowledge + assistant config sync to this browser (localStorage)</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/embed-demo"
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-200 hover:border-white/30"
            >
              Open embed demo
            </Link>
            <Link href="/" className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/20">
            <h2 className="text-sm font-semibold text-white">Knowledge sources</h2>
            <p className="mt-1 text-xs text-slate-400">Seeded integrations plus any notes you add below are sent with chat as extra context.</p>
            <ul className="mt-5 space-y-3">
              {SEEDED_SOURCES.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
            {manualSources.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {manualSources.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-indigo-500/25 bg-indigo-950/20 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium text-indigo-100">{s.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-slate-500">{s.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeManual(s.id)}
                      className="shrink-0 text-rose-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <form className="mt-5 space-y-3 border-t border-white/10 pt-5" onSubmit={addManualSource}>
              <p className="text-xs font-medium text-slate-400">Add manual knowledge</p>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title (e.g. Release checklist)"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Content (policies, FAQs, copy-paste from Confluence…)"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
              />
              <button
                type="submit"
                className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Add source
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/20">
            <h2 className="text-sm font-semibold text-white">Assistant configuration</h2>
            <p className="mt-1 text-xs text-slate-400">Updates the live preview on the right and syncs to /embed-demo on the same browser.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="text-slate-500">Assistant name</span>
                <input
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-500">Primary color</span>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-slate-950"
                />
              </label>
            </div>
            <label className="mt-4 block text-xs">
              <span className="text-slate-500">Welcome message</span>
              <textarea
                value={welcome}
                onChange={(e) => setWelcome(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60"
              />
            </label>
            <label className="mt-4 block text-xs">
              <span className="text-slate-500">Suggested questions (one per line)</span>
              <textarea
                value={suggestedRaw}
                onChange={(e) => setSuggestedRaw(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-300 outline-none focus:border-indigo-500/60"
              />
            </label>
          </section>
        </div>

        <div className="space-y-8 lg:col-span-5">
          <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-6 shadow-xl shadow-indigo-950/40">
            <h2 className="text-sm font-semibold text-white">Embed on your site</h2>
            <p className="mt-1 text-xs text-indigo-200/70">
              One script tag. The demo uses <code className="text-indigo-100">northstar-demo</code> — no API key
              required for the public sample.
            </p>
            <textarea
              readOnly
              className="mt-4 h-28 w-full resize-none rounded-xl border border-white/10 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-indigo-100"
              value={embedSnippet}
            />
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(embedSnippet)}
              className="mt-3 w-full rounded-lg bg-indigo-500 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400"
            >
              Copy embed code
            </button>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-white">Live preview</h2>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">embedded assistant</span>
            </div>
            <div className="relative h-[min(520px,55vh)] min-h-[380px] w-full bg-slate-100">
              <EmbeddedRunbookAssistant
                assistantName={assistantName}
                welcomeMessage={welcome}
                primaryColor={primaryColor}
                suggestedQuestions={suggestedQuestions}
                manualSources={manualSources}
                position="embedded"
                apiBase={origin || undefined}
                className="h-full w-full"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 p-5 text-xs text-slate-500">
            <p>
              <strong className="text-slate-400">Production:</strong> connect a real repo, mint an API key, and pass{" "}
              <code className="text-slate-300">data-key</code> alongside <code className="text-slate-300">data-project</code>{" "}
              — see repo README for the advanced path.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
