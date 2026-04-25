"use client";

import { useCallback, useMemo, useState } from "react";
import type { DemoManualSource } from "@/lib/studioDemoStorage";

type ChatResponse = {
  answer?: string;
  error?: string;
  sources?: { title: string; excerpt?: string; url?: string }[];
  steps?: string[];
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
  /** `page` = fixed to viewport; `embedded` = inside a positioned preview box */
  position?: "page" | "embedded";
  className?: string;
};

export function EmbeddedRunbookAssistant({
  projectId = "northstar-demo",
  apiBase,
  assistantName,
  welcomeMessage,
  primaryColor,
  suggestedQuestions,
  manualSources = [],
  position = "page",
  className = ""
}: EmbeddedRunbookAssistantProps) {
  const base = apiBase?.replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; html?: string; text?: string }[]>([]);

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

  const send = useCallback(
    async (text: string) => {
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
            pageContext: typeof window !== "undefined" ? `${window.location.href}\n${document.title}` : "",
            customSources
          })
        });
        const data = (await res.json()) as ChatResponse;
        if (!res.ok) {
          setMessages((m) => [...m, { role: "assistant", text: data.error || `Request failed (${res.status})` }]);
          return;
        }
        let html = "";
        if (data.answer) {
          html += `<p class="mb-2 text-sm leading-relaxed text-slate-200">${escapeHtml(data.answer).replace(/\n/g, "<br/>")}</p>`;
        }
        if (data.steps?.length) {
          html += '<ol class="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">';
          for (const s of data.steps) {
            html += `<li>${escapeHtml(s)}</li>`;
          }
          html += "</ol>";
        }
        if (data.sources?.length) {
          html += '<div class="mt-3 space-y-2 border-t border-slate-700/80 pt-2">';
          for (const s of data.sources.slice(0, 4)) {
            html += `<div class="rounded-lg bg-slate-800/80 p-2 text-[11px]"><p class="font-semibold text-indigo-200">${escapeHtml(s.title)}</p><p class="mt-0.5 text-slate-400">${escapeHtml((s.excerpt || "").slice(0, 160))}${(s.excerpt || "").length > 160 ? "…" : ""}</p></div>`;
          }
          html += "</div>";
        }
        setMessages((m) => [...m, { role: "assistant", html: html || "<p class='text-sm text-slate-400'>No content.</p>" }]);
      } catch {
        setMessages((m) => [...m, { role: "assistant", text: "Network error — try again." }]);
      } finally {
        setLoading(false);
      }
    },
    [base, projectId, manualSources]
  );

  const openPanel = useCallback(() => {
    setOpen(true);
    setMessages((m) =>
      m.length === 0
        ? [{ role: "assistant", html: `<p class="text-sm text-slate-200">${escapeHtml(welcomeMessage)}</p>` }]
        : m
    );
  }, [welcomeMessage]);

  const chips = suggestedQuestions.filter(Boolean).slice(0, 8);

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
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-2 py-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="rounded-full border border-indigo-500/40 bg-indigo-950/50 px-2.5 py-1 text-[10px] font-medium text-indigo-100 hover:bg-indigo-900/70"
                  onClick={() => void send(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} className="ml-6 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-right text-sm text-white">
                  {msg.text}
                </div>
              ) : (
                <div
                  key={i}
                  className="mr-4 rounded-xl border border-slate-700/80 bg-slate-800/90 px-3 py-2 text-left"
                  dangerouslySetInnerHTML={{ __html: msg.html || escapeHtml(msg.text || "") }}
                />
              )
            )}
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
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
