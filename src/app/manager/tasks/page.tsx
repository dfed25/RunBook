"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Hire, HireKnowledgeSource, KNOWLEDGE_SOURCE_TYPES, KnowledgeSourceType, OnboardingTask } from "@/lib/types";
import { AppButton } from "@/components/ui/AppButton";
import { SectionCard } from "@/components/ui/SectionCard";

type TaskFormState = {
  title: string;
  description: string;
  objective: string;
  steps: string;
  verification: string;
  escalation: string;
  assigneeId: string;
  estimatedTime: string;
  sourceTitle: string;
};
type HireFormState = { name: string; role: string; email: string };
type SourceFormState = { type: KnowledgeSourceType; title: string; url: string };

const SOURCE_TYPES: readonly KnowledgeSourceType[] = KNOWLEDGE_SOURCE_TYPES;

export default function ManagerTasksPage() {
  const [hires, setHires] = useState<Hire[]>([]);
  const [selectedHireId, setSelectedHireId] = useState("");
  const [sources, setSources] = useState<HireKnowledgeSource[]>([]);
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [hireForm, setHireForm] = useState<HireFormState>({ name: "", role: "", email: "" });
  const [sourceForm, setSourceForm] = useState<SourceFormState>({ type: "url", title: "", url: "" });
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    description: "",
    objective: "",
    steps: "",
    verification: "",
    escalation: "",
    assigneeId: "",
    estimatedTime: "",
    sourceTitle: "",
  });
  const [duplicateTargets, setDuplicateTargets] = useState<Record<string, string[]>>({});

  const activeHires = hires.filter((hire) => hire.active);
  const archivedHires = hires.filter((hire) => !hire.active);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const [tasksRes, hiresRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/manager/hires")]);
        const tasksData = await tasksRes.json();
        const hiresData = await hiresRes.json();
        if (tasksRes.ok) setTasks(tasksData);
        if (hiresRes.ok) {
          const allHires = (hiresData.hires || []) as Hire[];
          const defaultHire = allHires.find((hire) => hire.active)?.id || "";
          setHires(allHires);
          setSelectedHireId(defaultHire);
          setForm((prev) => ({ ...prev, assigneeId: defaultHire }));
        }
      } catch (error) {
        console.error(error);
        setMessage("Failed to load existing tasks.");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedHireId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/manager/hires/${selectedHireId}/sources`, { signal: controller.signal });
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (res.ok) setSources(data.sources || []);
        else setMessage(data.error || "Failed to load sources.");
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.error(error);
          setMessage("Failed to load sources.");
        }
      }
    })();
    return () => controller.abort();
  }, [selectedHireId]);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to create task.");
    setTasks((prev) => [...prev, data]);
    setForm({
      title: "",
      description: "",
      objective: "",
      steps: "",
      verification: "",
      escalation: "",
      assigneeId: form.assigneeId,
      estimatedTime: "",
      sourceTitle: "",
    });
    setMessage("Task created.");
  }

  function toggleDuplicateTarget(taskId: string, hireId: string) {
    setDuplicateTargets((prev) => {
      const current = prev[taskId] || [];
      const next = current.includes(hireId) ? current.filter((entry) => entry !== hireId) : [...current, hireId];
      return { ...prev, [taskId]: next };
    });
  }

  async function removeTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to remove task.");
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setDuplicateTargets((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setMessage("Task removed.");
  }

  async function moveTask(taskId: string, direction: "up" | "down") {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", direction })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to reorder task.");
    setTasks(data.tasks);
  }

  async function duplicateTask(taskId: string) {
    const selected = duplicateTargets[taskId] || [];
    if (selected.length === 0) return setMessage("Select at least one hire to duplicate to.");
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", assigneeIds: selected })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to duplicate task.");
    setTasks((prev) => [...prev, ...(data.created || [])]);
    setDuplicateTargets((prev) => ({ ...prev, [taskId]: [] }));
    setMessage("Task duplicated.");
  }

  async function createHire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await fetch("/api/manager/hires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hireForm)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to create hire.");
    const created = data.hire as Hire;
    setHires((prev) => [...prev, { ...created, active: true }]);
    setSelectedHireId(created.id);
    setForm((prev) => ({ ...prev, assigneeId: created.id }));
    setHireForm({ name: "", role: "", email: "" });
  }

  async function deleteHire(hireId: string) {
    const firstConfirm = window.confirm("Remove this hire from active onboarding?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm(
      "Please confirm again: this hire will be archived and removed from active workflows."
    );
    if (!secondConfirm) return;
    const res = await fetch(`/api/manager/hires/${hireId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to remove hire.");
    setHires((prev) => prev.map((hire) => (hire.id === hireId ? { ...hire, active: false } : hire)));
    setSelectedHireId((current) => (current === hireId ? (activeHires.find((hire) => hire.id !== hireId)?.id || "") : current));
    setSources([]);
    setForm((prev) => (prev.assigneeId === hireId ? { ...prev, assigneeId: "" } : prev));
    setMessage("Hire archived. You can restore them below.");
  }

  async function restoreHire(hireId: string) {
    const res = await fetch(`/api/manager/hires/${hireId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to restore hire.");
    setHires((prev) => prev.map((hire) => (hire.id === hireId ? { ...hire, active: true } : hire)));
    setSelectedHireId(hireId);
    setForm((prev) => ({ ...prev, assigneeId: hireId }));
    setMessage("Hire restored.");
  }

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHireId) return;
    const res = await fetch(`/api/manager/hires/${selectedHireId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sourceForm)
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to add source.");
    setSources((prev) => [...prev, data.source]);
    setSourceForm((prev) => ({ ...prev, title: "", url: "" }));
    setMessage("Source added. Syncing now...");
    setSyncing(true);
    const syncRes = await fetch("/api/sync/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hireId: selectedHireId }),
    });
    const syncData = await syncRes.json().catch(() => ({}));
    setSyncing(false);
    if (!syncRes.ok) {
      setMessage(syncData.error || "Source added, but sync failed. Try syncing manually.");
      return;
    }
    setMessage(`Source added and synced: ${syncData.result?.synced ?? 0}/${syncData.result?.scanned ?? 0} docs.`);
  }

  async function deleteSource(sourceId: string) {
    if (!selectedHireId) return;
    const res = await fetch(`/api/manager/hires/${selectedHireId}/sources/${sourceId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Failed to remove source.");
    setSources((prev) => prev.filter((source) => source.id !== sourceId));
  }

  async function syncKnowledge() {
    if (!selectedHireId) return;
    setSyncing(true);
    const res = await fetch("/api/sync/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hireId: selectedHireId })
    });
    const data = await res.json();
    setSyncing(false);
    if (!res.ok) return setMessage(data.error || "Sync failed.");
    setMessage(`Sync complete: ${data.result?.synced ?? 0}/${data.result?.scanned ?? 0} docs.`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Manager Onboarding Control Plane</h1>
          <p className="text-sm text-slate-300">Manage hires, per-hire knowledge, and onboarding tasks in one flow.</p>
          <Link href="/manager" className="inline-block text-sm text-cyan-300 hover:text-cyan-200">Back to manager dashboard</Link>
          {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
        </header>

        <SectionCard title="Hire management" subtitle="Create and maintain active hires for this demo workspace.">
          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={createHire}>
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Full name" value={hireForm.name} onChange={(e) => setHireForm((p) => ({ ...p, name: e.target.value }))} required />
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Role" value={hireForm.role} onChange={(e) => setHireForm((p) => ({ ...p, role: e.target.value }))} />
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Email" value={hireForm.email} onChange={(e) => setHireForm((p) => ({ ...p, email: e.target.value }))} />
            <AppButton variant="primary" type="submit">Add hire</AppButton>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeHires.map((hire) => (
              <AppButton
                key={hire.id}
                type="button"
                variant="ghost"
                tone={selectedHireId === hire.id ? "active" : "inactive"}
                className="rounded-full px-3 py-1 text-xs"
                onClick={() => { setSelectedHireId(hire.id); setForm((p) => ({ ...p, assigneeId: hire.id })); }}
              >
                {hire.name}
              </AppButton>
            ))}
          </div>
          {selectedHireId ? <AppButton type="button" variant="danger" onClick={() => void deleteHire(selectedHireId)} className="mt-3 px-3 py-1 text-xs">Remove selected hire</AppButton> : null}
          {archivedHires.length > 0 ? (
            <div className="mt-4 rounded border border-slate-700 bg-slate-950 p-3">
              <p className="text-xs font-semibold text-slate-300">Archived hires</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {archivedHires.map((hire) => (
                  <AppButton
                    key={hire.id}
                    variant="ghost"
                    className="rounded-full px-3 py-1 text-xs"
                    onClick={() => void restoreHire(hire.id)}
                  >
                    Restore {hire.name}
                  </AppButton>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Per-hire knowledge sources"
          subtitle="Attach links and sync content into this hire's AI context."
          actions={<AppButton type="button" variant="ghost" onClick={() => void syncKnowledge()} disabled={!selectedHireId || syncing} className="px-3 py-1 text-xs">{syncing ? "Syncing..." : "Sync selected hire"}</AppButton>}
        >
          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={addSource}>
            <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={sourceForm.type} onChange={(e) => setSourceForm((p) => ({ ...p, type: e.target.value as KnowledgeSourceType }))}>
              {SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Title" value={sourceForm.title} onChange={(e) => setSourceForm((p) => ({ ...p, title: e.target.value }))} required />
            <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="https://..." value={sourceForm.url} onChange={(e) => setSourceForm((p) => ({ ...p, url: e.target.value }))} required />
            <AppButton variant="secondary" type="submit" disabled={!selectedHireId}>Add source</AppButton>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {sources.map((source) => (
              <li key={source.id} className="flex items-center justify-between rounded border border-slate-700 bg-slate-950 p-3">
                <div><p className="font-medium">{source.title}</p><p className="text-xs text-slate-400">{source.type}</p><p className="text-xs text-slate-300">{source.url}</p></div>
                <AppButton type="button" variant="danger" onClick={() => void deleteSource(source.id)} className="px-2 py-1 text-xs">Remove</AppButton>
              </li>
            ))}
            {selectedHireId && sources.length === 0 ? <li className="text-slate-400">No sources linked yet.</li> : null}
          </ul>
        </SectionCard>

        <SectionCard title="Create task" subtitle="Assign onboarding tasks to hires with ETA and source context.">
          <form className="mt-4 space-y-3" onSubmit={submitTask}>
            <input className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Task title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
            <textarea
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Objective (what success looks like)"
              value={form.objective}
              onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))}
              required
            />
            <textarea
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder={"Execution steps (one per line)\nExample:\nOpen repo\nInstall dependencies\nRun local server"}
              value={form.steps}
              onChange={(e) => setForm((p) => ({ ...p, steps: e.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Verification signals (how the hire knows this is done)"
                value={form.verification}
                onChange={(e) => setForm((p) => ({ ...p, verification: e.target.value }))}
              />
              <textarea
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="If blocked: where to escalate and what info to include"
                value={form.escalation}
                onChange={(e) => setForm((p) => ({ ...p, escalation: e.target.value }))}
              />
            </div>
            <textarea
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Optional additional description/context"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <select className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" value={form.assigneeId} onChange={(e) => setForm((p) => ({ ...p, assigneeId: e.target.value }))}>
                {activeHires.map((hire) => <option key={hire.id} value={hire.id}>{hire.name}</option>)}
              </select>
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Estimated time" value={form.estimatedTime} onChange={(e) => setForm((p) => ({ ...p, estimatedTime: e.target.value }))} />
              <input className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Source title" value={form.sourceTitle} onChange={(e) => setForm((p) => ({ ...p, sourceTitle: e.target.value }))} />
            </div>
            <AppButton variant="primary" type="submit">Create task</AppButton>
          </form>
        </SectionCard>

        <SectionCard title="Current tasks" subtitle="Reorder, remove, or duplicate tasks across hires.">
          {loading ? <p className="mt-3 text-sm text-slate-300">Loading tasks...</p> : tasks.length === 0 ? <p className="mt-3 text-sm text-slate-400">No tasks found.</p> : (
            <ul className="mt-4 space-y-2 text-sm">
              {tasks.map((task) => (
                <li key={task.id} className="rounded border border-slate-700 bg-slate-950 p-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-slate-300">{task.description}</p>
                  <p className="mt-1 text-xs text-slate-400">Assignee: {task.assignee} | Status: {task.status} | ETA: {task.estimatedTime}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AppButton type="button" variant="ghost" onClick={() => void moveTask(task.id, "up")} className="px-2 py-1 text-xs">Move up</AppButton>
                    <AppButton type="button" variant="ghost" onClick={() => void moveTask(task.id, "down")} className="px-2 py-1 text-xs">Move down</AppButton>
                    <AppButton type="button" variant="danger" onClick={() => void removeTask(task.id)} className="px-2 py-1 text-xs">Remove</AppButton>
                  </div>
                  <div className="mt-3 space-y-2 rounded border border-slate-800 bg-slate-900 p-2">
                    <p className="text-xs text-slate-300">Duplicate to hires:</p>
                    <div className="flex flex-wrap gap-2">
                      {activeHires.filter((hire) => hire.id !== task.assigneeId).map((hire) => {
                        const active = (duplicateTargets[task.id] || []).includes(hire.id);
                        return (
                          <AppButton
                            key={`${task.id}-${hire.id}`}
                            type="button"
                            variant="ghost"
                            tone={active ? "active" : "inactive"}
                            className="rounded-full px-2 py-1 text-xs"
                            onClick={() => toggleDuplicateTarget(task.id, hire.id)}
                          >
                            {hire.name}
                          </AppButton>
                        );
                      })}
                    </div>
                    <AppButton type="button" variant="primary" onClick={() => void duplicateTask(task.id)} className="px-2 py-1 text-xs">Duplicate selected</AppButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
