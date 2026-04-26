"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadImportedDocs,
  loadProjectId,
  type DemoManualSource,
  type ImportedDocument
} from "@/lib/studioDemoStorage";
import { MAX_BULLETS, MAX_SOURCES, MAX_STEPS, MAX_SUGGESTIONS } from "@/lib/embedStructured";

type ChatResponse = {
  answer?: string;
  error?: string;
  bullets?: string[];
  sources?: SourceItem[];
  steps?: string[];
  suggestions?: string[];
  mode?: string;
};

type SourceItem = { title: string; excerpt?: string; url?: string };
type HoveredFeatureContext = { feature?: string; title?: string; description?: string };
type ExternalFeatureContext = { feature?: string; title?: string; description?: string };

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
  const [hoveredFeature, setHoveredFeature] = useState<HoveredFeatureContext | null>(null);
  const [externalFeature, setExternalFeature] = useState<ExternalFeatureContext | null>(null);
  const highlightCleanupRef = useRef<() => void>(() => undefined);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const hoveredFeatureRef = useRef<HoveredFeatureContext | null>(null);
  const hoverDebounceRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      highlightCleanupRef.current?.();
      if (hoverDebounceRef.current) window.clearTimeout(hoverDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    const onExternalFeature = (evt: Event) => {
      const detail = (evt as CustomEvent<ExternalFeatureContext | null>).detail;
      if (!detail || (!detail.feature && !detail.title && !detail.description)) {
        setExternalFeature(null);
        return;
      }
      setExternalFeature(detail);
    };
    const onSuggestion = (evt: Event) => {
      const detail = (evt as CustomEvent<string>).detail;
      const text = String(detail || "").trim();
      if (!text) return;
      setMessages((m) => [...m, { role: "assistant", text }]);
      if (!open) setOpen(true);
    };
    window.addEventListener("runbook-active-feature", onExternalFeature as EventListener);
    window.addEventListener("runbook-assistant-suggestion", onSuggestion as EventListener);
    return () => {
      window.removeEventListener("runbook-active-feature", onExternalFeature as EventListener);
      window.removeEventListener("runbook-assistant-suggestion", onSuggestion as EventListener);
    };
  }, [open]);

  useEffect(() => {
    hoveredFeatureRef.current = hoveredFeature;
  }, [hoveredFeature]);

  useEffect(() => {
    const node = chatBodyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handlePointerOver = (evt: Event) => {
      const target = evt.target instanceof Element ? evt.target : null;
      if (!target) return;
      const el = target.closest<HTMLElement>("[data-runbook-feature],[data-runbook-title],[data-runbook-description]");
      if (!el) return;
      if (hoverDebounceRef.current) window.clearTimeout(hoverDebounceRef.current);
      hoverDebounceRef.current = window.setTimeout(() => {
        const next: HoveredFeatureContext = {
          feature: (el.getAttribute("data-runbook-feature") || "").trim() || undefined,
          title: (el.getAttribute("data-runbook-title") || "").trim() || undefined,
          description: (el.getAttribute("data-runbook-description") || "").trim() || undefined
        };
        if (!next.feature && !next.title && !next.description) return;
        setHoveredFeature(next);
      }, 80);
    };
    const clearHovered = () => {
      if (hoverDebounceRef.current) window.clearTimeout(hoverDebounceRef.current);
      hoverDebounceRef.current = window.setTimeout(() => setHoveredFeature(null), 120);
    };
    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", clearHovered, true);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", clearHovered, true);
    };
  }, []);

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
        const pageBody =
          typeof document !== "undefined"
            ? document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 10_000)
            : "";
        const pageContext = pageContextOverride || pageBody;
        const activeFeature = externalFeature || hoveredFeatureRef.current;
        const res = await fetch(`${base}/api/embed/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            message: q,
            pageContext,
            pageTitle: typeof document !== "undefined" ? document.title : "",
            pageUrl: typeof window !== "undefined" ? window.location.href : "",
            hoveredFeature: activeFeature,
            customSources,
            documents: effectiveImportedDocs
          })
        });
        const data = (await res.json()) as ChatResponse;
        if (!res.ok) {
          setMessages((m) => [...m, { role: "assistant", text: data.error || `Request failed (${res.status})` }]);
          return;
        }
        const sourceCount = Array.isArray(data.sources) ? data.sources.length : 0;
        const missingIndexSignal =
          data.mode === "unindexed" ||
          /AI is not configured|no indexed chunks yet/i.test(data.answer || "") ||
          sourceCount === 0;

        setMessages((m) => [
          ...m,
          ...(missingIndexSignal
            ? [
                {
                  role: "assistant" as const,
                  text: "Codebase not indexed yet. Connect your GitHub repo in Studio and run Index repository for code-aware onboarding steps."
                }
              ]
            : []),
          {
            role: "assistant",
            answer: data.answer,
            bullets: (data.bullets || []).slice(0, MAX_BULLETS),
            steps: (data.steps || []).slice(0, MAX_STEPS),
            sources: (data.sources || []).slice(0, MAX_SOURCES),
            suggestions: (data.suggestions || []).slice(0, MAX_SUGGESTIONS),
            text: !data.answer ? "No content." : undefined
          }
        ]);
        highlightCleanupRef.current();
        const highlightAttempt = maybeHighlightElementForQuestion(q, data);
        if (!highlightAttempt.cleanup) {
          const answerText = String(data.answer || "");
          const looksLikeTargetedAnswer =
            /(look for|labeled|labelled|button|cta|click|create account|sign up|get started|log in|register)/i.test(
              answerText
            ) || (Array.isArray(data.steps) && data.steps.length > 0);
          if (isLocationIntent(q) && highlightAttempt.lowConfidence) {
            setMessages((m) => [
              ...m,
              {
                role: "assistant",
                text: "I found multiple possible matches on this page. Tell me the exact label you see (for example, Create workflow or Connect Slack) and I will highlight it."
              }
            ]);
          } else if (isLocationIntent(q) && !looksLikeTargetedAnswer) {
            setMessages((m) => [
              ...m,
              {
                role: "assistant",
                text: "I couldn't confidently find that element on this page. Try the exact label (e.g. Create account) or ask me to explain this page."
              }
            ]);
          }
          highlightCleanupRef.current = () => undefined;
        } else {
          highlightCleanupRef.current = highlightAttempt.cleanup;
        }
      } catch {
        setMessages((m) => [...m, { role: "assistant", text: "Network error — try again." }]);
      } finally {
        setLoading(false);
      }
    },
    [base, projectId, manualSources, effectiveImportedDocs, externalFeature]
  );
  const triggerGuideMe = () => {
    window.dispatchEvent(new CustomEvent("runbook-start-tour"));
    setMessages((m) => [...m, { role: "assistant", text: "Starting a guided tour now." }]);
  };

  const triggerWhatNext = () => {
    window.dispatchEvent(new CustomEvent("runbook-what-next"));
    setMessages((m) => [...m, { role: "assistant", text: "I highlighted your best next step." }]);
  };


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
    { label: "Set up first workflow", prompt: "Set up first workflow" },
    { label: "Connect integrations", prompt: "Connect integrations" }
  ];

  const mappedSuggestedActions = suggestedQuestions
    .filter(Boolean)
    .slice(0, 4)
    .map((s) => ({ label: s.replace(/\?+$/, "").trim(), prompt: s }));

  const chips = [...actionTiles, ...mappedSuggestedActions].slice(0, 4);
  const showQuickActions = !hideQuickActions && chips.length > 0 && messages.length === 0;

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
          className={`flex w-[min(100%,360px)] max-h-[min(76vh,500px)] flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 shadow-2xl ${fixedPanel}`}
        >
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
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
          {externalFeature || hoveredFeature ? (
            <div className="border-b border-slate-800 px-3 py-1.5 text-[10px] text-slate-300">
              Looking at:{" "}
              <span className="font-semibold text-emerald-300">
                {externalFeature?.title ||
                  externalFeature?.feature ||
                  hoveredFeature?.title ||
                  hoveredFeature?.feature ||
                  "Current feature"}
              </span>
            </div>
          ) : null}
          {showQuickActions ? (
            <div className="grid grid-cols-2 gap-1.5 border-b border-slate-800 px-2 py-2">
              <button
                type="button"
                className="col-span-2 rounded-md border border-emerald-500/50 bg-emerald-900/30 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-800/50"
                onClick={() => void send("What can I do here?")}
              >
                What can I do here?
              </button>
              <button
                type="button"
                className="rounded-md border border-indigo-500/40 bg-indigo-950/50 px-2.5 py-1.5 text-[10px] font-medium text-indigo-100 hover:bg-indigo-900/70"
                onClick={triggerGuideMe}
              >
                Guide me
              </button>
              <button
                type="button"
                className="rounded-md border border-indigo-500/40 bg-indigo-950/50 px-2.5 py-1.5 text-[10px] font-medium text-indigo-100 hover:bg-indigo-900/70"
                onClick={triggerWhatNext}
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
          <div ref={chatBodyRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
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
                      {msg.bullets.slice(0, MAX_BULLETS).map((bullet, idx) => (
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
                          if (/^guide me\b/i.test(action)) triggerGuideMe();
                          else if (/what should i do next/i.test(action) || /what can i do next/i.test(action)) triggerWhatNext();
                          else if (isExplainPageIntent(action)) explainThisPage();
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
type HighlightAttempt = { cleanup: (() => void) | null; lowConfidence: boolean };

function maybeHighlightElementForQuestion(question: string, data: ChatResponse): HighlightAttempt {
  if (typeof document === "undefined") return { cleanup: () => undefined, lowConfidence: false };
  if (!isLocationIntent(question)) return { cleanup: () => undefined, lowConfidence: false };

  ensureHighlightStyleTag();
  const hint = [question, data.answer || "", (data.steps || []).join(" ")].join(" ");
  const scored = findBestTarget(hint, question);
  if (!scored) return { cleanup: null, lowConfidence: false };
  if (!scored.highConfidence) return { cleanup: null, lowConfidence: true };
  const target = scored.element;

  target.classList.add("rb-highlight-target");
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  const overlay = document.createElement("div");
  overlay.className = "rb-highlight-overlay";
  overlay.textContent = data.steps?.[0] || "Start here for this action.";
  const rect = target.getBoundingClientRect();
  overlay.style.top = `${window.scrollY + rect.bottom + 8}px`;
  overlay.style.left = `${window.scrollX + Math.max(12, rect.left)}px`;
  document.body.appendChild(overlay);

  const timeout = window.setTimeout(() => {
    target.classList.remove("rb-highlight-target");
    overlay.remove();
  }, 8000);

  return {
    cleanup: () => {
      window.clearTimeout(timeout);
      target.classList.remove("rb-highlight-target");
      overlay.remove();
    },
    lowConfidence: false
  };
}

function ensureHighlightStyleTag(): void {
  if (document.getElementById("rb-page-highlight-style")) return;
  const styleTag = document.createElement("style");
  styleTag.id = "rb-page-highlight-style";
  styleTag.textContent =
    "@keyframes rbPagePulse{0%{box-shadow:0 0 0 3px rgba(99,102,241,.95);}50%{box-shadow:0 0 0 8px rgba(99,102,241,.25);}100%{box-shadow:0 0 0 3px rgba(99,102,241,.95);}}" +
    ".rb-highlight-target{animation:rbPagePulse 1.2s ease-in-out infinite !important;box-shadow:0 0 0 3px rgba(99,102,241,.95) !important;border-radius:8px !important;}" +
    ".rb-highlight-overlay{position:absolute;z-index:2147483647;max-width:320px;background:#1e1b4b;color:#eef2ff;border:1px solid rgba(129,140,248,.5);border-radius:10px;padding:10px 12px;font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(30,27,75,.45);}";
  document.head.appendChild(styleTag);
}

function findBestTarget(hint: string, question: string): { element: HTMLElement; highConfidence: boolean } | null {
  const tokens = tokenize(hint).slice(0, 20);
  if (tokens.length === 0) return null;
  const intentCompact = compact(extractIntentPhrase(question));
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      "button,a,[role='button'],summary,label,h1,h2,h3,input,textarea,select,[data-testid],[aria-label],nav a,[data-runbook-feature]"
    )
  );
  let best: HTMLElement | null = null;
  let bestScore = 0;
  let secondBest = 0;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width < 16 || rect.height < 10) continue;
    const text = [
      node.innerText || "",
      node.getAttribute("aria-label") || "",
      node.getAttribute("title") || "",
      node.id || "",
      node.getAttribute("name") || "",
      node.getAttribute("placeholder") || "",
      node.className || "",
      node.getAttribute("data-runbook-feature") || "",
      node.getAttribute("data-runbook-title") || "",
      node.getAttribute("data-runbook-description") || ""
    ]
      .join(" ")
      .toLowerCase();
    if (!text.trim()) continue;

    let score = 0;
    const compactText = compact(text);
    for (const token of tokens) {
      const compactToken = compact(token);
      if (text.includes(token)) score += token.length > 5 ? 3 : 2;
      if (compactToken && compactText.includes(compactToken)) score += token.length > 5 ? 3 : 2;
    }
    if (intentCompact && compactText.includes(intentCompact)) score += 8;
    if (/(create|sign\s*up|signup|register|get\s*started|start|continue|next)/i.test(text)) score += 3;
    if (node.hasAttribute("data-runbook-feature")) score += 6;
    if (node.hasAttribute("data-runbook-title")) score += 2;
    if (node.tagName === "BUTTON" || node.tagName === "A") score += 2;
    if (score > bestScore) {
      secondBest = bestScore;
      bestScore = score;
      best = node;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (!best || bestScore < 3) return null;
  const highConfidence = bestScore >= 8 && bestScore - secondBest >= 2;
  return { element: best, highConfidence };
}

function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function compact(text: string): string {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stripTrailingSentencePunctuation(input: string): string {
  let end = input.length;
  while (end > 0) {
    const ch = input[end - 1];
    if (ch === "." || ch === "!" || ch === "?") {
      end -= 1;
      continue;
    }
    break;
  }
  return input.slice(0, end);
}

function extractIntentPhrase(question: string): string {
  const q = String(question || "");
  const lower = q.toLowerCase();
  const prefixes = ["where is ", "find ", "locate ", "click ", "open ", "go to "];
  for (const prefix of prefixes) {
    const idx = lower.indexOf(prefix);
    if (idx >= 0) {
      const rawTarget = q.slice(idx + prefix.length).trim();
      const cleaned = stripTrailingSentencePunctuation(rawTarget).trim();
      if (cleaned.length > 0) return cleaned;
    }
  }
  return "";
}

function isLocationIntent(text: string): boolean {
  return /(where|find|locate|click|open|go to|how do i|create account|sign up|signup|register|get started|log in|login)/i.test(
    String(text || "")
  );
}
