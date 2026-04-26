"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  loadImportedDocs,
  loadProjectId,
  type DemoManualSource,
  type ImportedDocument
} from "@/lib/studioDemoStorage";

type ChatResponse = {
  answer?: string;
  error?: string;
  bullets?: string[];
  sources?: SourceItem[];
  steps?: string[];
  suggestions?: string[];
};

type SourceItem = { title: string; excerpt?: string; url?: string };

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text?: string;
      answer?: string;
      bullets?: string[];
      steps?: string[];
      sources?: SourceItem[];
      suggestions?: string[];
      isWelcome?: boolean;
    };

export type EmbeddedRunbookAssistantProps = {
  projectId?: string;
  /** API origin (default same window) */
  apiBase?: string;
  assistantName: string;
  welcomeMessage: string;
  primaryColor: string;
  suggestedQuestions: string[];
  manualSources?: DemoManualSource[];
  importedDocuments?: ImportedDocument[];
  hideQuickActions?: boolean;
  /** `page` = fixed to viewport; `embedded` = inside a positioned preview box */
  position?: "page" | "embedded";
  className?: string;
};

type StepModeProps = {
  messageId: string;
  steps: string[];
  completedMap: Record<number, boolean>;
  onToggle: (messageId: string, stepIndex: number) => void;
};

