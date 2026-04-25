"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_PERSONAS, DEMO_QUESTIONS } from "@/lib/demoScenario";
import { ChatSource, Hire, Lesson, LessonRenderJob, LessonSlide, OnboardingTask } from "@/lib/types";
import { AppButton } from "@/components/ui/AppButton";
import { ChatMessageBody } from "@/components/ui/ChatMessageBody";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
};

const EMPTY_LESSON_SLIDE: LessonSlide = {
  title: "No lesson loaded",
  body: "Choose a source doc and generate a lesson to get started.",
  speakerNotes: "No narration available for this slide.",
};

function statusLabel(status: OnboardingTask["status"]): string {
  if (status === "complete") return "Complete";
  if (status === "in_progress") return "In Progress";
  return "Todo";
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
  const [lessonQuestion, setLessonQuestion] = useState("How do I set up and start contributing in my first week?");
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonSlideIndex, setLessonSlideIndex] = useState(0);
  const [presenterMode, setPresenterMode] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderJob, setRenderJob] = useState<LessonRenderJob | null>(null);
  const pollTimerRef = useRef<number | null>(null);
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
    const question = lessonQuestion.trim();
    if (!question) return;
    setLessonLoading(true);
    try {
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hireId: selectedHireId, question }),
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
        confidence: "partial",
      });
      setLessonSlideIndex(0);
    } finally {
      setLessonLoading(false);
    }
  }

  function stopNarration() {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setNarrating(false);
  }

  function speakCurrentSlide() {
    if (!lesson || typeof window === "undefined") return;
    const slide = lesson.slides[lessonSlideIndex];
    if (!slide) return;
    const text = [slide.title, slide.speakerNotes || slide.body].join(". ");
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setNarrating(false);
    utter.onerror = () => setNarrating(false);
    setNarrating(true);
    window.speechSynthesis.speak(utter);
  }

  async function pollRenderJob(jobId: string) {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    const tick = async () => {
      const res = await fetch(`/api/lesson/render/${jobId}`);
      const data = (await res.json()) as LessonRenderJob;
      if (!res.ok) return;
      setRenderJob(data);
      if (data.status === "completed" || data.status === "failed") {
        setRenderBusy(false);
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    };
    await tick();
    pollTimerRef.current = window.setInterval(() => {
      void tick();
    }, 1800);
  }

  async function renderLessonVideo() {
    if (!lesson) return;
    setRenderBusy(true);
    try {
      const res = await fetch("/api/lesson/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson }),
      });
      const data = (await res.json()) as LessonRenderJob;
      if (!res.ok) {
        throw new Error(data.error || "Failed to render lesson video");
      }
      setRenderJob(data);
      if (data.status !== "completed" && data.status !== "failed") {
        await pollRenderJob(data.id);
      } else {
        setRenderBusy(false);
      }
    } catch (error) {
      console.error(error);
      setRenderBusy(false);
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
  const visualThemeClass = useMemo(() => {
    const hint = (currentSlide.visualHint || "").toLowerCase();
    if (hint.includes("timeline")) return "bg-gradient-to-br from-indigo-950 via-slate-950 to-cyan-950";
    if (hint.includes("checklist")) return "bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-950";
    if (hint.includes("support")) return "bg-gradient-to-br from-fuchsia-950 via-slate-950 to-sky-950";
    return "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950";
  }, [currentSlide.visualHint]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className={`mx-auto grid max-w-7xl gap-6 ${presenterMode ? "grid-cols-1" : "lg:grid-cols-[1.2fr_1fr]"}`}>
        <section className={`space-y-6 ${presenterMode ? "hidden" : ""}`}>
          <SectionCard
            title={`Welcome, ${selectedHire?.name || DEMO_PERSONAS.newHire.name}`}
            subtitle="Track onboarding tasks, ask Runbook for help, and review lessons with source-backed guidance."
          >
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Progress</span>
                <span data-testid="dashboard-progress">{completed}/{visibleTasks.length} tasks complete ({progressPct}%)</span>
              </div>
              <div className="h-2 w-full rounded bg-slate-700">
                <div className="h-2 rounded bg-cyan-400 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Task checklist"
            actions={
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
            }
          >
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
                      <StatusBadge tone={task.status === "complete" ? "success" : task.status === "in_progress" ? "warning" : "neutral"}>
                        {statusLabel(task.status)}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["todo", "in_progress", "complete"] as const).map((status) => (
                        <AppButton
                          key={status}
                          type="button"
                          className={`px-3 py-1 text-xs ${
                            task.status === status
                              ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                              : "border-slate-700 text-slate-300 hover:border-slate-500"
                          }`}
                          onClick={() => updateStatus(task.id, status)}
                        >
                          Mark {statusLabel(status)}
                        </AppButton>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </section>

        <section className="space-y-6">
          <SectionCard
            title="Runbook Chat"
            subtitle="Ask onboarding questions and get source-backed answers."
          >
            <div className="mt-4 flex flex-wrap gap-2">
              {DEMO_QUESTIONS.map((q) => (
                <AppButton
                  key={q}
                  type="button"
                  onClick={() => void submitChat(q)}
                  variant="ghost"
                  className="rounded-full px-3 py-1 text-xs"
                >
                  {q}
                </AppButton>
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
                  <div
                    className={`inline-block rounded-lg px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "max-w-[min(92%,28rem)] bg-cyan-500 text-slate-900"
                        : "max-w-[min(96%,42rem)] bg-slate-800 text-slate-100"
                    }`}
                  >
                    <ChatMessageBody role={message.role} text={message.text} />
                  </div>
                  {message.role === "assistant" && message.sources?.length ? (
                    <div className="grid gap-2">
                      {message.sources.map((source, idx) => (
                        <article key={`${message.id}-source-${idx}`} className="rounded border border-slate-700 bg-slate-900 p-2 text-left">
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-cyan-200 underline-offset-2 hover:underline"
                            >
                              {source.title}
                            </a>
                          ) : (
                            <p className="text-xs font-semibold text-cyan-200">{source.title}</p>
                          )}
                          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                            {source.excerpt}
                          </p>
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
              <AppButton
                type="submit"
                disabled={chatBusy}
                variant="primary"
                className="px-4 py-2"
              >
                Send
              </AppButton>
            </form>
          </SectionCard>

          <SectionCard
            title="Lesson Viewer"
            subtitle="Ask a question and generate a grounded walkthrough, presenter narration, and optional MP4."
          >
            <div className="mt-3 space-y-2">
              <label className="block text-xs uppercase tracking-wide text-slate-400">What do you want to learn?</label>
              <textarea
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                rows={3}
                value={lessonQuestion}
                onChange={(event) => setLessonQuestion(event.target.value)}
                placeholder="Example: How do I onboard for engineering setup, get repo access, and ship my first PR?"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <AppButton
                type="button"
                onClick={() => void generateLesson()}
                disabled={lessonLoading || !lessonQuestion.trim()}
                variant="secondary"
                className="px-4 py-2"
              >
                {lessonLoading ? "Loading..." : "Generate"}
              </AppButton>
            </div>
            <div className={`mt-4 rounded-xl border border-slate-700 p-5 shadow-lg ${visualThemeClass}`}>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {lesson ? `${lesson.title} · Slide ${lessonSlideIndex + 1}/${lesson.slides.length}` : "Lesson preview"}
              </p>
              {lesson?.confidence ? (
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                  Confidence: {lesson.confidence}{lesson.limitedSources ? " · limited sources" : ""}
                </p>
              ) : null}
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{currentSlide.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100">{currentSlide.body}</p>
              {currentSlide.speakerNotes ? (
                <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-900/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Narration notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{currentSlide.speakerNotes}</p>
                </div>
              ) : null}
              {currentSlide.citations?.length ? (
                <p className="mt-3 text-xs text-cyan-300">Sources: {currentSlide.citations.join(" · ")}</p>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <AppButton
                type="button"
                variant="ghost"
                className="px-3 py-1"
                onClick={() => setLessonSlideIndex((idx) => Math.max(0, idx - 1))}
                disabled={!lesson || lessonSlideIndex === 0}
              >
                Back
              </AppButton>
              <span className="text-xs text-slate-400">
                {lesson ? `${lessonSlideIndex + 1} / ${lesson.slides.length}` : "0 / 0"}
              </span>
              <AppButton
                type="button"
                variant="ghost"
                className="px-3 py-1"
                onClick={() => setLessonSlideIndex((idx) => Math.min((lesson?.slides.length || 1) - 1, idx + 1))}
                disabled={!lesson || lessonSlideIndex >= lesson.slides.length - 1}
              >
                Next
              </AppButton>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AppButton
                type="button"
                variant="ghost"
                className="px-3 py-1"
                onClick={() => setPresenterMode((v) => !v)}
                disabled={!lesson}
              >
                {presenterMode ? "Exit presenter" : "Presenter mode"}
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                className="px-3 py-1"
                onClick={() => (narrating ? stopNarration() : speakCurrentSlide())}
                disabled={!lesson}
              >
                {narrating ? "Stop narration" : "Read slide aloud"}
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                className="px-3 py-1"
                onClick={() => void renderLessonVideo()}
                disabled={!lesson || renderBusy}
              >
                {renderBusy ? "Rendering MP4..." : "Export MP4"}
              </AppButton>
            </div>
            {lesson?.summary ? (
              <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">Summary: {lesson.summary}</p>
            ) : null}
            {lesson?.sourcesUsed?.length ? (
              <div className="mt-3 rounded border border-slate-700 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Sources used</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
                  {lesson.sourcesUsed.map((source, idx) => (
                    <li key={`${source.title}-${idx}`}>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-600 underline-offset-2 hover:text-cyan-200">
                          {source.title}
                        </a>
                      ) : (
                        source.title
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {renderJob ? (
              <div className="mt-3 rounded border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300">
                <p>Render status: <span className="font-semibold text-cyan-200">{renderJob.status}</span></p>
                {renderJob.outputUrl ? (
                  <a href={renderJob.outputUrl} className="mt-1 inline-block underline underline-offset-2 hover:text-cyan-200" target="_blank" rel="noopener noreferrer">
                    Download generated video
                  </a>
                ) : null}
                {renderJob.error ? <p className="mt-1 text-rose-300">{renderJob.error}</p> : null}
              </div>
            ) : null}
          </SectionCard>
        </section>
      </div>
    </main>
  );
}
