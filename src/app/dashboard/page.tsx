"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_PERSONAS, DEMO_QUESTIONS } from "@/lib/demoScenario";
import { ChatSource, Hire, Lesson, LessonSlide, OnboardingTask } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
};

const LESSON_DOC_OPTIONS = [
  { id: "engineering-setup", label: "Engineering Setup Guide" },
  { id: "first-week", label: "First Week Onboarding Plan" },
  { id: "expense-policy", label: "Expense Policy" },
  { id: "security-policy", label: "Security Policy" },
  { id: "product-overview", label: "Product Overview" },
];

const EMPTY_LESSON_SLIDE: LessonSlide = {
  title: "No lesson loaded",
  body: "Choose a source doc and generate a lesson to get started.",
};

function statusLabel(status: OnboardingTask["status"]): string {
  if (status === "complete") return "Complete";
  if (status === "in_progress") return "In Progress";
  return "Todo";
}

function statusClasses(status: OnboardingTask["status"]): string {
  if (status === "complete") return "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30";
  if (status === "in_progress") return "bg-amber-500/20 text-amber-300 border border-amber-400/30";
  return "bg-slate-700 text-slate-200 border border-slate-600";
}

export default function DashboardPage() {
  const [hires, setHires] = useState<Hire[]>([]);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [selectedHireId, setSelectedHireId] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lessonDocId, setLessonDocId] = useState("engineering-setup");
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonSlideIndex, setLessonSlideIndex] = useState(0);
  const messageCounterRef = useRef(0);

  const nextMessageId = useCallback((prefix: string) => {
    messageCounterRef.current += 1;
    return `${prefix}-${messageCounterRef.current}`;
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Task request failed");
      const data = (await res.json()) as OnboardingTask[];
      setTasks(Array.isArray(data) ? data : []);
      setTasksError(null);
    } catch (error) {
      console.error(error);
      setTasksError("Could not load onboarding tasks.");
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadHires = useCallback(async () => {
    try {
      const res = await fetch("/api/manager/hires");
      if (!res.ok) throw new Error("Hires request failed");
      const data = (await res.json()) as { hires?: Hire[] };
      const active = (data.hires || []).filter((hire) => hire.active);
      setHires(active);
      setSelectedHireId((current) => {
        if (current && active.some((hire) => hire.id === current)) return current;
        return active[0]?.id || "";
      });
    } catch (error) {
      console.error(error);
      setHires([]);
      setSelectedHireId("");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHires();
      void loadTasks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHires, loadTasks]);

  async function updateStatus(taskId: string, status: OnboardingTask["status"]) {
    const previous = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));
    try {
      const res = await fetch("/api/tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      if (!res.ok) throw new Error("Task status update failed");
    } catch (error) {
      console.error(error);
      setTasks(previous);
      setTasksError("Could not save task status. Please retry.");
    }
  }

  async function submitChat(question: string) {
    const trimmed = question.trim();
    if (!trimmed || chatBusy) return;
    const userMessage: ChatMessage = {
      id: nextMessageId("user"),
      role: "user",
      text: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, hireId: selectedHireId }),
      });
      const data = (await res.json()) as { answer?: string; sources?: ChatSource[] };
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          text: data.answer || "I could not find an answer right now.",
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId("assistant-error"),
          role: "assistant",
          text: "Runbook is temporarily unavailable. Please try again.",
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  async function generateLesson() {
    setLessonLoading(true);
    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: lessonDocId, hireId: selectedHireId }),
      });
      const data = (await res.json()) as Lesson;
      if (!res.ok || !data?.slides?.length) throw new Error("Lesson generation failed");
      setLesson(data);
      setLessonSlideIndex(0);
    } catch (error) {
      console.error(error);
      setLesson({
        title: "Lesson unavailable",
        summary: "Could not generate lesson right now.",
        slides: [EMPTY_LESSON_SLIDE],
        narrationScript: "No narration available.",
      });
      setLessonSlideIndex(0);
    } finally {
      setLessonLoading(false);
    }
  }

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.assigneeId === selectedHireId),
    [tasks, selectedHireId],
  );

  const completed = useMemo(
    () => visibleTasks.filter((task) => task.status === "complete").length,
    [visibleTasks],
  );

  const progressPct = visibleTasks.length ? Math.round((completed / visibleTasks.length) * 100) : 0;
  const currentSlide = lesson?.slides?.[lessonSlideIndex] ?? EMPTY_LESSON_SLIDE;
  const selectedHire = hires.find((hire) => hire.id === selectedHireId);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-6">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h1 className="text-3xl font-bold">Welcome, {selectedHire?.name || DEMO_PERSONAS.newHire.name}</h1>
            <p className="mt-2 text-sm text-slate-300">
              Track onboarding tasks, ask Runbook for help, and review lessons with source-backed guidance.
            </p>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Progress</span>
                <span data-testid="dashboard-progress">{completed}/{visibleTasks.length} tasks complete ({progressPct}%)</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-700">
                <div className="h-2 rounded bg-cyan-400 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Task checklist</h2>
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={selectedHireId}
                onChange={(event) => setSelectedHireId(event.target.value)}
              >
                {hires.map((hire) => (
                  <option key={hire.id} value={hire.id}>
                    {hire.name}
                  </option>
                ))}
              </select>
            </div>
            {tasksError ? <p className="mt-3 text-sm text-amber-300">{tasksError}</p> : null}
            {tasksLoading ? (
              <p className="mt-4 text-sm text-slate-300">Loading tasks...</p>
            ) : visibleTasks.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No tasks assigned yet for {selectedHire?.name || "this hire"}.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {visibleTasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{task.title}</p>
                        <p className="text-sm text-slate-300">{task.description}</p>
                        <p className="text-xs text-slate-400">
                          Source: {task.sourceTitle} · ETA: {task.estimatedTime}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses(task.status)}`}>
                        {statusLabel(task.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["todo", "in_progress", "complete"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`rounded-md border px-3 py-1 text-xs ${
                            task.status === status
                              ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                              : "border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                          onClick={() => updateStatus(task.id, status)}
                        >
                          Mark {statusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="space-y-6">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Runbook Chat</h2>
            <p className="mt-2 text-sm text-slate-300">Ask onboarding questions and get source-backed answers.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {DEMO_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void submitChat(q)}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3">
              <div className="space-y-2">
                <p className="inline-block max-w-[95%] rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100">
                  Hi {selectedHire?.name || "there"}, ask me anything about onboarding and I will cite the best matching docs.
                </p>
              </div>
              {messages.map((message) => (
                <div key={message.id} className={`space-y-2 ${message.role === "user" ? "text-right" : ""}`}>
                  <p
                    className={`inline-block max-w-[95%] rounded-lg px-3 py-2 text-sm ${
                      message.role === "user" ? "bg-cyan-500 text-slate-900" : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {message.text}
                  </p>
                  {message.role === "assistant" && message.sources?.length ? (
                    <div className="grid gap-2">
                      {message.sources.map((source, idx) => (
                        <article key={`${message.id}-source-${idx}`} className="rounded border border-slate-700 bg-slate-900 p-2 text-left">
                          <p className="text-xs font-semibold text-cyan-200">{source.title}</p>
                          <p className="text-xs text-slate-300">{source.excerpt}</p>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {chatBusy ? (
                <p className="text-sm text-cyan-300">Runbook is searching company knowledge...</p>
              ) : null}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submitChat(chatInput);
              }}
            >
              <input
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Ask Runbook an onboarding question..."
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button
                type="submit"
                disabled={chatBusy}
                className="rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-300 disabled:opacity-60"
              >
                Send
              </button>
            </form>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Lesson Viewer</h2>
            <p className="mt-2 text-sm text-slate-300">
              Generate a bite-sized lesson from a source document, then step through slides.
            </p>
            <div className="mt-3 flex gap-2">
              <select
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                value={lessonDocId}
                onChange={(event) => setLessonDocId(event.target.value)}
              >
                {LESSON_DOC_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void generateLesson()}
                disabled={lessonLoading}
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-60"
              >
                {lessonLoading ? "Loading..." : "Generate"}
              </button>
            </div>
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {lesson ? `${lesson.title} · Slide ${lessonSlideIndex + 1}/${lesson.slides.length}` : "Lesson preview"}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{currentSlide.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{currentSlide.body}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1 text-sm hover:border-slate-500 disabled:opacity-40"
                onClick={() => setLessonSlideIndex((idx) => Math.max(0, idx - 1))}
                disabled={!lesson || lessonSlideIndex === 0}
              >
                Back
              </button>
              <span className="text-xs text-slate-400">
                {lesson ? `${lessonSlideIndex + 1} / ${lesson.slides.length}` : "0 / 0"}
              </span>
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1 text-sm hover:border-slate-500 disabled:opacity-40"
                onClick={() => setLessonSlideIndex((idx) => Math.min((lesson?.slides.length || 1) - 1, idx + 1))}
                disabled={!lesson || lessonSlideIndex >= lesson.slides.length - 1}
              >
                Next
              </button>
            </div>
            {lesson?.summary ? (
              <p className="mt-3 text-xs text-slate-400">Summary: {lesson.summary}</p>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}