const StepMode = memo(function StepMode({ messageId, steps, completedMap, onToggle }: StepModeProps) {
  const completeCount = Object.values(completedMap).filter(Boolean).length;
  const firstIncomplete = steps.findIndex((_, i2) => !Boolean(completedMap[i2]));
  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Step Mode</p>
        <p className="text-[10px] text-emerald-300">
          {completeCount}/{steps.length}
        </p>
      </div>
      <ul className="space-y-1">
        {steps.map((step, idx) => {
          const checked = Boolean(completedMap[idx]);
          return (
            <li
              key={`${messageId}-s-${idx}`}
              className={`flex items-start gap-2 text-xs ${
                idx === firstIncomplete && !checked ? "text-emerald-200" : "text-slate-300"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(messageId, idx)}
                className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                  checked ? "border-emerald-400 bg-emerald-500/30" : "border-slate-500 bg-transparent"
                }`}
                aria-label={`Toggle step ${idx + 1}`}
              />
              <span className={checked ? "text-slate-500 line-through" : ""}>{step}</span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={firstIncomplete < 0}
        onClick={() => {
          if (firstIncomplete >= 0) onToggle(messageId, firstIncomplete);
        }}
        className="mt-2 rounded bg-emerald-600/20 px-2 py-1 text-[10px] font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {firstIncomplete < 0 ? "All steps complete" : "Mark next step complete"}
      </button>
    </div>
  );
});

function isExplainPageIntent(action: string): boolean {
  const normalized = action.toLowerCase().replace(/[.!?]+$/g, "").trim();
  return normalized === "explain this page" || normalized === "explain the current page";
}

export function EmbeddedRunbookAssistant({
  projectId = "northstar-demo",
  apiBase,
  assistantName,
  welcomeMessage,
  primaryColor,
  suggestedQuestions,
  manualSources = [],
  importedDocuments,
  hideQuickActions = false,
  position = "page",
  className = ""
}: EmbeddedRunbookAssistantProps) {
  const base = apiBase?.replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [completedStepsByMessage, setCompletedStepsByMessage] = useState<Record<string, Record<number, boolean>>>({});
  const [activeSource, setActiveSource] = useState<SourceItem | null>(null);

  const posWrap = position === "embedded" ? "relative h-full min-h-[360px] w-full overflow-hidden bg-slate-50" : "";
  const fixedLaunch = position === "page" ? "fixed bottom-5 right-5 z-[2147483000]" : "absolute bottom-4 right-4 z-20";
  const fixedPanel = position === "page" ? "fixed bottom-[5.5rem] right-5 z-[2147483000]" : "absolute bottom-[4.5rem] right-4 z-20";

  const launchStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${primaryColor}, #4f46e5)`,
      boxShadow: `0 10px 40px ${primaryColor}55`
    }),
    [primaryColor]
  );

  const effectiveImportedDocs = useMemo(
    () => {
      if (importedDocuments) return importedDocuments;
      if (typeof window === "undefined") return [];
      const activeProjectId = loadProjectId();
      if (activeProjectId !== projectId) return [];
      return loadImportedDocs();
    },
    [importedDocuments, projectId]
  );

  const send = useCallback(
    async (text: string, pageContextOverride?: string) => {
      const q = text.trim();
      if (!q) return;
      setError(null);
      setMessages((m) => [...m, { role: "user", text: q }]);
      setInput("");
      setLoading(true);
      try {
        const customSources = manualSources.map(({ title, content }) => ({ title, content }));
        const res = await fetch(`${base}/api/embed/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message: q,
            pageContext:
              pageContextOverride ||
              (typeof window !== "undefined" ? `${window.location.href}\n${document.title}` : ""),
            customSources,
            documents: effectiveImportedDocs
          })
        });
        const data = (await res.json()) as ChatResponse;
        if (!res.ok) {
          setMessages((m) => [...m, { role: "assistant", text: data.error || `Request failed (${res.status})` }]);
          return;
        }
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            answer: data.answer,
            bullets: (data.bullets || []).slice(0, 3),
            steps: data.steps || [],
            sources: (data.sources || []).slice(0, 6),
            suggestions: (data.suggestions || []).slice(0, 3),
            text: !data.answer ? "No content." : undefined
          }
        ]);
      } catch {
        setMessages((m) => [...m, { role: "assistant", text: "Network error — try again." }]);
      } finally {
        setLoading(false);
      }
    },
    [base, projectId, manualSources, effectiveImportedDocs]
  );

  const openPanel = useCallback(() => {
    setOpen(true);
    setMessages((m) =>
      m.length === 0
        ? [{ role: "assistant", text: welcomeMessage, isWelcome: true }]
        : m
    );
  }, [welcomeMessage]);

  const explainThisPage = useCallback(() => {
    const pageText =
      typeof document !== "undefined"
        ? document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 14_000)
        : "";
    const ctx = typeof window !== "undefined" ? `${window.location.href}\n${document.title}\n\n${pageText}` : pageText;
    void send("Explain this page", ctx);
  }, [send]);

  const toggleStep = (messageId: string, stepIndex: number) => {
    setCompletedStepsByMessage((prev) => ({
      ...prev,
      [messageId]: {
        ...(prev[messageId] || {}),
        [stepIndex]: !(prev[messageId] || {})[stepIndex]
      }
    }));
  };

  const actionTiles = [
    { label: "Get GitHub access", prompt: "Get GitHub access" },
    { label: "Set up first workflow", prompt: "Set up first workflow" },
    { label: "Connect integrations", prompt: "Connect integrations" },
    { label: "Explore features", prompt: "What features can I use here?" }
  ];

  const mappedSuggestedActions = suggestedQuestions
    .filter(Boolean)
    .slice(0, 4)
    .map((s) => ({ label: s.replace(/\?+$/, "").trim(), prompt: s }));

  const chips = [...actionTiles, ...mappedSuggestedActions].slice(0, 8);

  return (
    <div className={`${posWrap} ${className}`}>
      <button
        type="button"
        aria-label="Open Runbook assistant"
        className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white shadow-xl transition hover:brightness-110 ${fixedLaunch}`}
        style={launchStyle}
        onClick={() => {
          if (!open) {
            openPanel();
          } else {
            setOpen(false);
          }
        }}
      >
        {assistantName.slice(0, 1).toUpperCase()}
      </button>

      {open ? (
        <div
          className={`flex w-[min(100%,380px)] max-h-[min(78vh,520px)] flex-col overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900 shadow-2xl ${fixedPanel}`}
        >
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Runbook</p>
              <p className="text-sm font-semibold text-white">{assistantName}</p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {!hideQuickActions && chips.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 border-b border-slate-800 px-2 py-2">
              <button
                type="button"
                className="col-span-2 rounded-md border border-emerald-500/50 bg-emerald-900/30 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-800/50"
                onClick={explainThisPage}
              >
                What can I do here?
              </button>
              <button
                type="button"
                className="col-span-2 rounded-md border border-amber-500/50 bg-amber-900/30 px-2.5 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-800/50"
                onClick={() => void send("What should I do next?")}
              >
                What should I do next?
              </button>
              {chips.map((c) => (
                <button
                  key={`${c.label}-${c.prompt}`}
                  type="button"
                  className="rounded-md border border-indigo-500/40 bg-indigo-950/50 px-2.5 py-1.5 text-[10px] font-medium text-indigo-100 hover:bg-indigo-900/70"
                  onClick={() => void send(c.prompt)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((msg, i) => {
              const messageId = `m-${i}`;
              if (msg.role === "user") {
                return (
                  <div key={messageId} className="ml-6 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-right text-sm text-white">
                    {msg.text}
                  </div>
                );
              }
              return (
                <div key={messageId} className="mr-4 rounded-xl border border-slate-700/80 bg-slate-800/90 px-3 py-2 text-left">
                  {msg.answer ? (
                    <p className="mb-1 text-sm font-semibold leading-snug text-slate-100">{msg.answer}</p>
                  ) : (
                    <p className="text-sm text-slate-200">{msg.text}</p>
                  )}
                  {msg.bullets && msg.bullets.length > 0 ? (
                    <ul className="mb-2 mt-1 space-y-1 text-xs text-slate-300">
                      {msg.bullets.slice(0, 3).map((bullet, idx) => (
                        <li key={`${messageId}-b-${idx}`} className="flex gap-2">
                          <span>•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {msg.steps && msg.steps.length > 0 ? (
                    <StepMode
                      messageId={messageId}
                      steps={msg.steps || []}
                      completedMap={completedStepsByMessage[messageId] || {}}
                      onToggle={toggleStep}
                    />
                  ) : null}
                  {msg.sources && msg.sources.length > 0 ? (
                    <div className="mt-3 border-t border-slate-700/80 pt-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sources</p>
                      <div className="space-y-2">
                        {msg.sources.map((s, idx) => (
                          <button
                            key={`${messageId}-src-${idx}`}
                            type="button"
                            onClick={() => setActiveSource(s)}
                            className="w-full rounded-lg bg-slate-900 p-2 text-left text-[11px] hover:bg-slate-800"
                          >
                            <p className="font-semibold text-indigo-200">📄 {s.title}</p>
                            <p className="mt-0.5 text-slate-400">
                              {(s.excerpt || "").slice(0, 120)}
                              {(s.excerpt || "").length > 120 ? "…" : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-700/70 pt-2">
                    {(msg.suggestions && msg.suggestions.length > 0
                      ? msg.suggestions
                      : ["Guide me step-by-step", "Explain this page", "What can I do next?"]
                    ).map((action, actionIdx) => (
                      <button
                        key={`${messageId}-q-${actionIdx}-${action}`}
                        type="button"
                        onClick={() => {
                          if (isExplainPageIntent(action)) explainThisPage();
                          else void send(action);
                        }}
                        className="rounded-full border border-slate-500/50 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {loading ? <p className="text-center text-xs text-slate-500">Thinking…</p> : null}
            {error ? <p className="text-center text-xs text-rose-400">{error}</p> : null}
          </div>
          <div className="flex gap-2 border-t border-slate-700 p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask anything…"
              className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void send(input)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              Send
            </button>
          </div>
        </div>
      ) : null}
      {open && activeSource ? (
        <div className={`${fixedPanel} z-[2147483001] w-[min(100%,420px)]`}>
          <div className="rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-indigo-200">📄 {activeSource.title}</p>
                {activeSource.url ? (
                  <a href={activeSource.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-300 underline">
                    Open source URL
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActiveSource(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ×
              </button>
            </div>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-2 text-[11px] text-slate-300">
              {activeSource.excerpt || "No excerpt available."}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
